/**
 * Zikru P1 — file d'attente hors-ligne des événements de comptage (BROUILLON, non branché).
 *
 * Logique PURE : aucune dépendance React / React Native / Supabase, donc testable avec jest
 * (voir __tests__/counterQueue.test.ts). Le hook useGroupCounter s'occupe du stockage et du réseau.
 *
 * Modèle (identique côté serveur, table public.counter_events) :
 *   événement = (deviceId, seq, goalId, count, at, source)
 *   clé unique = (deviceId, seq, goalId) → un renvoi est reconnu comme doublon, jamais recompté.
 *
 * Garanties :
 *   1. Chaque lot scellé reçoit un seq strictement croissant. L'appelant DOIT persister l'état
 *      renvoyé par seal() AVANT d'envoyer quoi que ce soit (sinon, après un plantage, un seq
 *      pourrait être réattribué à d'autres dhikr qui seraient alors pris pour des doublons).
 *   2. Un événement déjà envoyé (même sans réponse reçue) n'est plus jamais modifié ni fusionné.
 *   3. Affichage = total serveur + compte local non acquitté → pas de double comptage à l'écran.
 *   4. L'identifiant d'appareil et le seq sont stockés ENSEMBLE : si l'état est perdu ou illisible,
 *      on crée un NOUVEL identifiant d'appareil plutôt que de repartir à seq = 1.
 */

export type CounterSource = 'ecran' | 'bague' | 'montre' | 'clavier' | 'bluetooth';

export interface CounterEvent {
  seq: number;
  goal_id: string;
  count: number;
  /** Horodatage ISO 8601 du dernier appui du lot. */
  at: string;
  source: CounterSource;
  /** true dès la première tentative d'envoi : l'événement devient immuable. */
  sent: boolean;
}

interface OpenBatch {
  count: number;
  at: string;
  source: CounterSource;
}

export interface QueueState {
  v: 1;
  deviceId: string;
  /** Prochain seq à attribuer (≥ 1). */
  nextSeq: number;
  /** Appareil déclaré au serveur (register_device) ? */
  registered: boolean;
  /** Appuis pas encore scellés, par objectif. */
  open: Record<string, OpenBatch>;
  /** Événements scellés, pas encore acquittés par le serveur (ordre de seq croissant). */
  pending: CounterEvent[];
}

/** Réponse de public.ingest_counter_events (voir la migration P1). */
export interface IngestResult {
  accepted: number;
  duplicates: number;
  acked: { seq: number; goal_id: string }[];
  rejected: { seq: number | null; goal_id: string | null; reason: string }[];
  totals: Record<string, number>;
}

export const MAX_EVENT_COUNT = 1000; // = contrainte SQL count between 1 and 1000
export const MAX_BATCH = 500; // = limite de l'RPC
export const MAX_PENDING = 20000; // au-delà, on compacte les événements jamais envoyés

const key = (seq: number | null, goal: string | null) => `${seq}:${goal}`;

export function createQueue(deviceId: string): QueueState {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(deviceId)) {
    throw new Error('deviceId doit être un UUID v4');
  }
  return { v: 1, deviceId, nextSeq: 1, registered: false, open: {}, pending: [] };
}

