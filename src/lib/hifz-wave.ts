/**
 * Vague 1 de la mémorisation : plan local, rappel actif, série douce, oubli et « déjà su ».
 * N’écrit pas les cartes. Les cartes restent { r, i, e, d, f, l, x }, clés = index global.
 * Les jeux du bien-être gardent leur propre paquet. Ce module ne le lit pas.
 */
import { addDays, daysBetween } from './dates';
import { clozePuzzle, continuePuzzle, letterKey, orderPuzzle, shuffle, type ClozePuzzle, type ContinuePuzzle, type OrderPuzzle } from './learn-games';
import { fromIndex, gIndex, juzRange, OFFSETS, TOTAL_AYAHS } from './quran-nav';
import { dailyQueue, MATURE, newCard, queueSize, type Card } from './srs';
import { SURAHS } from './surahs';

export const HIFZ_PLAN_KEY = 'hifz-plan';
export const HIFZ_STREAK_KEY = 'hifz-streak';
/** Sans date but : 3, 4 ou 5 versets, 5 par défaut. */
export const DEFAULT_DAILY = 5;

export type PlanScope =
  | { kind: 'surah'; surah: number }
  | { kind: 'juz'; juz: number }
  | { kind: 'range'; from: number; to: number };

export type HifzPlan = {
  scope: PlanScope;
  perDay: number;
  /** AAAA-MM-JJ. Absent : on suit `perDay`. */
  deadline?: string;
};

export type HifzStreak = { last: string; n: number };

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function clampDaily(n: number): number {
  const x = Math.round(n);
  if (!Number.isFinite(x)) return DEFAULT_DAILY;
  return Math.min(5, Math.max(3, x));
}

export function sanitizePlan(v: unknown): HifzPlan | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as { scope?: Partial<PlanScope>; perDay?: number; deadline?: string };
  const perDay = clampDaily(typeof o.perDay === 'number' ? o.perDay : DEFAULT_DAILY);
  const deadline = typeof o.deadline === 'string' && DAY.test(o.deadline) ? o.deadline : undefined;
  const sc = o.scope;
  if (!sc || typeof sc !== 'object' || typeof sc.kind !== 'string') return null;
  if (sc.kind === 'surah' && typeof sc.surah === 'number') return { scope: { kind: 'surah', surah: Math.min(114, Math.max(1, Math.round(sc.surah))) }, perDay, deadline };
  if (sc.kind === 'juz' && typeof sc.juz === 'number') return { scope: { kind: 'juz', juz: Math.min(30, Math.max(1, Math.round(sc.juz))) }, perDay, deadline };
  if (sc.kind === 'range' && typeof sc.from === 'number' && typeof sc.to === 'number') {
    const from = Math.max(0, Math.min(TOTAL_AYAHS - 1, Math.round(Math.min(sc.from, sc.to))));
    const to = Math.max(from, Math.min(TOTAL_AYAHS - 1, Math.round(Math.max(sc.from, sc.to))));
    return { scope: { kind: 'range', from, to }, perDay, deadline };
  }
  return null;
}

export function sanitizeStreak(v: unknown): HifzStreak | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Partial<HifzStreak>;
  if (typeof o.last !== 'string' || !DAY.test(o.last)) return null;
  const n = Math.max(0, Math.round(Number(o.n) || 0));
  return n > 0 ? { last: o.last, n } : null;
}

/** [début, fin[ dans le Mushaf. */
export function scopeBounds(scope: PlanScope): [number, number] {
  if (scope.kind === 'surah') {
    const s = Math.min(114, Math.max(1, scope.surah));
    return [OFFSETS[s - 1], OFFSETS[s - 1] + SURAHS[s - 1][4]];
  }
  if (scope.kind === 'juz') return juzRange(scope.juz);
  const from = Math.max(0, Math.min(scope.from, scope.to));
  const to = Math.min(TOTAL_AYAHS, Math.max(scope.from, scope.to) + 1);
  return [from, to];
}

export function untrackedIn(cards: Record<string, Card | undefined>, scope: PlanScope): number[] {
  const [lo, hi] = scopeBounds(scope);
  const out: number[] = [];
  for (let k = lo; k < hi; k++) if (!cards[k] && !cards[String(k)]) out.push(k);
  return out;
}

/** Combien de versets proposer aujourd’hui. Une date but peut dépasser 5, plafonnée à 20. */
export function lessonCount(remaining: number, today: string, plan: HifzPlan): number {
  const n = Math.max(0, remaining);
  if (plan.deadline && plan.deadline > today) {
    const days = Math.max(1, daysBetween(today, plan.deadline));
    return Math.min(20, Math.max(1, Math.ceil(n / days)));
  }
  return clampDaily(plan.perDay);
}

export function deadlineIn(today: string, days: number): string {
  return addDays(today, Math.max(1, Math.round(days)));
}

/**
 * Prochaine leçon : les prochains versets sans carte, dans le plan.
 * Sans plan, 5 versets à partir du premier non suivi de `fallbackSurah`.
 * Ne modifie pas `cards`.
 */
export function nextLesson(cards: Record<string, Card | undefined>, plan: HifzPlan | null, today: string, fallbackSurah = 1): { surah: number; from: number; to: number } {
  const scope = plan?.scope ?? { kind: 'surah' as const, surah: fallbackSurah };
  const left = untrackedIn(cards, scope);
  const count = plan ? lessonCount(left.length, today, plan) : DEFAULT_DAILY;
  if (!left.length) {
    const [lo, hi] = scopeBounds(scope);
    const [s, a] = fromIndex(Math.max(lo, hi - 1));
    return { surah: s, from: a, to: a };
  }
  const take = left.slice(0, Math.max(1, Math.min(count, left.length)));
  const surah = fromIndex(take[0])[0];
  const same = take.filter((k) => fromIndex(k)[0] === surah);
  return { surah, from: fromIndex(same[0])[1], to: fromIndex(same[same.length - 1])[1] };
}

