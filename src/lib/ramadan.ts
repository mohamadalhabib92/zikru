/**
 * Mode Ramadan (Pass 4) — module PUR, sans dépendance native, testé par scripts/test-ramadan.mjs.
 *
 * - Activation automatique à partir de la source hégirienne UNIQUE (hijri.ts : calendrier choisi + décalage ±2 j),
 *   avec confirmation locale (« Ramadan a commencé chez moi aujourd’hui / hier / demain ») qui règle le décalage
 *   hégirien de toute l’app — aucune seconde source de dates.
 * - Forçage manuel (activer / désactiver pour l’année) : l’observation locale du croissant prime toujours.
 * - Compte à rebours suhur / iftar : fin du suhur = Fajr calculé − marge d’imsak CHOISIE par l’utilisateur
 *   (0 min par défaut : aucune marge inventée) ; iftar = Maghrib calculé.
 * - Suivis privés, locaux (jeûne, tarawih) : jamais de série cassée, jours de dispense neutres.
 * - Zakat al-fitr : montant saisi par l’utilisateur ou sa mosquée — jamais un montant proposé par l’app.
 */
import { hijriToDate, monthLength, toHijri, type HijriCalendar } from './hijri';

export type FastMark = 'fasted' | 'excused' | 'missed';
export type RamadanYearLog = { fast: Record<string, FastMark>; tarawih: Record<string, true> };
export type ZakatFitr = {
  /** Rappel activé (désactivé par défaut). */
  on: boolean;
  /** Montant par personne, saisi tel quel (ex. « 12 CHF ») — jamais proposé par l’app. */
  amount: string;
  /** Qui l’a indiqué (ex. « ma mosquée »). */
  source: string;
  /** Nombre de personnes à charge (1 par défaut). */
  people: number;
  /** Jour du rappel (AAAA-MM-JJ), choisi par l’utilisateur. */
  date: string | null;
  paid: boolean;
};
export type RamadanNotif = { suhur: boolean; suhurLead: number; iftar: boolean; quietOverride: boolean };
export type RamadanPrefs = {
  /** auto : suit le calendrier ; off : jamais de mode Ramadan. */
  mode: 'auto' | 'off';
  /** Forçage pour une année hégirienne (observation locale). */
  override?: { year: number; mode: 'on' | 'off' };
  /** Début / fin confirmés localement pour une année. */
  confirmed?: { year: number; start?: string; end?: string };
  /** Questions déjà écartées (« 1447-start », « 1447-end »). */
  dismissed: string[];
  /** Marge de précaution avant le Fajr, en minutes : choix de l’utilisateur, 0 par défaut. */
  imsakMin: number;
  notif: RamadanNotif;
  /** Suivi privé des jours à rattraper (désactivé par défaut) et jours déjà rattrapés. */
  makeup: boolean;
  makeupDone: number;
  zakat: ZakatFitr;
  log: Record<string, RamadanYearLog>;
};
export const IMSAK_OPTIONS = [0, 5, 10, 15, 20];
export const SUHUR_LEAD_OPTIONS = [15, 30, 45, 60, 90];
export const DEFAULT_RAMADAN: RamadanPrefs = {
  mode: 'auto',
  dismissed: [],
  imsakMin: 0,
  notif: { suhur: false, suhurLead: 45, iftar: false, quietOverride: false },
  makeup: false,
  makeupDone: 0,
  zakat: { on: false, amount: '', source: '', people: 1, date: null, paid: false },
  log: {},
};
const int = (v: unknown, lo: number, hi: number, d: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, Math.round(v))) : d);
export function normalizeRamadan(v: unknown): RamadanPrefs {
  const o = (v && typeof v === 'object' ? v : {}) as Partial<RamadanPrefs>;
  const n = (o.notif ?? {}) as Partial<RamadanNotif>;
  const z = (o.zakat ?? {}) as Partial<ZakatFitr>;
  return {
    mode: o.mode === 'off' ? 'off' : 'auto',
    override: o.override && (o.override.mode === 'on' || o.override.mode === 'off') ? o.override : undefined,
    confirmed: o.confirmed && typeof o.confirmed.year === 'number' ? o.confirmed : undefined,
    dismissed: Array.isArray(o.dismissed) ? o.dismissed.filter((x) => typeof x === 'string').slice(-20) : [],
    imsakMin: int(o.imsakMin, 0, 60, 0),
    notif: { suhur: n.suhur === true, suhurLead: int(n.suhurLead, 5, 180, 45), iftar: n.iftar === true, quietOverride: n.quietOverride === true },
    makeup: o.makeup === true,
    makeupDone: int(o.makeupDone, 0, 999, 0),
    zakat: { on: z.on === true, amount: typeof z.amount === 'string' ? z.amount.slice(0, 40) : '', source: typeof z.source === 'string' ? z.source.slice(0, 60) : '', people: int(z.people, 1, 30, 1), date: typeof z.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(z.date) ? z.date : null, paid: z.paid === true },
    log: o.log && typeof o.log === 'object' ? o.log : {},
  };
}

