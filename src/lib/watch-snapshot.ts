import { FARD_KEYS, type FardKey } from './notify-plan';
import { computeDay, PRAYER_KEYS, type MethodKey, type Place, type PrayerKey } from './prayer';

/** Contrat JSON iPhone → montre. La montre n’a pas la bibliothèque `adhan` : elle affiche ces heures. */
export const WATCH_SCHEMA = 1 as const;
/** Groupe partagé sur la montre (app + complication). Ne traverse pas tout seul vers l’iPhone. */
export const APP_GROUP = 'group.com.vibecode.zikru-76mpdv';
export const SNAPSHOT_KEY = 'zikru.watch.snapshot';
export const WATCH_DAY_COUNT = 8;
export const WATCH_BUNDLE_ID = 'com.vibecode.zikru-76mpdv.watchkitapp';
export const WATCH_WIDGET_BUNDLE_ID = 'com.vibecode.zikru-76mpdv.watchkitapp.widget';

export type WatchPrayer = { key: PrayerKey; at: number };
export type WatchDay = { start: number; prayers: WatchPrayer[] };
export type WatchDhikr = {
  id: string;
  ar: string;
  tr?: string;
  target: number;
  source: string;
  example?: boolean;
};

export type WatchSnapshot = {
  v: typeof WATCH_SCHEMA;
  updatedAt: number;
  placeLabel: string;
  /** Libellés d’interface déjà choisis sur le téléphone. */
  names: Record<PrayerKey, string>;
  ar: Record<PrayerKey, string>;
  days: WatchDay[];
  dhikrs: WatchDhikr[];
  /** Prières pour lesquelles la montre programme un signal court (pas la voix complète). */
  cues: FardKey[];
  /** Minuit local après le dernier jour précalculé. */
  staleAfter: number;
};

export type WatchClick = {
  id: string;
  dhikrId: string;
  delta: number;
  target: number;
  at: number;
};

const PRAYER_SET = new Set<string>(PRAYER_KEYS);
const FARD_SET = new Set<string>(FARD_KEYS);

export function buildWatchSnapshot(input: {
  now: Date;
  place: Place;
  method: MethodKey;
  madhab: 'shafi' | 'hanafi';
  names: Record<PrayerKey, string>;
  ar: Record<PrayerKey, string>;
  dhikrs: WatchDhikr[];
  cues: FardKey[];
  days?: number;
}): WatchSnapshot {
  const n = input.days ?? WATCH_DAY_COUNT;
  const days: WatchDay[] = [];
  for (let i = 0; i < n; i++) {
    const noon = new Date(input.now.getFullYear(), input.now.getMonth(), input.now.getDate() + i, 12, 0, 0, 0);
    const start = new Date(noon.getFullYear(), noon.getMonth(), noon.getDate()).getTime();
    const prayers = computeDay(noon, input.place, input.method, input.madhab).map((p) => ({ key: p.key, at: p.time.getTime() }));
    days.push({ start, prayers });
  }
  const last = days[days.length - 1];
  return {
    v: WATCH_SCHEMA,
    updatedAt: input.now.getTime(),
    placeLabel: input.place.label,
    names: input.names,
    ar: input.ar,
    days,
    dhikrs: input.dhikrs.filter((d) => d.id && d.ar).slice(0, 12),
    cues: input.cues.filter((c) => FARD_SET.has(c)),
    staleAfter: last ? last.start + 86_400_000 : input.now.getTime(),
  };
}

export function dayCovering(snapshot: WatchSnapshot, nowMs: number): WatchDay | null {
  const { days } = snapshot;
  for (let i = 0; i < days.length; i++) {
    const end = i + 1 < days.length ? days[i + 1].start : snapshot.staleAfter;
    if (nowMs >= days[i].start && nowMs < end) return days[i];
  }
  return null;
}

export function nextPrayer(snapshot: WatchSnapshot, nowMs: number): WatchPrayer | null {
  for (const day of snapshot.days) {
    for (const p of day.prayers) if (p.at > nowMs) return p;
  }
  return null;
}

