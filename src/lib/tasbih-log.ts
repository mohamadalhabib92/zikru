/**
 * Journal du compteur de dhikr (logique pure, testée par scripts/test-tasbih-log.mjs).
 *
 * Chaque lot d'appuis devient un ÉVÉNEMENT immuable identifié par (appareil, numéro de séquence croissant).
 * Le total est DÉRIVÉ du journal : total = base (événements compactés) + somme des événements récents.
 * - fusion idempotente (union par identifiant) : rejouer ou recevoir deux fois un événement ne compte rien de plus ;
 * - curseur Bluetooth par appareil enregistré AVEC le compte (même écriture atomique) : un compteur connecté
 *   ou une bague ne peut pas faire compter deux fois les mêmes appuis après un arrêt brutal de l'app ;
 * - migration sans perte de l'ancien format (« tasbih » v1) : tous les champs sont conservés.
 */
import { applyClicks, type ClickSource, type Tasbih } from './tasbih-core';

export type BleCursor = { id: string; value: number };
/** Événement compact (stocké tel quel) : i = séquence, a = date (ms), s = source, d = dhikr, b = curseur appareil. */
export type TasbihEvent = { dev: string; i: number; n: number; s: ClickSource; a: number; d: string; b?: BleCursor };
export type TasbihDoc = {
  v: 2;
  /** Identifiant aléatoire de cette installation (aucune donnée personnelle). */
  dev: string;
  /** Dernier numéro de séquence attribué (croissant, jamais réutilisé). */
  seq: number;
  /** Appuis déjà compactés hors du journal (ou repris de l'ancien format). */
  base: number;
  log: TasbihEvent[];
  /** Dernière valeur absolue comptée par appareil Bluetooth. */
  ble: Record<string, number>;
  t: Tasbih;
  migratedFrom?: 1;
};

export const TASBIH0: Tasbih = { count: 0, target: 33, dhikrId: 'subhanallah', total: 0, sessions: [] };
/** Taille maximale du journal récent (au-delà, les plus anciens événements sont compactés dans base). */
export const LOG_MAX = 300;

const num = (x: unknown, d = 0) => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? x : d);

function normTasbih(x: unknown): Tasbih {
  const o = (x && typeof x === 'object' ? x : {}) as Partial<Tasbih> & Record<string, unknown>;
  // on garde tous les champs existants (aucune perte), en corrigeant seulement les valeurs invalides
  const t: Tasbih = {
    ...(o as object),
    count: num(o.count),
    target: num(o.target, TASBIH0.target),
    dhikrId: typeof o.dhikrId === 'string' && o.dhikrId ? o.dhikrId : TASBIH0.dhikrId,
    total: num(o.total),
    sessions: Array.isArray(o.sessions) ? o.sessions : [],
  } as Tasbih;
  if (o.deviceCount != null) t.deviceCount = num(o.deviceCount);
  return t;
}

export function sumLog(log: TasbihEvent[]): number {
  let s = 0;
  for (const e of log) s += e.n;
  return s;
}
/** Total dérivé du journal. */
export function derivedTotal(doc: Pick<TasbihDoc, 'base' | 'log'>): number {
  return doc.base + sumLog(doc.log);
}

export function newDoc(dev: string): TasbihDoc {
  return { v: 2, dev, seq: 0, base: 0, log: [], ble: {}, t: { ...TASBIH0, sessions: [] } };
}

/**
 * Lit ce qui est stocké (ancien format v1, v2, rien) et rend un document v2 cohérent, sans jamais perdre d'appuis.
 * Le total retenu est le plus grand entre le total enregistré et le total dérivé du journal.
 */
export function migrate(raw: unknown, makeDev: () => string): TasbihDoc {
  if (raw == null || typeof raw !== 'object') return newDoc(makeDev());
  const r = raw as Partial<TasbihDoc> & Record<string, unknown>;
  if (r.v === 2 && r.t) {
    const log = Array.isArray(r.log) ? r.log.filter((e) => e && typeof e.n === 'number' && e.n > 0 && typeof e.i === 'number') : [];
    const doc: TasbihDoc = {
      ...(r as TasbihDoc),
      v: 2,
      dev: typeof r.dev === 'string' && r.dev ? r.dev : makeDev(),
      seq: Math.max(num(r.seq), ...log.map((e) => e.i)),
      base: num(r.base),
      log,
      ble: r.ble && typeof r.ble === 'object' ? { ...r.ble } : {},
      t: normTasbih(r.t),
    };
    const d = derivedTotal(doc);
    if (doc.t.total > d) doc.base += doc.t.total - d; // total enregistré plus grand : on le garde
    doc.t.total = derivedTotal(doc);
    return doc;
  }
  // Ancien format : l'objet Tasbih lui-même.
  const t = normTasbih(r);
  return { v: 2, dev: makeDev(), seq: 0, base: t.total, log: [], ble: {}, t, migratedFrom: 1 };
}

