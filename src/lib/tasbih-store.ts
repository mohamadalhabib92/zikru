/**
 * Magasin durable du compteur de dhikr (sans React ni React Native : testé par scripts/test-tasbih-log.mjs
 * avec un stockage simulé qui échoue, ralentit ou « tue » l'app au milieu d'une écriture).
 *
 * - chaque appui met à jour la mémoire IMMÉDIATEMENT puis part dans une écriture sérialisée (durable.ts) ;
 *   le document entier (compte, journal, curseurs Bluetooth) tient dans UNE clé : écriture atomique,
 *   jamais d'état à moitié écrit ;
 * - appuis faits avant la fin du chargement : rejoués sur l'état chargé (avant : écrasés) ;
 * - lecture impossible : on réessaie et on n'écrit RIEN par-dessus tant que l'état enregistré n'est pas lu ;
 * - données illisibles : copie conservée (.corrupt), reprise depuis la sauvegarde (.bak) ;
 * - migration de l'ancien format : l'original est d'abord copié sous « tasbih.v1 ».
 */
import type { Durable } from './durable';
import type { ClickSource, Tasbih } from './tasbih-core';
import { tasbihGeneration } from './preserve';
import { dropCursor, migrate, newDoc, recordClicks, replay, setCursor, updateState, type BleCursor, type PendingOp, type RecordResult, type TasbihDoc } from './tasbih-log';
import { mergeWatchSessions, syncPhoneSession, type WatchSession } from './watch-sync';

export type TasbihStoreOpts = {
  durable: Durable;
  /** Clé complète (avec préfixe). */
  key: string;
  makeDev: () => string;
  now?: () => number;
  /** Délais entre deux essais de lecture si le stockage est indisponible. */
  readRetryMs?: number[];
  /** Une sauvegarde .bak toutes les N écritures (et à chaque flush). */
  backupEvery?: number;
};

