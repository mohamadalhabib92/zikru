/**
 * Synchro du compteur avec l’Apple Watch. Logique pure, sans React ni WatchConnectivity.
 *
 * Chaque séance a un identifiant stable. `count` est le TOTAL de cette séance, jamais un delta.
 * - le même identifiant relu deux fois n’ajoute rien ;
 * - un total plus petit (paquet ancien) ne retire rien et ne remplace pas le plus grand ;
 * - seul l’écart (nouveau − déjà écrit) entre dans le journal ou dans le total « externe » ;
 * - une séance venue du téléphone n’est pas réappliquée : ces appuis sont déjà dans le compteur.
 *
 * Le compteur de la montre est gratuit. Ce module ne connaît pas Premium.
 */
import type { Tasbih, TasbihSession } from './tasbih-core';
import { recordClicks, type TasbihDoc } from './tasbih-log';

export const WATCH_COUNTER_IS_FREE = true as const;
export const WATCH_PROTOCOL = 1;
/** Au-delà, on retire des étapes en partant de la fin. Le texte arabe d’une étape n’est pas coupé. */
export const CATALOG_JSON_MAX = 60_000;
const MAX_COUNT = 1_000_000;
const MAX_ITEMS = 40;

export type WatchOrigin = 'phone' | 'watch';
export type WatchLang = 'fr' | 'en';
export type HapticKind = 'tap' | 'round' | 'goal';

export type WatchSession = {
  id: string;
  zikrId: string;
  alias?: string;
  count: number;
  round: number;
  goal: number;
  at: number;
  origin: WatchOrigin;
};

/** État rangé dans le document tasbih, dans la même écriture que le journal. */
export type WatchMeta = {
  v: 1;
  /** Total de séance déjà accepté, par identifiant. */
  applied: Record<string, number>;
  /** Partie de `applied` déjà écrite dans le journal (le reste est « externe »). */
  logged: Record<string, number>;
  /** Partie du compte affiché qui vient déjà de la montre. */
  live: number;
  phoneId: string;
  phoneZikr: string;
  phoneCount: number;
  /** Dernier compte affiché vu : une baisse (remise à zéro, clôture) change d’époque. */
  lastDisplay: number;
  epochs: Record<string, number>;
  foreign: WatchSession[];
};

export type WatchZikr = {
  id: string;
  ar: string;
  label: string;
  round: number;
  goal: number;
  alias?: string;
};

export type WatchCatalog = {
  v: 1;
  kind: 'catalog';
  lang: WatchLang;
  today: WatchZikr[];
  composition: WatchZikr[];
  compositionTitle: string;
  prefer: 'today' | 'composition';
  activeId: string;
  phone: WatchSession;
  applied: Record<string, number>;
  epochs: Record<string, number>;
  at: number;
};

export type MergeResult = {
  doc: TasbihDoc;
  added: number;
  addedLive: number;
  touched: string[];
};

const floor = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) ? Math.floor(n) : 0);

/** Anglais si le téléphone est en anglais, français pour toutes les autres langues (y compris l’arabe). */
export function watchLang(lang: string): WatchLang {
  return lang === 'en' || lang.startsWith('en-') ? 'en' : 'fr';
}

/**
 * Taille d’un tour : 33, 99 ou 100 si c’est déjà la cible ; la cible elle-même si elle est plus courte ;
 * 33 si la cible est plus longue (le palier fort reste la cible) ou si le compte est ouvert.
 */
export function roundFor(goal: number): number {
  const g = Math.floor(goal);
  if (g === 33 || g === 99 || g === 100) return g;
  if (g > 100) return 33;
  if (g > 0) return g;
  return 33;
}

/** Un seul retour pour une rafale : l’objectif gagne sur le tour, le tour gagne sur le clic. */
export function hapticFor(prev: number, next: number, round: number, goal: number): HapticKind {
  const a = Math.floor(prev);
  const b = Math.floor(next);
  if (!(b > a)) return 'tap';
  const hit = (step: number) => {
    if (!(step > 0)) return false;
    for (let n = a + 1; n <= b; n++) if (n % step === 0) return true;
    return false;
  };
  if (hit(goal)) return 'goal';
  if (round !== goal && hit(round)) return 'round';
  return 'tap';
}