// ——— Dates (jours civils locaux, clés AAAA-MM-JJ) ———
const two = (n: number) => String(n).padStart(2, '0');
export const dayKey = (d: Date) => `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
export const fromKey = (k: string) => {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
};
export const addDays = (k: string, n: number) => {
  const d = fromKey(k);
  return dayKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, 12));
};
/** Jours civils de a à b (b − a), insensible aux changements d’heure. */
export const daysBetween = (a: string, b: string) => Math.round((Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10)) - Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10))) / 86400000);

export type RamadanStatus = {
  year: number;
  start: string;
  end: string;
  length: number;
  phase: 'before' | 'during' | 'after';
  /** Jour de jeûne (1…length) pendant ; 0 sinon. */
  day: number;
  /** Jours avant le début (phase « before »). */
  daysUntil: number;
  /** Mode Ramadan actif aujourd’hui. */
  active: boolean;
  /** Origine des dates : calcul (calendrier + décalage) ou confirmation locale. */
  source: 'calc' | 'confirmed';
  /** Question à poser : début (2 j avant → 3e jour), fin (29e jour), ou rien. */
  ask: 'start' | 'end' | null;
};

/** Année hégirienne du Ramadan « courant » : celui en cours, sinon le prochain (on garde l’écoulé 3 jours pour la confirmation de fin). */
function computeFor(year: number, offset: number, p: RamadanPrefs, cal?: HijriCalendar) {
  const c = p.confirmed?.year === year ? p.confirmed : undefined;
  const calcStart = dayKey(hijriToDate({ year, month: 9, day: 1 }, offset, cal));
  const start = c?.start ?? calcStart;
  const len = monthLength(year, 9, cal);
  const end = c?.end ?? addDays(start, len - 1);
  return { start, end, length: daysBetween(start, end) + 1, source: (c?.start || c?.end ? 'confirmed' : 'calc') as RamadanStatus['source'] };
}

export function ramadanStatus(today: Date, offset: number, prefs: RamadanPrefs, cal?: HijriCalendar): RamadanStatus {
  const t = dayKey(today);
  const h = toHijri(today, offset, cal);
  let year = h.year;
  let r = computeFor(year, offset, prefs, cal);
  if (daysBetween(r.end, t) > 3) {
    year += 1;
    r = computeFor(year, offset, prefs, cal);
  }
  const phase: RamadanStatus['phase'] = t < r.start ? 'before' : t <= r.end ? 'during' : 'after';
  const day = phase === 'during' ? daysBetween(r.start, t) + 1 : 0;
  const daysUntil = phase === 'before' ? daysBetween(t, r.start) : 0;
  const ov = prefs.override?.year === year ? prefs.override.mode : null;
  const active = phase === 'during' && (ov ? ov === 'on' : prefs.mode === 'auto');
  const conf = prefs.confirmed?.year === year ? prefs.confirmed : undefined;
  let ask: RamadanStatus['ask'] = null;
  if (prefs.mode !== 'off' && ov !== 'off') {
    if (!conf?.start && !prefs.dismissed.includes(`${year}-start`) && ((phase === 'before' && daysUntil <= 2) || (phase === 'during' && day <= 3))) ask = 'start';
    else if (active && !conf?.end && day >= 29 && !prefs.dismissed.includes(`${year}-end`)) ask = 'end';
  }
  return { year, start: r.start, end: r.end, length: r.length, phase, day, daysUntil, active, source: r.source, ask };
}

/**
 * Confirmation locale du 1er jour de Ramadan : cherche le décalage hégirien (−2…+2, le plus proche de l’actuel)
 * pour lequel le calendrier choisi donne 1 Ramadan ce jour-là. Si aucun ne convient, le début est seulement
 * mémorisé pour le module Ramadan et `inRange` vaut false (l’app le signale).
 */
export function confirmStart(prefs: RamadanPrefs, offset: number, year: number, start: string, cal?: HijriCalendar): { prefs: RamadanPrefs; offset: number; inRange: boolean } {
  const cands = [-2, -1, 0, 1, 2].sort((a, b) => Math.abs(a - offset) - Math.abs(b - offset) || a - b);
  const o = cands.find((x) => dayKey(hijriToDate({ year, month: 9, day: 1 }, x, cal)) === start);
  const prev = prefs.confirmed?.year === year ? prefs.confirmed : undefined;
  const next: RamadanPrefs = { ...prefs, confirmed: { year, start, end: prev?.end && prev.end > start ? prev.end : undefined } };
  return { prefs: next, offset: o ?? offset, inRange: o !== undefined };
}
/** Confirmation locale du dernier jour de jeûne (29e ou 30e). */
export function confirmEnd(prefs: RamadanPrefs, year: number, lastDay: string): RamadanPrefs {
  const prev = prefs.confirmed?.year === year ? prefs.confirmed : { year };
  return { ...prefs, confirmed: { ...prev, year, end: lastDay } };
}
export const dismiss = (prefs: RamadanPrefs, key: string): RamadanPrefs => ({ ...prefs, dismissed: [...prefs.dismissed.filter((x) => x !== key), key] });
export const setOverride = (prefs: RamadanPrefs, year: number, mode: 'on' | 'off' | null): RamadanPrefs => ({ ...prefs, override: mode ? { year, mode } : undefined });

/** Jours (clés) du Ramadan. */
export const ramadanDays = (st: Pick<RamadanStatus, 'start' | 'length'>) => Array.from({ length: st.length }, (_, i) => addDays(st.start, i));
/** Prédicat « jour de jeûne » pour le planificateur de rappels (mode actif uniquement). */
export function fastDayPredicate(st: RamadanStatus, prefs: RamadanPrefs): (d: Date) => boolean {
  const ov = prefs.override?.year === st.year ? prefs.override.mode : null;
  const on = ov ? ov === 'on' : prefs.mode === 'auto';
  if (!on) return () => false;
  return (d) => {
    const k = dayKey(d);
    return k >= st.start && k <= st.end;
  };
}

/** Dix dernières nuits : la nuit N commence au Maghrib du jour N−1. Nuits impaires mises en avant, sans certitude affirmée. */
export function lastTenNights(st: Pick<RamadanStatus, 'start' | 'length'>): { night: number; eve: string; odd: boolean }[] {
  const out: { night: number; eve: string; odd: boolean }[] = [];
  for (let n = 21; n <= st.length; n++) out.push({ night: n, eve: addDays(st.start, n - 2), odd: n % 2 === 1 });
  return out;
}

// ——— Compte à rebours suhur / iftar ———
type Row = { key: string; time: Date };
const at = (rows: Row[], k: string) => {
  const t = rows.find((r) => r.key === k)?.time;
  return t && Number.isFinite(t.getTime()) ? t : null;
};
export const suhurEnd = (fajr: Date, imsakMin: number) => new Date(fajr.getTime() - Math.max(0, imsakMin) * 60000);
export type FastEvent = { kind: 'suhur' | 'iftar'; at: Date; fajr: Date | null; day: string };
/**
 * Prochain repère du jeûne : fin du suhur (Fajr − marge choisie) ou iftar (Maghrib).
 * `isFast(dayKey)` : le jour est-il un jour de Ramadan (mode actif) ?
 */
export function nextFastEvent(now: Date, today: Row[], tomorrow: Row[], imsakMin: number, isFast: (k: string) => boolean): FastEvent | null {
  const tk = dayKey(now);
  const mk = addDays(tk, 1);
  const fT = at(today, 'fajr'), mT = at(today, 'maghrib'), fM = at(tomorrow, 'fajr');
  if (isFast(tk) && fT && now < suhurEnd(fT, imsakMin)) return { kind: 'suhur', at: suhurEnd(fT, imsakMin), fajr: fT, day: tk };
  if (isFast(tk) && mT && now < mT) return { kind: 'iftar', at: mT, fajr: fT, day: tk };
  if (isFast(mk) && fM) return { kind: 'suhur', at: suhurEnd(fM, imsakMin), fajr: fM, day: mk };
  return null;
}
/** Temps restant réel (ms) : différence d’instants absolus, donc juste même à travers un changement d’heure. */
export const remainingMs = (target: Date, now: Date) => Math.max(0, target.getTime() - now.getTime());
export function hms(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 3600)}:${two(Math.floor((s % 3600) / 60))}:${two(s % 60)}`;
}

