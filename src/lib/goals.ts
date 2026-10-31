import { dayKey, type NeutralFn } from './streak';

/**
 * Objectifs du jour — module pur, 100 % local (jamais synchronisé, jamais comparé à d’autres).
 * Série douce : 2 jours de grâce par semaine (lundi → dimanche) ; un jour en dispense est neutre
 * et ne casse jamais la série ; la journée en cours ne casse rien tant qu’elle n’est pas finie.
 */
export type GoalKey = 'prayers' | 'wird' | 'quran' | 'tasbih';
export const GOAL_KEYS: GoalKey[] = ['prayers', 'wird', 'quran', 'tasbih'];
export type GoalPrefs = { on: Record<GoalKey, boolean>; target: Record<GoalKey, number> };
export const DEFAULT_GOALS: GoalPrefs = {
  on: { prayers: true, wird: false, quran: false, tasbih: true },
  target: { prayers: 5, wird: 1, quran: 2, tasbih: 100 },
};
/** Choix proposés (pas de saisie libre : cibles raisonnables, pas de surenchère). */
export const TARGET_OPTIONS: Record<GoalKey, number[]> = {
  prayers: [5],
  wird: [1, 2, 3],
  quran: [1, 2, 4, 10, 20],
  tasbih: [33, 100, 300, 1000],
};
export const GRACE_PER_WEEK = 2;

export function normalizeGoals(v: Partial<GoalPrefs> | null | undefined): GoalPrefs {
  const on = { ...DEFAULT_GOALS.on, ...v?.on };
  const target = { ...DEFAULT_GOALS.target, ...v?.target };
  for (const k of GOAL_KEYS) {
    const t = Number(target[k]);
    target[k] = Number.isFinite(t) && t >= 1 ? Math.round(t) : DEFAULT_GOALS.target[k];
    on[k] = !!on[k];
  }
  target.prayers = Math.min(5, target.prayers);
  return { on, target };
}

/** Valeurs mesurées d’un jour (prières cochées, unités de wird finies, pages terminées, tasbih). */
export type DayValues = Record<GoalKey, number>;
export type ValuesFn = (day: string) => DayValues;

export const met = (g: GoalKey, v: DayValues, p: GoalPrefs) => (v[g] ?? 0) >= p.target[g];
export const enabledGoals = (p: GoalPrefs) => GOAL_KEYS.filter((k) => p.on[k]);
/** Tous les objectifs actifs atteints (aucun objectif actif → jamais « atteint »). */
export function allMet(v: DayValues, p: GoalPrefs): boolean {
  const en = enabledGoals(p);
  return en.length > 0 && en.every((k) => met(k, v, p));
}

const fromKey = (k: string) => new Date(k + 'T12:00:00');
/** Lundi de la semaine (clé AAAA-MM-JJ). */
export function weekStart(k: string): string {
  const d = fromKey(k);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return dayKey(d);
}

export type GentleStreak = {
  /** Jours accomplis dans la série (les jours de grâce et neutres ne comptent pas). */
  days: number;
  /** Jours de grâce utilisés dans la série. */
  graceDays: string[];
  /** Jours de grâce encore disponibles cette semaine. */
  graceLeft: number;
  /** Premier jour accompli de la série (null si aucune). */
  since: string | null;
};

/**
 * Série douce. On remonte depuis hier (aujourd’hui compte s’il est accompli, sinon il est ignoré) :
 * jour accompli → +1 ; jour neutre (dispense) → sauté ; jour manqué → consomme une grâce de sa semaine,
 * la série s’arrête quand la semaine n’en a plus. Les grâces antérieures au premier jour accompli sont oubliées.
 */
export function gentleStreak(active: (k: string) => boolean, today = new Date(), neutral: NeutralFn = () => false, grace = GRACE_PER_WEEK): GentleStreak {
  const tk = dayKey(today);
  const used: Record<string, number> = {};
  const graceAll: string[] = [];
  let days = 0;
  let oldest: string | null = null;
  const d = new Date(today);
  if (active(tk)) {
    days = 1;
    oldest = tk;
  }
  for (let i = 0; i < 3650; i++) {
    d.setDate(d.getDate() - 1);
    const k = dayKey(d);
    if (active(k)) {
      days++;
      oldest = k;
    } else if (neutral(k)) continue;
    else {
      const w = weekStart(k);
      used[w] = (used[w] ?? 0) + 1;
      if (used[w] > grace) break;
      graceAll.push(k);
    }
  }
  const graceDays = oldest ? graceAll.filter((k) => k > oldest!) : [];
  const thisWeek = weekStart(tk);
  const usedNow = graceDays.filter((k) => weekStart(k) === thisWeek).length;
  return { days, graceDays, graceLeft: Math.max(0, grace - usedNow), since: oldest };
}

