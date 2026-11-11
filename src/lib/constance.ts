import { allMet, dayValues, gentleStreak, weekStart, type GentleStreak, type GoalPrefs, type GoalSources, type ValuesFn } from './goals';
import { dayKey, type NeutralFn } from './streak';

/**
 * Constance : agrégats en lecture seule. Les comptes de dhikr (tasbih) ne sont jamais
 * additionnés aux objectifs (prières, wird, pages, cible de tasbih). Une grâce par semaine.
 */
export const CONSTANCE_GRACE = 1;
export const MILESTONE_DAYS = [7, 30, 40, 100, 365] as const;

const noon = (k: string) => new Date(k + 'T12:00:00');

export function addDays(k: string, n: number): string {
  const d = noon(k);
  d.setDate(d.getDate() + n);
  return dayKey(d);
}

/** Lundi de la semaine, puis les `weeks` colonnes jusqu’à la semaine de `today` (inclus). */
export function weekColumns(today = new Date(), weeks = 12): string[] {
  const end = weekStart(dayKey(today));
  const out: string[] = [];
  for (let i = weeks - 1; i >= 0; i--) out.push(addDays(end, -7 * i));
  return out;
}

export type HeatCell = {
  key: string;
  /** Comptes de dhikr du jour. Jamais mélangé au taux d’objectifs. */
  zikr: number;
  /** 0 = rien, 1..4 = volume relatif à la période affichée. */
  level: number;
  objectiveMet: boolean;
  pages: number;
  read: boolean;
};

function levelOf(zikr: number, max: number): number {
  if (zikr <= 0 || max <= 0) return 0;
  const r = zikr / max;
  if (r <= 0.25) return 1;
  if (r <= 0.5) return 2;
  if (r <= 0.75) return 3;
  return 4;
}

/** Grille lundi → dimanche, une colonne par semaine. `weeks` = 12 (gratuit) ou 53 (année). */
export function heatGrid(values: ValuesFn, prefs: GoalPrefs, opts: { today?: Date; weeks?: number; neutral?: NeutralFn; read?: (k: string) => boolean }): HeatCell[] {
  const today = opts.today ?? new Date();
  const weeks = opts.weeks ?? 12;
  const neutral = opts.neutral ?? (() => false);
  const cols = weekColumns(today, weeks);
  const tk = dayKey(today);
  const cells: Omit<HeatCell, 'level'>[] = [];
  for (const start of cols) {
    for (let i = 0; i < 7; i++) {
      const key = addDays(start, i);
      if (key > tk) continue;
      const v = values(key);
      cells.push({
        key,
        zikr: Math.max(0, v.tasbih || 0),
        objectiveMet: !neutral(key) && allMet(v, prefs),
        pages: Math.max(0, v.quran || 0),
        read: !!opts.read?.(key),
      });
    }
  }
  const max = cells.reduce((m, c) => Math.max(m, c.zikr), 0);
  return cells.map((c) => ({ ...c, level: levelOf(c.zikr, max) }));
}

/** Série de présence au dhikr (compteur > 0). Une grâce par semaine. Aujourd’hui ne casse rien s’il est encore vide. */
export function zikrStreak(values: ValuesFn, today = new Date(), neutral: NeutralFn = () => false): GentleStreak {
  return gentleStreak((k) => (values(k).tasbih || 0) > 0, today, neutral, CONSTANCE_GRACE);
}

/** Série d’objectifs atteints, séparée du volume de dhikr. */
export function goalStreak(values: ValuesFn, prefs: GoalPrefs, today = new Date(), neutral: NeutralFn = () => false): GentleStreak {
  return gentleStreak((k) => allMet(values(k), prefs), today, neutral, CONSTANCE_GRACE);
}

/**
 * Meilleure série sur l’intervalle. Même règle que gentleStreak pour un jour déjà
 * accompli : on remonte le plus loin possible tant qu’aucune semaine du segment
 * ne dépasse la grâce. Un jour neutre ne compte pas et ne casse rien.
 * (Le cas « aujourd’hui pas encore fini » ne s’applique pas aux jours passés.)
 */