export function createTasbihStore(o: TasbihStoreOpts) {
  const now = o.now ?? Date.now;
  const readRetry = o.readRetryMs ?? [300, 1000, 3000, 10000];
  const backupEvery = o.backupEvery ?? 25;
  const BAK = o.key + '.bak';
  const INBOX = o.key + '.inbox';
  let doc: TasbihDoc = newDoc('pending');
  let ready = false;
  /** Document plus récent que v2 : la clé principale n'est pas réécrite. */
  let holdNewer = false;
  let epoch = 0;
  type InboxItem = { n: number; src: ClickSource; at: number; cursor?: BleCursor };
  type InboxFile = { v: 1; items: InboxItem[]; state: Tasbih | null; watch?: TasbihDoc['watch'] };
  let inbox: InboxFile = { v: 1, items: [], state: null };
  let loading: Promise<void> | null = null;
  let pending: PendingOp[] = [];
  let pendingWatch: WatchSession[] = [];
  let writes = 0;
  let lastWrite: Promise<boolean> = Promise.resolve(true);
  const subs = new Set<() => void>();
  const emit = () => subs.forEach((f) => f());

  const persistInbox = () => {
    lastWrite = o.durable.write(INBOX, inbox);
  };
  const applyWatch = (sessions: WatchSession[]) => {
    const r = mergeWatchSessions(doc, sessions, () => 'p-' + o.makeDev());
    const same = JSON.stringify(doc.watch ?? null) === JSON.stringify(r.doc.watch ?? null) && r.added === 0;
    if (same) return r;
    doc = r.doc;
    if (holdNewer) {
      if (r.addedLive > 0) inbox.items.push({ n: r.addedLive, src: 'watch', at: now() });
      inbox.watch = doc.watch;
      inbox.state = doc.t;
      persistInbox();
    } else persist();
    emit();
    return r;
  };
  const persist = () => {
    if (!ready) return;
    if (holdNewer) {
      persistInbox();
      return;
    }
    writes++;
    lastWrite = o.durable.write(o.key, doc);
    if (writes % backupEvery === 0) void o.durable.write(BAK, doc);
  };

  const readOnce = async () => {
    const main = await o.durable.read<unknown>(o.key, null);
    if (main.status === 'error') return null; // stockage indisponible : on réessaiera, sans rien écraser
    let raw = main.value;
    if (main.status === 'corrupt' || main.status === 'missing') {
      const bak = await o.durable.read<unknown>(BAK, null);
      if (bak.status === 'error') return null;
      if (bak.status === 'ok') raw = bak.value;
    }
    const gen = tasbihGeneration(raw);
    if (gen === 'newer') {
      const side = await o.durable.read<InboxFile>(INBOX, { v: 1, items: [], state: null });
      if (side.status === 'error') return null;
      const file = side.status === 'ok' && side.value && Array.isArray(side.value.items) ? side.value : { v: 1 as const, items: [], state: null };
      inbox = { v: 1, items: file.items.filter((it) => it && typeof it.n === 'number' && it.n > 0), state: file.state ?? null, watch: file.watch };
      let d = migrate({ ...(raw as object), v: 2 }, o.makeDev);
      for (const it of inbox.items) d = recordClicks(d, it.n, it.src, it.at, it.cursor).doc;
      if (inbox.state) d = updateState(d, () => inbox.state as Tasbih);
      if (inbox.watch) d = { ...d, watch: inbox.watch };
      return { d, changed: false, hold: true as const };
    }
    const d = migrate(raw, o.makeDev);
    const wasV1 = main.status === 'ok' && gen === 'legacy';
    if (wasV1) {
      // copie intacte de l'ancien format AVANT toute réécriture (retour arrière possible)
      const ok = await o.durable.write(o.key + '.v1', raw);
      if (!ok) return null;
    }
    return { d, changed: main.status !== 'ok' || wasV1, hold: false as const };
  };

  const load = (): Promise<void> => {
    if (!loading)
      loading = (async () => {
        const ticket = epoch;
        let attempt = 0;
        for (;;) {
          const r = await readOnce();
          if (ticket !== epoch) return;
          if (r) {
            const ops = pending;
            pending = [];
            holdNewer = r.hold;
            doc = replay(r.d, ops);
            ready = true;
            if (holdNewer && ops.length) {
              for (const op of ops) {
                if (op.k === 'clicks' && op.n > 0) inbox.items.push({ n: op.n, src: op.src, at: op.at, cursor: op.cursor });
              }
              inbox.state = doc.t;
              persistInbox();
            } else if (ops.length || r.changed) persist();
            const queued = pendingWatch.splice(0);
            if (queued.length) applyWatch(queued);
            emit();
            return;
          }
          await new Promise((res) => setTimeout(res, readRetry[Math.min(attempt++, readRetry.length - 1)]));
        }
      })();
    return loading;
  };

  return {
    load,
    ready: () => ready,
    doc: () => doc,
    get: (): Tasbih => doc.t,
    subscribe(f: () => void) {
      subs.add(f);
      return () => {
        subs.delete(f);
      };
    },
    /** Ajoute n appuis (mémoire immédiate + écriture durable). */
    addClicks(n: number, src: ClickSource, cursor?: BleCursor): RecordResult {
      const at = now();
      const r = recordClicks(doc, n, src, at, cursor);
      if (r.added === 0 && !r.duplicate) return r;
      if (!ready) pending.push({ k: 'clicks', n, src, at, cursor });
      doc = r.doc;
      if (r.added) {
        if (holdNewer) {
          inbox.items.push({ n: r.added, src, at, cursor });
          inbox.state = doc.t;
        }
        persist();
        emit();
      }
      return r;
    },
    set(f: (t: Tasbih) => Tasbih) {
      if (!ready) pending.push({ k: 'set', f });
      doc = updateState(doc, f);
      if (holdNewer) inbox.state = doc.t;
      persist();
      emit();
    },
    /** Mémorise la valeur absolue d'un appareil Bluetooth sans nouvel appui. */
    setCursor(c: BleCursor) {
      if (!ready) pending.push({ k: 'cursor', c });
      const d = setCursor(doc, c);
      if (d === doc) return;
      doc = d;
      persist();
    },
    dropCursor(id: string) {
      if (!ready) pending.push({ k: 'drop', id });
      const d = dropCursor(doc, id);
      if (d === doc) return;
      doc = d;
      persist();
    },
    cursor: (id: string): number | undefined => doc.ble[id],
    /** Écrit tout de suite (passage en arrière-plan) + sauvegarde ; true si tout est enregistré. */
    async flush(): Promise<boolean> {
      if (!ready) return false;
      if (holdNewer) {
        persistInbox();
        return o.durable.flush(INBOX);
      }
      void o.durable.write(BAK, doc);
      const a = await o.durable.flush(o.key);
      const b = await o.durable.flush(BAK);
      return a && b;
    },
    /** Vrai quand la clé principale est un document plus récent et n'est pas réécrite. */
    holdingNewer: () => holdNewer,
    /**
     * Séances Apple Watch. L’identifiant est idempotent : un second passage du même total n’ajoute rien.
     * Avant la fin du chargement, les séances attendent et sont rejouées ensuite.
     */
    mergeWatch(sessions: WatchSession[]) {
      if (!sessions.length) return { added: 0, addedLive: 0, touched: [] as string[] };
      if (!ready) {
        pendingWatch.push(...sessions);
        return { added: 0, addedLive: 0, touched: [] as string[] };
      }
      return applyWatch(sessions);
    },
    /** Séance ouverte du téléphone (compte hors montre), à envoyer à la montre. */
    notePhone(nowMs: number): WatchSession | null {
      if (!ready) return null;
      const r = syncPhoneSession(doc, nowMs, () => 'p-' + o.makeDev());
      if (!r.changed) return r.session;
      doc = r.doc;
      if (holdNewer) {
        inbox.watch = doc.watch;
        inbox.state = doc.t;
        persistInbox();
      } else persist();
      emit();
      return r.session;
    },
    /** Dernière écriture demandée (tests). */
    lastWrite: () => lastWrite,
    /** Après « Effacer toutes les données ». */
    reset() {
      epoch++;
      doc = newDoc(o.makeDev());
      pending = [];
      pendingWatch = [];
      holdNewer = false;
      inbox = { v: 1, items: [], state: null };
      ready = true;
      emit();
    },
  };
}
export type TasbihStore = ReturnType<typeof createTasbihStore>;
