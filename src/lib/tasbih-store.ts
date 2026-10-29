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
import { dropCursor, migrate, newDoc, recordClicks, replay, setCursor, updateState, type BleCursor, type PendingOp, type RecordResult, type TasbihDoc } from './tasbih-log';

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
  let doc: TasbihDoc = newDoc('pending');
  let ready = false;
  let loading: Promise<void> | null = null;
  let pending: PendingOp[] = [];
  let writes = 0;
  let lastWrite: Promise<boolean> = Promise.resolve(true);
  const subs = new Set<() => void>();
  const emit = () => subs.forEach((f) => f());

  const persist = () => {
    if (!ready) return;
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
    const d = migrate(raw, o.makeDev);
    const wasV1 = main.status === 'ok' && raw != null && typeof raw === 'object' && (raw as { v?: unknown }).v !== 2;
    if (wasV1) {
      // copie intacte de l'ancien format AVANT toute réécriture (retour arrière possible)
      const ok = await o.durable.write(o.key + '.v1', raw);
      if (!ok) return null;
    }
    return { d, changed: main.status !== 'ok' || wasV1 };
  };

  const load = (): Promise<void> => {
    if (!loading)
      loading = (async () => {
        let attempt = 0;
        for (;;) {
          const r = await readOnce();
          if (r) {
            const ops = pending;
            pending = [];
            doc = replay(r.d, ops);
            ready = true;
            if (ops.length || r.changed) persist();
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
        persist();
        emit();
      }
      return r;
    },
    set(f: (t: Tasbih) => Tasbih) {
      if (!ready) pending.push({ k: 'set', f });
      doc = updateState(doc, f);
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
      void o.durable.write(BAK, doc);
      const a = await o.durable.flush(o.key);
      const b = await o.durable.flush(BAK);
      return a && b;
    },
    /** Dernière écriture demandée (tests). */
    lastWrite: () => lastWrite,
    /** Après « Effacer toutes les données ». */
    reset() {
      doc = newDoc(o.makeDev());
      pending = [];
      emit();
    },
  };
}
export type TasbihStore = ReturnType<typeof createTasbihStore>;