/** Effacer le plan ne renvoie que null : les cartes ne sont pas dans cette valeur. */
export function clearedPlan(): null {
  return null;
}

/** Retire [from, to[ . Les autres clés restent les mêmes objets. */
export function forgetRange<T>(cards: Record<string, T>, from: number, to: number): Record<string, T> {
  const n = { ...cards };
  for (let i = from; i < to; i++) delete n[i];
  return n;
}

/**
 * Passe la plage au seuil « mémorisé » (intervalle 21 j) sans inventer de révisions passées.
 * Une carte déjà à ce seuil n’est pas réécrite. `r`, `e` et `x` restent.
 */
export function markKnownCard(card: Card | undefined, today: string): Card {
  if (card && card.i >= MATURE) return card;
  const base = card ?? newCard(today);
  return { ...base, i: MATURE, d: addDays(today, MATURE), l: base.l || today, f: base.f || today };
}

export function markKnownRange(cards: Record<string, Card>, from: number, to: number, today: string): Record<string, Card> {
  const n = { ...cards };
  for (let i = from; i < to; i++) n[i] = markKnownCard(n[i] ?? n[String(i)], today);
  return n;
}

/** Échus d’abord (sabaq, sabqi, manzil), puis la leçon qui vient d’être vue. */
export function recallKeys(cards: Record<string, Card>, today: string, lesson: readonly number[]): number[] {
  const q = dailyQueue(cards, today);
  const due = [...q.sabaq, ...q.sabqi, ...q.manzil];
  const seen = new Set(due);
  const rest = [...lesson].filter((k) => Number.isFinite(k) && !seen.has(k)).sort((a, b) => a - b);
  return [...due, ...rest];
}

export function lessonIndexes(surah: number, fromAyah: number, toAyah: number): number[] {
  const meta = SURAHS[Math.min(114, Math.max(1, surah)) - 1];
  const a = Math.max(1, Math.min(fromAyah, toAyah));
  const b = Math.min(meta[4], Math.max(fromAyah, toAyah));
  const out: number[] = [];
  for (let i = a; i <= b; i++) out.push(gIndex(surah, i));
  return out;
}

export type NextPuzzle = { prompt: string; answer: string; options: string[] };

/** « Verset suivant » : la bonne suite, et des versets de la même sourate. */
export function nextVersePuzzle(verse: string, next: string, pool: readonly string[], r: () => number, nOptions = 4): NextPuzzle | null {
  if (!verse.trim() || !next.trim()) return null;
  const seen = new Set([letterKey(next)]);
  const others: string[] = [];
  for (const v of shuffle(pool, r)) {
    const k = letterKey(v);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    others.push(v);
    if (others.length >= nOptions - 1) break;
  }
  if (!others.length) return null;
  return { prompt: verse, answer: next, options: shuffle([next, ...others], r) };
}

export type RecallDrill =
  | { kind: 'order'; p: OrderPuzzle }
  | { kind: 'cloze'; p: ClozePuzzle }
  | { kind: 'continue'; p: ContinuePuzzle }
  | { kind: 'next'; p: NextPuzzle };

const DRILLS = ['order', 'cloze', 'continue', 'next'] as const;

/** Un exercice par verset. Si la forme demandée est impossible, on retombe sur l’ordre des mots. */
export function buildDrill(index: number, verse: string, next: string | null, pool: readonly string[], r: () => number): RecallDrill {
  const kind = DRILLS[index % DRILLS.length];
  if (kind === 'next' && next) {
    const p = nextVersePuzzle(verse, next, pool, r);
    if (p) return { kind: 'next', p };
  }
  if (kind === 'cloze') {
    const p = clozePuzzle(verse, pool, r);
    if (p) return { kind: 'cloze', p };
  }
  if (kind === 'continue') {
    const p = continuePuzzle(verse, pool, r);
    if (p) return { kind: 'continue', p };
  }
  return { kind: 'order', p: orderPuzzle(verse, r) };
}

export function surahSlice(all: readonly string[], k: number): { verse: string; next: string | null; pool: string[] } {
  const [s, a] = fromIndex(k);
  const start = OFFSETS[s - 1];
  const len = SURAHS[s - 1][4];
  const verse = all[k] ?? '';
  const next = a < len ? (all[k + 1] ?? null) : null;
  const pool: string[] = [];
  for (let i = 0; i < len; i++) if (start + i !== k && all[start + i]) pool.push(all[start + i]);
  return { verse, next, pool };
}

/** La file du jour est vide et au moins un verset a été noté aujourd’hui (leçon ou révision). */
export function practiceCounts(cards: Record<string, Card>, today: string): boolean {
  if (queueSize(dailyQueue(cards, today)) > 0) return false;
  return Object.values(cards).some((c) => c?.l === today);
}

/** Un jour manqué est une grâce. Deux jours manqués : la prochaine pratique repart à 1. */
export function notePractice(prev: HifzStreak | null, today: string): HifzStreak {
  if (!prev?.last) return { last: today, n: 1 };
  if (prev.last === today) return prev;
  const gap = daysBetween(prev.last, today);
  if (gap === 1 || gap === 2) return { last: today, n: prev.n + 1 };
  return { last: today, n: 1 };
}

/** Nombre affiché. Un trou d’un jour laisse le nombre. Aucun libellé de faute n’est calculé ici. */
export function shownStreak(prev: HifzStreak | null, today: string): number {
  if (!prev?.last || prev.n < 1) return 0;
  const gap = daysBetween(prev.last, today);
  if (gap <= 2) return prev.n;
  return 0;
}