export function countdownParts(ms: number): { h: number; m: number; s: number } {
  const t = Math.max(0, Math.floor(ms / 1000));
  return { h: Math.floor(t / 3600), m: Math.floor((t % 3600) / 60), s: t % 60 };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

export function parseSnapshot(raw: unknown): WatchSnapshot | null {
  if (!isRecord(raw) || raw.v !== WATCH_SCHEMA) return null;
  if (typeof raw.updatedAt !== 'number' || typeof raw.placeLabel !== 'string') return null;
  if (!Array.isArray(raw.days) || typeof raw.staleAfter !== 'number') return null;
  if (!isRecord(raw.names) || !isRecord(raw.ar)) return null;
  const names = {} as Record<PrayerKey, string>;
  const ar = {} as Record<PrayerKey, string>;
  for (const k of PRAYER_KEYS) {
    const n = raw.names[k];
    const a = raw.ar[k];
    if (typeof n !== 'string' || !n || typeof a !== 'string' || !a) return null;
    names[k] = n;
    ar[k] = a;
  }
  const days: WatchDay[] = [];
  for (const d of raw.days) {
    if (!isRecord(d) || typeof d.start !== 'number' || !Array.isArray(d.prayers)) return null;
    const prayers: WatchPrayer[] = [];
    for (const p of d.prayers) {
      if (!isRecord(p) || typeof p.key !== 'string' || !PRAYER_SET.has(p.key) || typeof p.at !== 'number') return null;
      prayers.push({ key: p.key as PrayerKey, at: p.at });
    }
    if (prayers.length !== PRAYER_KEYS.length) return null;
    days.push({ start: d.start, prayers });
  }
  if (!days.length) return null;
  const dhikrs: WatchDhikr[] = [];
  if (Array.isArray(raw.dhikrs)) {
    for (const item of raw.dhikrs) {
      if (!isRecord(item) || typeof item.id !== 'string' || typeof item.ar !== 'string' || !item.ar) continue;
      const target = typeof item.target === 'number' && item.target > 0 ? Math.round(item.target) : 33;
      dhikrs.push({
        id: item.id,
        ar: item.ar,
        tr: typeof item.tr === 'string' ? item.tr : undefined,
        target,
        source: typeof item.source === 'string' ? item.source : '',
        example: item.example === true,
      });
    }
  }
  const cues: FardKey[] = [];
  if (Array.isArray(raw.cues)) {
    for (const c of raw.cues) if (typeof c === 'string' && FARD_SET.has(c)) cues.push(c as FardKey);
  }
  return { v: WATCH_SCHEMA, updatedAt: raw.updatedAt, placeLabel: raw.placeLabel, names, ar, days, dhikrs, cues, staleAfter: raw.staleAfter };
}

const ID_RE = /^[A-Za-z0-9._:-]{8,80}$/;

export function parseClick(raw: unknown): WatchClick | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.id !== 'string' || !ID_RE.test(raw.id)) return null;
  if (typeof raw.dhikrId !== 'string' || raw.dhikrId.length < 1 || raw.dhikrId.length > 80) return null;
  if (typeof raw.delta !== 'number' || !Number.isInteger(raw.delta) || raw.delta < 1 || raw.delta > 100) return null;
  if (typeof raw.target !== 'number' || !Number.isInteger(raw.target) || raw.target < 1 || raw.target > 100_000) return null;
  if (typeof raw.at !== 'number' || !Number.isFinite(raw.at)) return null;
  return { id: raw.id, dhikrId: raw.dhikrId, delta: raw.delta, target: raw.target, at: raw.at };
}

/** Garde les appuis inédits et les marque dans `seen` (déduplication iPhone). */
export function unseenClicks(list: unknown, seen: Set<string>): WatchClick[] {
  const items = Array.isArray(list) ? list : [list];
  const out: WatchClick[] = [];
  for (const item of items) {
    const c = parseClick(item);
    if (!c || seen.has(c.id)) continue;
    seen.add(c.id);
    out.push(c);
  }
  return out;
}