export function isWatchSession(x: unknown): x is WatchSession {
  if (!x || typeof x !== 'object') return false;
  const s = x as Partial<WatchSession>;
  if (typeof s.id !== 'string' || s.id.trim().length < 1 || s.id.length > 80) return false;
  if (typeof s.zikrId !== 'string' || s.zikrId.trim().length < 1 || s.zikrId.length > 200) return false;
  if (s.alias != null && (typeof s.alias !== 'string' || s.alias.length > 240)) return false;
  if (typeof s.count !== 'number' || !Number.isFinite(s.count) || s.count < 0 || s.count > MAX_COUNT) return false;
  if (s.origin !== 'phone' && s.origin !== 'watch') return false;
  if (typeof s.at !== 'number' || !Number.isFinite(s.at)) return false;
  if (s.round != null && (typeof s.round !== 'number' || !Number.isFinite(s.round) || s.round < 0 || s.round > MAX_COUNT)) return false;
  if (s.goal != null && (typeof s.goal !== 'number' || !Number.isFinite(s.goal) || s.goal < 0 || s.goal > MAX_COUNT)) return false;
  return true;
}

function asSession(x: unknown): WatchSession | null {
  if (!isWatchSession(x)) return null;
  const s = x;
  return {
    id: s.id.trim(),
    zikrId: s.zikrId.trim(),
    ...(s.alias ? { alias: s.alias } : {}),
    count: Math.floor(s.count),
    round: Math.floor(s.round ?? 0),
    goal: Math.floor(s.goal ?? 0),
    at: s.at,
    origin: s.origin,
  };
}

export function sessionsFromPayload(raw: unknown): WatchSession[] {
  let value = raw;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (!value || typeof value !== 'object') return [];
  const o = value as { kind?: string; sessions?: unknown };
  if (o.kind === 'catalog') return [];
  const list = Array.isArray(o.sessions) ? o.sessions : Array.isArray(value) ? value : [];
  const out: WatchSession[] = [];
  for (const item of list) {
    const s = asSession(item);
    if (s) out.push(s);
  }
  return out;
}

export function watchMetaOf(doc: TasbihDoc, makeId: () => string): WatchMeta {
  const w = doc.watch;
  const zikr = doc.t.dhikrId;
  if (w && w.v === 1 && w.applied && typeof w.applied === 'object' && typeof w.phoneId === 'string' && w.phoneId) {
    const applied: Record<string, number> = {};
    for (const [id, n] of Object.entries(w.applied)) if (id && floor(n) > 0) applied[id] = floor(n);
    const logged: Record<string, number> = {};
    for (const [id, n] of Object.entries(w.logged ?? {})) if (id in applied) logged[id] = Math.min(applied[id], Math.max(0, floor(n)));
    const epochs: Record<string, number> = {};
    for (const [id, n] of Object.entries(w.epochs ?? {})) if (id && floor(n) >= 0) epochs[id] = floor(n);
    const foreign = (Array.isArray(w.foreign) ? w.foreign : []).map(asSession).filter((s): s is WatchSession => !!s && s.origin === 'watch');
    return {
      v: 1,
      applied,
      logged,
      live: Math.max(0, Math.min(floor(w.live), doc.t.count)),
      phoneId: w.phoneId,
      phoneZikr: typeof w.phoneZikr === 'string' && w.phoneZikr ? w.phoneZikr : zikr,
      phoneCount: Math.max(0, floor(w.phoneCount)),
      lastDisplay: Math.max(0, floor(w.lastDisplay)),
      epochs,
      foreign,
    };
  }
  return { v: 1, applied: {}, logged: {}, live: 0, phoneId: makeId(), phoneZikr: zikr, phoneCount: 0, lastDisplay: 0, epochs: {}, foreign: [] };
}

function externalOf(meta: WatchMeta): number {
  let n = 0;
  for (const id of Object.keys(meta.applied)) n += Math.max(0, meta.applied[id] - (meta.logged[id] ?? 0));
  return n;
}

