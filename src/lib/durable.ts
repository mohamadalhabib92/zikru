/**
 * Écritures locales durables (logique pure, sans React ni React Native : testée par scripts/test-durable.mjs).
 *
 * Garanties :
 * - écritures SÉRIALISÉES par clé : jamais deux écritures concurrentes de la même clé, jamais d'ancienne
 *   valeur qui écrase une plus récente ; les écritures rapprochées sont regroupées (seule la dernière part) ;
 * - la valeur est figée (JSON) au moment de l'appel : une mutation ultérieure ne peut pas la corrompre ;
 * - un échec n'est JAMAIS silencieux : il est signalé (issues) et réessayé automatiquement, la dernière
 *   valeur restant en mémoire jusqu'à ce qu'elle soit enregistrée ;
 * - une lecture illisible (JSON corrompu) n'est jamais écrasée en silence : le contenu brut est mis de côté
 *   sous « <clé>.corrupt » et signalé.
 */
export type KV = {
  getItem: (k: string) => Promise<string | null>;
  setItem: (k: string, v: string) => Promise<void>;
  removeItem: (k: string) => Promise<void>;
};
export type StorageIssue = { key: string; op: 'write' | 'read'; message: string; at: number; attempts: number };
export type ReadResult<T> = { value: T; status: 'ok' | 'missing' | 'corrupt' | 'error'; error?: string };

type Slot = {
  latest: string | null; // valeur en attente d'écriture (null = rien en attente)
  version: number; // version de la dernière valeur demandée
  committed: number; // version de la dernière valeur enregistrée
  inflight: Promise<void> | null;
  attempts: number;
  retry: ReturnType<typeof setTimeout> | null;
  waiters: { v: number; done: (ok: boolean) => void }[];
};

export const DEFAULT_RETRY_MS = [500, 1000, 2000, 5000, 10000, 30000];

export function createDurable(kv: KV, opts: { retryMs?: number[]; now?: () => number } = {}) {
  const retryMs = opts.retryMs ?? DEFAULT_RETRY_MS;
  const now = opts.now ?? Date.now;
  const slots = new Map<string, Slot>();
  const issues = new Map<string, StorageIssue>();
  const subs = new Set<() => void>();
  let snapshot: StorageIssue[] = [];
  let epoch = 0; // incrémenté par cancelAll() (effacement des données) : les écritures en attente sont abandonnées
  const emit = () => {
    snapshot = [...issues.values()];
    subs.forEach((f) => {
      try {
        f();
      } catch {
        // un abonné défaillant ne bloque pas les autres
      }
    });
  };
  const report = (key: string, op: StorageIssue['op'], e: unknown, attempts: number) => {
    issues.set(`${op}:${key}`, { key, op, message: e instanceof Error ? e.message : String(e), at: now(), attempts });
    emit();
  };
  const clear = (key: string, op: StorageIssue['op']) => {
    if (issues.delete(`${op}:${key}`)) emit();
  };
  const slot = (key: string): Slot => {
    let s = slots.get(key);
    if (!s) {
      s = { latest: null, version: 0, committed: 0, inflight: null, attempts: 0, retry: null, waiters: [] };
      slots.set(key, s);
    }
    return s;
  };
  const settle = (s: Slot, ok: boolean, upTo: number) => {
    const keep: Slot['waiters'] = [];
    for (const w of s.waiters) {
      if (w.v <= upTo) w.done(ok);
      else keep.push(w);
    }
    s.waiters = keep;
  };
  const pump = (key: string, s: Slot) => {
    if (s.inflight || s.retry || s.latest == null) return;
    const raw = s.latest;
    const v = s.version;
    const ep = epoch;
    s.latest = null;
    s.inflight = kv
      .setItem(key, raw)
      .then(
        () => {
          if (ep !== epoch) return;
          s.committed = Math.max(s.committed, v);
          s.attempts = 0;
          clear(key, 'write');
          settle(s, true, v);
        },
        (e: unknown) => {
          if (ep !== epoch) return;
          s.attempts++;
          // la valeur la plus récente reste à écrire (une plus récente a pu arriver entre-temps)
          if (s.latest == null) s.latest = raw;
          report(key, 'write', e, s.attempts);
          // l'appelant est prévenu de l'échec ; l'écriture continue d'être réessayée
          settle(s, false, s.version);
          const d = retryMs[Math.min(s.attempts - 1, retryMs.length - 1)];
          s.retry = setTimeout(() => {
            s.retry = null;
            pump(key, s);
          }, d);
        },
      )
      .finally(() => {
        s.inflight = null;
        if (ep === epoch) pump(key, s);
      });
  };

  return {
    /** Programme l'écriture ; la promesse indique si CETTE valeur (ou une plus récente) a été enregistrée. */
    write(key: string, value: unknown): Promise<boolean> {
      const s = slot(key);
      let raw: string;
      try {
        raw = JSON.stringify(value);
      } catch (e) {
        report(key, 'write', e, 1);
        return Promise.resolve(false);
      }
      s.latest = raw;
      s.version++;
      const v = s.version;
      const p = new Promise<boolean>((done) => s.waiters.push({ v, done }));
      pump(key, s);
      return p;
    },
    /** Attend que toutes les écritures demandées (une clé ou toutes) aient été tentées ; true si tout est enregistré. */
    async flush(key?: string): Promise<boolean> {
      const keys = key ? [key] : [...slots.keys()];
      const res = await Promise.all(
        keys.map((k) => {
          const s = slots.get(k);
          if (!s || s.version === s.committed) return true;
          if (s.retry) {
            // nouvel essai immédiat (passage en arrière-plan, bouton « Réessayer »)
            clearTimeout(s.retry);
            s.retry = null;
          }
          const p = new Promise<boolean>((done) => s.waiters.push({ v: s.version, done }));
          pump(k, s);
          return p;
        }),
      );
      return res.every(Boolean);
    },
    /** Des écritures attendent-elles encore (ou échouent-elles) ? */
    pending(key?: string): boolean {
      if (key) {
        const s = slots.get(key);
        return !!s && s.version !== s.committed;
      }
      for (const s of slots.values()) if (s.version !== s.committed) return true;
      return false;
    },
    async read<T>(key: string, fallback: T): Promise<ReadResult<T>> {
      let raw: string | null;
      try {
        raw = await kv.getItem(key);
      } catch (e) {
        report(key, 'read', e, 1);
        return { value: fallback, status: 'error', error: String(e) };
      }
      if (raw == null) return { value: fallback, status: 'missing' };
      try {
        const v = JSON.parse(raw) as T;
        clear(key, 'read');
        return { value: v, status: 'ok' };
      } catch (e) {
        // jamais d'écrasement silencieux : on conserve le contenu illisible
        await kv.setItem(key + '.corrupt', raw).catch(() => {});
        report(key, 'read', new Error('Données illisibles (copie conservée sous ' + key + '.corrupt)'), 1);
        return { value: fallback, status: 'corrupt', error: String(e) };
      }
    },
    /** Abandonne toutes les écritures en attente (avant un effacement complet des données). */
    cancelAll() {
      epoch++;
      for (const s of slots.values()) {
        if (s.retry) clearTimeout(s.retry);
        settle(s, false, Number.MAX_SAFE_INTEGER);
      }
      slots.clear();
      issues.clear();
      emit();
    },
    issues: () => snapshot,
    dismiss(key: string) {
      clear(key, 'read');
    },
    subscribe(f: () => void) {
      subs.add(f);
      return () => {
        subs.delete(f);
      };
    },
  };
}
export type Durable = ReturnType<typeof createDurable>;