export type WeekRecap = {
  from: string;
  to: string;
  /** Jours de la semaine déjà écoulés hors dispense (aujourd’hui inclus). */
  counted: number;
  neutral: number;
  /** Par objectif : jours atteints et total mesuré sur la semaine. */
  goals: Record<GoalKey, { met: number; total: number }>;
};

/** Bilan privé de la semaine (lundi → dimanche) contenant `day`. Les jours en dispense sont exclus. */
export function weekRecap(values: ValuesFn, prefs: GoalPrefs, day = new Date(), neutral: NeutralFn = () => false, today = new Date()): WeekRecap {
  const from = weekStart(dayKey(day));
  const goals = Object.fromEntries(GOAL_KEYS.map((k) => [k, { met: 0, total: 0 }])) as WeekRecap['goals'];
  let counted = 0;
  let neutralN = 0;
  const tk = dayKey(today);
  const d = fromKey(from);
  let to = from;
  for (let i = 0; i < 7; i++) {
    const k = dayKey(d);
    to = k;
    d.setDate(d.getDate() + 1);
    if (k > tk) continue;
    if (neutral(k)) {
      neutralN++;
      continue;
    }
    counted++;
    const v = values(k);
    for (const g of GOAL_KEYS) {
      goals[g].total += v[g] ?? 0;
      if (met(g, v, prefs)) goals[g].met++;
    }
  }
  return { from, to, counted, neutral: neutralN, goals };
}

/** Étapes sobres (aucune comparaison, aucun classement). */
export type MilestoneId = string;
export type Milestone = { id: MilestoneId; kind: 'khatma' | 'wird40'; at: string };
export const WIRD_MILESTONE_DAYS = 40;

/** Nouvelles étapes atteintes (dédoublonnées par id). */
export function newMilestones(have: Milestone[], ctx: { khatma?: { start: string; finished?: string } | null; wird: Pick<GentleStreak, 'days' | 'since'>; today?: Date }): Milestone[] {
  const ids = new Set(have.map((m) => m.id));
  const at = dayKey(ctx.today ?? new Date());
  const out: Milestone[] = [];
  if (ctx.khatma?.finished) {
    const id = `khatma:${ctx.khatma.start}`;
    if (!ids.has(id)) out.push({ id, kind: 'khatma', at: ctx.khatma.finished });
  }
  // une seule fois par série : l’id porte le premier jour de la série
  if (ctx.wird.days >= WIRD_MILESTONE_DAYS && ctx.wird.since) {
    const id = `wird40:${ctx.wird.since}`;
    if (!ids.has(id)) out.push({ id, kind: 'wird40', at });
  }
  return out;
}

const FARD = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
export type GoalSources = {
  prayed: Record<string, string[]>;
  clicks: Record<string, number>;
  pages: Record<string, number[]>;
  /** tijani-done : clé `${jour}-${id}-f` → étapes faites. */
  tijani: Record<string, number[]>;
  practices: { id: string; steps: number }[];
  /** Moments d’adhkar terminés par jour. */
  adhkar: Record<string, string[]>;
};
/** Wird : une pratique tijani entièrement cochée OU les adhkar du matin / du soir terminés comptent chacun pour une unité. */
export function dayValues(src: GoalSources, k: string): DayValues {
  const prayers = new Set((src.prayed[k] ?? []).filter((x) => FARD.includes(x))).size;
  const tij = src.practices.filter((p) => p.steps > 0 && new Set(src.tijani[`${k}-${p.id}-f`] ?? []).size >= p.steps).length;
  const adh = (src.adhkar[k] ?? []).filter((m) => m === 'matin' || m === 'soir').length;
  return { prayers, wird: tij + adh, quran: new Set(src.pages[k] ?? []).size, tasbih: Math.max(0, src.clicks[k] ?? 0) };
}