// ——— Suivis privés ———
export const yearLog = (p: RamadanPrefs, year: number): RamadanYearLog => p.log[String(year)] ?? { fast: {}, tarawih: {} };
export function withYearLog(p: RamadanPrefs, year: number, f: (l: RamadanYearLog) => RamadanYearLog): RamadanPrefs {
  const cur = yearLog(p, year);
  return { ...p, log: { ...p.log, [String(year)]: f({ fast: { ...cur.fast }, tarawih: { ...cur.tarawih } }) } };
}
/** Marque un jour (re-toucher la même marque l’efface). */
export function markFast(p: RamadanPrefs, year: number, day: string, mark: FastMark): RamadanPrefs {
  return withYearLog(p, year, (l) => {
    if (l.fast[day] === mark) delete l.fast[day];
    else l.fast[day] = mark;
    return l;
  });
}
export function toggleTarawih(p: RamadanPrefs, year: number, day: string): RamadanPrefs {
  return withYearLog(p, year, (l) => {
    if (l.tarawih[day]) delete l.tarawih[day];
    else l.tarawih[day] = true;
    return l;
  });
}
/** Marque effective : celle de l’utilisateur, sinon « dispense » automatique (neutre) pour un jour de dispense. */
export function effectiveMark(l: RamadanYearLog, day: string, neutral: (k: string) => boolean): FastMark | 'dispense' | null {
  return l.fast[day] ?? (neutral(day) ? 'dispense' : null);
}
export type FastSummary = { fasted: number; excused: number; missed: number; dispense: number; unmarked: number; toMakeUp: number; tarawih: number };
/** Résumé privé (jours écoulés seulement pour « non renseigné »). Aucune série : rien ne « casse ». */
export function fastSummary(p: RamadanPrefs, st: Pick<RamadanStatus, 'year' | 'start' | 'length'>, today: string, neutral: (k: string) => boolean): FastSummary {
  const l = yearLog(p, st.year);
  const s: FastSummary = { fasted: 0, excused: 0, missed: 0, dispense: 0, unmarked: 0, toMakeUp: 0, tarawih: 0 };
  for (const d of ramadanDays(st)) {
    const m = effectiveMark(l, d, neutral);
    if (m) s[m]++;
    else if (d <= today) s.unmarked++;
    if (l.tarawih[d]) s.tarawih++;
  }
  s.toMakeUp = Math.max(0, s.excused + s.missed + s.dispense - p.makeupDone);
  return s;
}

/** Total zakat al-fitr : uniquement si le montant saisi est un nombre clair ; sinon rien (jamais d’estimation). */
export function zakatTotal(z: ZakatFitr): { value: string; unit: string } | null {
  const m = /^\s*(\d+(?:[.,]\d{1,2})?)\s*([^\d\s].{0,9})?\s*$/.exec(z.amount);
  if (!m) return null;
  const v = Number(m[1].replace(',', '.')) * Math.max(1, z.people);
  const unit = (m[2] ?? '').trim();
  return { value: (Math.round(v * 100) / 100).toFixed(Number.isInteger(v) ? 0 : 2), unit };
}