export function bestGentle(active: (k: string) => boolean, from: string, to: string, neutral: NeutralFn = () => false, grace = CONSTANCE_GRACE): number {
  const keys: string[] = [];
  let k = from;
  let steps = 0;
  while (k <= to && steps < 4000) {
    keys.push(k);
    k = addDays(k, 1);
    steps++;
  }
  const used: Record<string, number> = {};
  let start = 0;
  let count = 0;
  let best = 0;
  const miss = (day: string) => !neutral(day) && !active(day);
  for (let end = 0; end < keys.length; end++) {
    const day = keys[end];
    if (miss(day)) {
      const w = weekStart(day);
      used[w] = (used[w] ?? 0) + 1;
    } else if (active(day)) count++;
    while (start <= end && Object.values(used).some((n) => n > grace)) {
      const s = keys[start];
      if (miss(s)) {
        const w = weekStart(s);
        used[w]--;
        if (used[w] <= 0) delete used[w];
      } else if (active(s)) count--;
      start++;
    }
    best = Math.max(best, count);
  }
  return best;
}

export type Bar = { key: string; label: string; zikr: number; met: number; counted: number; pages: number };

function emptyBar(key: string, label: string): Bar {
  return { key, label, zikr: 0, met: 0, counted: 0, pages: 0 };
}

/** Barres hebdomadaires (lundi) : total de dhikr et jours d’objectifs, côte à côte, jamais additionnés. */
export function weekBars(values: ValuesFn, prefs: GoalPrefs, today = new Date(), weeks = 8, neutral: NeutralFn = () => false): Bar[] {
  const cols = weekColumns(today, weeks);
  const tk = dayKey(today);
  return cols.map((start) => {
    const bar = emptyBar(start, `${Number(start.slice(8))}/${Number(start.slice(5, 7))}`);
    for (let i = 0; i < 7; i++) {
      const k = addDays(start, i);
      if (k > tk || neutral(k)) continue;
      const v = values(k);
      bar.counted++;
      bar.zikr += Math.max(0, v.tasbih || 0);
      bar.pages += Math.max(0, v.quran || 0);
      if (allMet(v, prefs)) bar.met++;
    }
    return bar;
  });
}

/** Barres des mois civils se terminant au mois de `today`. */
export function monthBars(values: ValuesFn, prefs: GoalPrefs, today = new Date(), months = 6, neutral: NeutralFn = () => false): Bar[] {
  const tk = dayKey(today);
  const start = new Date(today.getFullYear(), today.getMonth() - (months - 1), 1, 12);
  const bars: Bar[] = [];
  for (let m = 0; m < months; m++) {
    const d = new Date(start.getFullYear(), start.getMonth() + m, 1, 12);
    const key = dayKey(d);
    const bar = emptyBar(key, `${Number(key.slice(5, 7))}/${key.slice(2, 4)}`);
    const dim = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    for (let day = 1; day <= dim; day++) {
      const k = dayKey(new Date(d.getFullYear(), d.getMonth(), day, 12));
      if (k > tk || neutral(k)) continue;
      const v = values(k);
      bar.counted++;
      bar.zikr += Math.max(0, v.tasbih || 0);
      bar.pages += Math.max(0, v.quran || 0);
      if (allMet(v, prefs)) bar.met++;
    }
    bars.push(bar);
  }
  return bars;
}

export function rate(bar: Bar): number {
  return bar.counted > 0 ? bar.met / bar.counted : 0;
}

export type MilestoneView = { days: number; reached: boolean };
export function milestoneViews(streakDays: number): MilestoneView[] {
  return MILESTONE_DAYS.map((days) => ({ days, reached: streakDays >= days }));
}

/** Pages et jours de lecture sur une fenêtre, sans inventer un nombre de versets. */
export function quranWindow(values: ValuesFn, read: (k: string) => boolean, today = new Date(), days = 14, neutral: NeutralFn = () => false): { key: string; pages: number; read: boolean }[] {
  const tk = dayKey(today);
  const from = addDays(tk, -(days - 1));
  const out: { key: string; pages: number; read: boolean }[] = [];
  let k = from;
  while (k <= tk) {
    if (!neutral(k)) out.push({ key: k, pages: Math.max(0, values(k).quran || 0), read: read(k) });
    k = addDays(k, 1);
  }
  return out;
}

export function sourcesOf(src: GoalSources): ValuesFn {
  return (k) => dayValues(src, k);
}

export { weekStart };