function compact(doc: TasbihDoc): TasbihDoc {
  if (doc.log.length <= LOG_MAX) return doc;
  const drop = doc.log.length - LOG_MAX;
  return { ...doc, base: doc.base + sumLog(doc.log.slice(0, drop)), log: doc.log.slice(drop) };
}

export type RecordResult = { doc: TasbihDoc; added: number; cycleCompleted: boolean; duplicate: boolean };

/**
 * Enregistre n appuis. Si un curseur Bluetooth est fourni et qu'il a déjà été compté pour cet appareil
 * (même valeur absolue), les appuis sont ignorés : rafale répétée ou rattrapage déjà compté.
 */
export function recordClicks(doc: TasbihDoc, n: number, src: ClickSource, at: number, cursor?: BleCursor): RecordResult {
  const k = Math.floor(n);
  if (!(k > 0)) return { doc, added: 0, cycleCompleted: false, duplicate: false };
  if (cursor && doc.ble[cursor.id] === cursor.value) return { doc, added: 0, cycleCompleted: false, duplicate: true };
  const seq = doc.seq + 1;
  const ev: TasbihEvent = { dev: doc.dev, i: seq, n: k, s: src, a: at, d: doc.t.dhikrId };
  if (cursor) ev.b = cursor;
  const { next, cycleCompleted } = applyClicks(doc.t, k, src);
  const out = compact({
    ...doc,
    seq,
    log: [...doc.log, ev],
    ble: cursor ? { ...doc.ble, [cursor.id]: cursor.value } : doc.ble,
    t: next,
  });
  out.t = { ...out.t, total: derivedTotal(out) };
  return { doc: out, added: k, cycleCompleted, duplicate: false };
}

/** Modification d'état (objectif, dhikr, remise à zéro, clôture de session) : le total reste celui du journal. */
export function updateState(doc: TasbihDoc, f: (t: Tasbih) => Tasbih): TasbihDoc {
  const t = normTasbih(f(doc.t));
  return { ...doc, t: { ...t, total: derivedTotal(doc) } };
}

/** Le Bluetooth confirme une valeur sans nouvel appui (ex. première trame après connexion) : on mémorise le curseur. */
export function setCursor(doc: TasbihDoc, c: BleCursor): TasbihDoc {
  return doc.ble[c.id] === c.value ? doc : { ...doc, ble: { ...doc.ble, [c.id]: c.value } };
}

/** Appareil oublié : son curseur est retiré (une nouvelle association repart de sa valeur du moment). */
export function dropCursor(doc: TasbihDoc, id: string): TasbihDoc {
  if (!(id in doc.ble)) return doc;
  const ble = { ...doc.ble };
  delete ble[id];
  return { ...doc, ble };
}

export const eventKey = (e: Pick<TasbihEvent, 'dev' | 'i'>) => `${e.dev}:${e.i}`;

/** Fusion idempotente de journaux (synchronisation future multi-appareils) : union par (appareil, séquence). */
export function mergeLogs(...logs: TasbihEvent[][]): TasbihEvent[] {
  const m = new Map<string, TasbihEvent>();
  for (const l of logs) for (const e of l) if (!m.has(eventKey(e))) m.set(eventKey(e), e);
  return [...m.values()].sort((x, y) => x.a - y.a || (x.dev < y.dev ? -1 : x.dev > y.dev ? 1 : x.i - y.i));
}

/** Opérations faites AVANT la fin du chargement : rejouées dans l'ordre sur l'état chargé (aucun appui perdu). */
export type PendingOp = { k: 'clicks'; n: number; src: ClickSource; at: number; cursor?: BleCursor } | { k: 'set'; f: (t: Tasbih) => Tasbih } | { k: 'cursor'; c: BleCursor } | { k: 'drop'; id: string };
export function replay(doc: TasbihDoc, ops: PendingOp[]): TasbihDoc {
  let d = doc;
  for (const op of ops) {
    if (op.k === 'clicks') d = recordClicks(d, op.n, op.src, op.at, op.cursor).doc;
    else if (op.k === 'set') d = updateState(d, op.f);
    else if (op.k === 'cursor') d = setCursor(d, op.c);
    else d = dropCursor(d, op.id);
  }
  return d;
}