/** UUID v4 à partir de 16 octets aléatoires (fournis par expo-crypto côté app). */
export function uuidV4(random16: Uint8Array): string {
  if (random16.length < 16) throw new Error('16 octets requis');
  const b = Array.from(random16.slice(0, 16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = b.map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/**
 * Seal = transforme les lots ouverts (tous, ou ceux des objectifs donnés) en événements.
 * Un seul seq est partagé par tous les objectifs scellés ensemble (fan-out autorisé par la clé SQL).
 */
export function seal(s: QueueState, goalIds?: string[]): QueueState {
  const ids = (goalIds ?? Object.keys(s.open)).filter((g) => s.open[g] && s.open[g].count > 0);
  if (ids.length === 0) return s;
  const seq = s.nextSeq;
  const open = { ...s.open };
  const events: CounterEvent[] = ids.map((g) => {
    const b = open[g];
    delete open[g];
    return { seq, goal_id: g, count: b.count, at: b.at, source: b.source, sent: false };
  });
  return { ...s, nextSeq: seq + 1, open, pending: [...s.pending, ...events] };
}

/**
 * Ajoute n appuis à chaque objectif lié. Un lot est scellé automatiquement s'il atteint
 * MAX_EVENT_COUNT ou si la source change (bague puis écran, par exemple).
 */
export function addTaps(s: QueueState, goalIds: string[], n: number, source: CounterSource, now: Date): QueueState {
  if (!Number.isInteger(n) || n < 1) return s;
  let st = s;
  const at = now.toISOString();
  for (const g of new Set(goalIds)) {
    let left = n;
    while (left > 0) {
      const cur = st.open[g];
      if (cur && cur.source !== source) st = seal(st, [g]);
      const base = st.open[g]?.count ?? 0;
      const take = Math.min(left, MAX_EVENT_COUNT - base);
      st = { ...st, open: { ...st.open, [g]: { count: base + take, at, source } } };
      left -= take;
      if (base + take >= MAX_EVENT_COUNT) st = seal(st, [g]);
    }
  }
  return st;
}

/** Prochain lot à envoyer (événements scellés, dans l'ordre). */
export function nextBatch(s: QueueState, max = MAX_BATCH): CounterEvent[] {
  return s.pending.slice(0, Math.min(max, MAX_BATCH));
}

/** À appeler (et à persister) juste AVANT l'envoi réseau. */
export function markSent(s: QueueState, batch: CounterEvent[]): QueueState {
  const ks = new Set(batch.map((e) => key(e.seq, e.goal_id)));
  return { ...s, pending: s.pending.map((e) => (ks.has(key(e.seq, e.goal_id)) ? { ...e, sent: true } : e)) };
}

/** Retire de la file tout ce que le serveur a acquitté ou rejeté définitivement. */
export function applyResult(s: QueueState, r: IngestResult): QueueState {
  const done = new Set<string>();
  for (const a of r.acked) done.add(key(a.seq, a.goal_id));
  for (const x of r.rejected) done.add(key(x.seq, x.goal_id));
  if (done.size === 0) return s;
  return { ...s, pending: s.pending.filter((e) => !done.has(key(e.seq, e.goal_id))) };
}

/** Compte local pas encore acquitté pour un objectif (lots ouverts + scellés). */
export function localPending(s: QueueState, goalId: string): number {
  let n = s.open[goalId]?.count ?? 0;
  for (const e of s.pending) if (e.goal_id === goalId) n += e.count;
  return n;
}

/** Valeur à afficher : total connu du serveur + local non acquitté. */
export function displayTotal(serverTotal: number, s: QueueState, goalId: string): number {
  return Math.max(0, serverTotal) + localPending(s, goalId);
}

/**
 * Fusionne un total reçu (réponse d'ingestion ou broadcast Realtime) avec le total connu.
 * Les messages Realtime peuvent arriver dans le désordre : on garde le plus récent par horodatage,
 * et à horodatage égal (ou absent) le plus grand.
 */
export function mergeServerTotal(
  known: { total: number; at: number } | undefined,
  incoming: { total: number; at?: string | number },
): { total: number; at: number } {
  const at = typeof incoming.at === 'string' ? Date.parse(incoming.at) : incoming.at ?? 0;
  const t = Number.isFinite(at) ? (at as number) : 0;
  if (!known) return { total: incoming.total, at: t };
  if (t > known.at) return { total: incoming.total, at: t };
  if (t === known.at) return { total: Math.max(known.total, incoming.total), at: t };
  return known;
}

/**
 * Compaction si la file dépasse MAX_PENDING (des semaines hors-ligne) : fusionne uniquement les
 * événements JAMAIS envoyés d'un même objectif et d'une même source, en gardant le plus petit seq.
 * Sûr, car le serveur n'a jamais vu ces seq. Les événements déjà envoyés restent intacts.
 */
export function compact(s: QueueState): QueueState {
  if (s.pending.length <= MAX_PENDING) return s;
  const out: CounterEvent[] = [];
  const openIdx = new Map<string, number>();
  for (const e of s.pending) {
    if (e.sent) {
      out.push(e);
      continue;
    }
    const k = `${e.goal_id}|${e.source}`;
    const i = openIdx.get(k);
    if (i !== undefined && out[i].count + e.count <= MAX_EVENT_COUNT) {
      out[i] = { ...out[i], count: out[i].count + e.count, at: e.at > out[i].at ? e.at : out[i].at };
    } else {
      openIdx.set(k, out.length);
      out.push({ ...e });
    }
  }
  return { ...s, pending: out };
}

export function serialize(s: QueueState): string {
  return JSON.stringify(s);
}

/** Relit l'état persistant ; renvoie null s'il est absent ou corrompu (→ nouvel appareil). */
export function deserialize(raw: string | null | undefined): QueueState | null {
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as Partial<QueueState>;
    if (s.v !== 1 || typeof s.deviceId !== 'string' || !Number.isSafeInteger(s.nextSeq) || (s.nextSeq as number) < 1) return null;
    if (!Array.isArray(s.pending) || typeof s.open !== 'object' || s.open === null) return null;
    const maxSeq = s.pending.reduce((m, e) => Math.max(m, Number(e?.seq) || 0), 0);
    if (maxSeq >= (s.nextSeq as number)) return null; // incohérent : ne jamais risquer un seq réutilisé
    return { v: 1, deviceId: s.deviceId, nextSeq: s.nextSeq as number, registered: !!s.registered, open: s.open, pending: s.pending };
  } catch {
    return null;
  }
}