function withExternal(t: Tasbih, meta: WatchMeta): Tasbih {
  const extra = externalOf(meta);
  if (extra <= 0) {
    if (t.externalTotal == null) return t;
    const rest = { ...t };
    delete rest.externalTotal;
    return rest;
  }
  return { ...t, externalTotal: extra };
}

function upsertForeign(list: WatchSession[], s: WatchSession): WatchSession[] {
  const i = list.findIndex((x) => x.id === s.id);
  if (i < 0) return [...list, s];
  const next = list.slice();
  next[i] = s;
  return next;
}

function upsertHistory(t: Tasbih, s: WatchSession, logged: number): Tasbih {
  const shown = Math.max(0, s.count - logged);
  const i = t.sessions.findIndex((x) => x.id === s.id);
  if (shown <= 0) {
    if (i < 0) return t;
    return { ...t, sessions: t.sessions.filter((x) => x.id !== s.id) };
  }
  const row: TasbihSession = {
    id: s.id,
    dhikrId: s.zikrId,
    count: shown,
    target: s.goal > 0 ? s.goal : s.round > 0 ? s.round : 33,
    at: new Date(s.at > 0 ? s.at : Date.now()).toISOString(),
    source: 'watch',
    sealed: true,
    external: true,
  };
  const sessions = t.sessions.slice();
  if (i >= 0) sessions[i] = { ...sessions[i], ...row };
  else sessions.unshift(row);
  return { ...t, sessions: sessions.slice(0, 200) };
}

function sameZikr(doc: TasbihDoc, s: WatchSession): boolean {
  return s.zikrId === doc.t.dhikrId || (s.alias != null && s.alias === doc.t.dhikrId);
}

/**
 * Fusionne des séances montre dans le document. Ne perd pas les appuis déjà là.
 * Ne compte pas deux fois le même identifiant.
 */
export function mergeWatchSessions(doc: TasbihDoc, incoming: unknown[], makeId: () => string): MergeResult {
  let meta = watchMetaOf(doc, makeId);
  if (doc.t.count < meta.live) meta = { ...meta, live: doc.t.count };
  let working = doc;
  let added = 0;
  let addedLive = 0;
  const touched: string[] = [];
  const list = incoming.map(asSession).filter((s): s is WatchSession => !!s);
  list.sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  for (const s of list) {
    if (s.origin !== 'watch') continue;
    const prev = meta.applied[s.id] ?? 0;
    if (s.count <= prev) continue;
    const delta = s.count - prev;
    const loggedBefore = meta.logged[s.id] ?? 0;
    const wasForeign = meta.foreign.some((f) => f.id === s.id);
    const asLive = !wasForeign && sameZikr(working, s);
    if (asLive) {
      working = recordClicks(working, delta, 'watch', s.at).doc;
      meta = {
        ...meta,
        live: meta.live + delta,
        applied: { ...meta.applied, [s.id]: s.count },
        logged: { ...meta.logged, [s.id]: loggedBefore + delta },
      };
      addedLive += delta;
    } else {
      const next = { ...s, count: s.count };
      meta = {
        ...meta,
        applied: { ...meta.applied, [s.id]: s.count },
        logged: { ...meta.logged, [s.id]: loggedBefore },
        foreign: upsertForeign(meta.foreign, next),
      };
      working = { ...working, t: upsertHistory(working.t, next, loggedBefore) };
    }
    added += delta;
    touched.push(s.id);
  }
  working = { ...working, t: withExternal(working.t, meta), watch: meta };
  return { doc: working, added, addedLive, touched };
}

/** Compte téléphone seul : le total affiché moins ce que la montre y a déjà mis. */
export function phoneOnlyCount(doc: TasbihDoc, makeId: () => string): number {
  const meta = watchMetaOf(doc, makeId);
  const live = doc.t.count < meta.live ? doc.t.count : meta.live;
  return Math.max(0, doc.t.count - live);
}

/**
 * Séance ouverte du téléphone, à envoyer à la montre. Une baisse du compte affiché
 * (remise à zéro, fin de séance) change l’époque de ce zikr : la montre ouvre une séance neuve.
 */
