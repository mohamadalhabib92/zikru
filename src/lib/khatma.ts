/**
 * Planificateur de khatma (lecture complète du Coran) et série de lecture — module pur, testé par scripts/test-khatma.mjs.
 * Le plan répartit les pages restantes (Mushaf de Médine, 604 p.) sur N jours ; le wird du jour est fixe (prévisible),
 * et l’écran indique l’avance / le retard et le rythme nécessaire pour finir à temps.
 */
import { addDays, daysBetween } from './dates';

export const MUSHAF_PAGES = 604;
export type Khatma = {
  /** Jour de départ (AAAA-MM-JJ). */
  start: string;
  /** Durée choisie (jours). */
  days: number;
  /** Première page du plan (1 par défaut). */
  from: number;
  /** Pages lues depuis le début du plan (progression). */
  done: number;
  /** Date d’achèvement, le cas échéant. */
  finished?: string;
};

export function newKhatma(start: string, days: number, from = 1): Khatma {
  return { start, days: Math.max(1, Math.round(days)), from: Math.min(MUSHAF_PAGES, Math.max(1, from)), done: 0 };
}
export const khatmaTotal = (k: Khatma) => MUSHAF_PAGES - k.from + 1;
/** Pages par jour prévues au départ (arrondi supérieur ; le plan alterne ⌊⌋ et ⌈⌉). */
export const pagesPerDay = (k: Khatma) => Math.ceil(khatmaTotal(k) / k.days);

export type KhatmaStatus = {
  /** Jour du plan (1..days ; peut dépasser si le plan est en retard). */
  day: number;
  total: number;
  done: number;
  progress: number;
  /** Wird du jour (pages incluses) ; null si le plan est terminé. */
  today: { from: number; to: number } | null;
  /** Pages lues aujourd’hui comprises dans le wird. */
  todayDone: number;
  /** Écart (pages) par rapport au plan à la fin d’aujourd’hui : positif = avance. */
  delta: number;
  /** Jours restants (aujourd’hui compris). */
  daysLeft: number;
  /** Rythme nécessaire (pages / jour) pour finir à la date prévue. */
  needPerDay: number;
  /** Prochaine page à lire. */
  nextPage: number;
  end: string;
  finished: boolean;
};

export function khatmaStatus(k: Khatma, today: string): KhatmaStatus {
  const total = khatmaTotal(k), ppd = pagesPerDay(k);
  const done = Math.min(total, Math.max(0, k.done));
  const day = Math.max(1, daysBetween(k.start, today) + 1);
  const finished = done >= total;
  const dayIdx = Math.min(day, k.days) - 1;
  // Répartition régulière : le jour d (0..days-1) couvre [⌊total·d/days⌋, ⌊total·(d+1)/days⌋[.
  const cut = (d: number) => Math.floor((total * d) / k.days);
  const late = day > k.days;
  const fromRel = late ? done : cut(dayIdx), toRel = late ? total : cut(dayIdx + 1);
  const expected = toRel;
  const daysLeft = Math.max(1, k.days - day + 1);
  const remaining = total - done;
  return {
    day,
    total,
    done,
    progress: total ? done / total : 0,
    today: finished ? null : { from: k.from + Math.min(fromRel, total - 1), to: k.from + Math.max(fromRel + 1, toRel) - 1 },
    todayDone: Math.max(0, Math.min(toRel, done) - fromRel),
    delta: done - expected,
    daysLeft,
    needPerDay: finished ? 0 : Math.ceil(remaining / daysLeft),
    nextPage: Math.min(MUSHAF_PAGES, k.from + done),
    end: addDays(k.start, k.days - 1),
    finished,
  };
}

/** Enregistre la lecture d’une page : la progression ne recule jamais. */
export function markPage(k: Khatma, page: number, today: string): Khatma {
  const rel = page - k.from + 1;
  if (rel <= k.done || rel < 1) return k;
  const done = Math.min(khatmaTotal(k), rel);
  return { ...k, done, finished: done >= khatmaTotal(k) ? (k.finished ?? today) : undefined };
}

/** Série : jours consécutifs de lecture se terminant aujourd’hui (ou hier, si rien n’est encore lu aujourd’hui) ; et le record. */
export function streak(days: string[], today: string, neutral: (d: string) => boolean = () => false): { current: number; best: number; todayDone: boolean } {
  const set = new Set(days);
  const todayDone = set.has(today);
  let current = 0;
  // Jours neutres (mode dispense) : sautés, ni comptés ni cassants.
  for (let d = todayDone ? today : addDays(today, -1), i = 0; i < 3650 && (set.has(d) || neutral(d)); d = addDays(d, -1), i++) if (set.has(d)) current++;
  const sorted = [...set].sort();
  let best = 0, run = 0, prev = '';
  const bridged = (a: string, b: string) => {
    const gap = daysBetween(a, b);
    if (gap === 1) return true;
    if (gap < 1 || gap > 366) return false;
    for (let i = 1; i < gap; i++) if (!neutral(addDays(a, i))) return false;
    return true;
  };
  for (const d of sorted) {
    run = prev && bridged(prev, d) ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return { current, best, todayDone };
}