export function syncPhoneSession(doc: TasbihDoc, now: number, makeId: () => string): { doc: TasbihDoc; session: WatchSession; changed: boolean } {
  let meta = watchMetaOf(doc, makeId);
  let changed = !doc.watch;
  if (meta.phoneZikr !== doc.t.dhikrId) {
    if (meta.lastDisplay > 0) {
      meta = { ...meta, epochs: { ...meta.epochs, [meta.phoneZikr]: (meta.epochs[meta.phoneZikr] ?? 0) + 1 } };
    }
    meta = { ...meta, phoneZikr: doc.t.dhikrId, phoneId: makeId(), live: 0, phoneCount: 0 };
    changed = true;
  } else if (doc.t.count < meta.lastDisplay) {
    meta = {
      ...meta,
      phoneId: makeId(),
      live: Math.min(meta.live, doc.t.count),
      epochs: { ...meta.epochs, [doc.t.dhikrId]: (meta.epochs[doc.t.dhikrId] ?? 0) + 1 },
    };
    changed = true;
  }
  const phoneOnly = Math.max(0, doc.t.count - meta.live);
  if (meta.phoneCount !== phoneOnly || meta.lastDisplay !== doc.t.count) {
    meta = { ...meta, phoneCount: phoneOnly, lastDisplay: doc.t.count };
    changed = true;
  }
  const goal = doc.t.target > 0 ? doc.t.target : 0;
  const session: WatchSession = {
    id: meta.phoneId,
    zikrId: doc.t.dhikrId,
    count: phoneOnly,
    round: roundFor(goal),
    goal,
    at: now,
    origin: 'phone',
  };
  return { doc: changed ? { ...doc, watch: meta } : doc, session, changed };
}

export type CatalogSource = {
  lang: string;
  today: { id: string; ar: string; label: string; goal: number }[];
  composition: { id: string; ar: string; label: string; goal: number; alias?: string }[];
  compositionTitle: string;
  activeId: string;
  phone: WatchSession;
  applied: Record<string, number>;
  epochs: Record<string, number>;
  now: number;
};

function zikrOf(x: { id: string; ar: string; label: string; goal: number; alias?: string }): WatchZikr | null {
  const ar = x.ar.normalize('NFC').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim();
  const id = x.id.trim();
  if (!id || !ar) return null;
  const goal = Math.max(0, Math.min(MAX_COUNT, Math.floor(x.goal) || 0));
  const z: WatchZikr = { id: id.slice(0, 80), ar, label: (x.label || ar).slice(0, 80), round: roundFor(goal), goal };
  if (x.alias?.trim()) z.alias = x.alias.trim().slice(0, 240);
  return z;
}

/** Liste du jour et composition courante. L’arabe vocalisé est gardé entier ; on enlève des étapes si le paquet est trop gros. */
export function buildCatalog(src: CatalogSource): WatchCatalog {
  const today = src.today.map(zikrOf).filter((z): z is WatchZikr => !!z).slice(0, MAX_ITEMS);
  let composition = src.composition.map(zikrOf).filter((z): z is WatchZikr => !!z).slice(0, MAX_ITEMS);
  const prefer: WatchCatalog['prefer'] = composition.some((z) => z.id === src.activeId || z.alias === src.activeId) ? 'composition' : 'today';
  const applied: Record<string, number> = {};
  const ids = Object.keys(src.applied);
  for (const id of ids.slice(Math.max(0, ids.length - 200))) applied[id] = Math.max(0, Math.floor(src.applied[id]) || 0);
  const catalog = (comp: WatchZikr[]): WatchCatalog => ({
    v: 1,
    kind: 'catalog',
    lang: watchLang(src.lang),
    today,
    composition: comp,
    compositionTitle: src.compositionTitle.slice(0, 80),
    prefer,
    activeId: src.activeId.slice(0, 200),
    phone: src.phone,
    applied,
    epochs: src.epochs,
    at: src.now,
  });
  while (composition.length && JSON.stringify(catalog(composition)).length > CATALOG_JSON_MAX) composition = composition.slice(0, -1);
  return catalog(composition);
}

export function sessionsPayload(sessions: WatchSession[]): string {
  return JSON.stringify({ v: WATCH_PROTOCOL, kind: 'sessions', sessions });
}
