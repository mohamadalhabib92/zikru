/**
 * Révision espacée de la mémorisation (module pur, testé par scripts/test-srs.mjs).
 * Algorithme SM-2 (Wozniak, 1987) appliqué verset par verset, et file quotidienne en trois parts, selon la méthode
 * traditionnelle des écoles de hifz : sabaq (leçon nouvelle du jour), sabqi (révision récente), manzil (révision ancienne).
 */
import { addDays, daysBetween } from './dates';

/** Carte de mémorisation d’un verset. */
export type Card = {
  /** Répétitions réussies d’affilée. */
  r: number;
  /** Intervalle actuel (jours). */
  i: number;
  /** Facteur de facilité (≥ 1,3). */
  e: number;
  /** Prochaine révision (AAAA-MM-JJ). */
  d: string;
  /** Première mémorisation (AAAA-MM-JJ). */
  f: string;
  /** Dernière révision. */
  l: string;
  /** Oublis. */
  x: number;
};
export type Grade = 'easy' | 'medium' | 'hard';
/** Qualité SM-2 (0..5) associée à l’auto-évaluation. */
export const QUALITY: Record<Grade, number> = { easy: 5, medium: 3, hard: 1 };
/** Seuil (jours) au-delà duquel un verset est considéré « mémorisé » (passe du sabqi au manzil). */
export const MATURE = 21;

export function newCard(today: string): Card {
  return { r: 0, i: 0, e: 2.5, d: today, f: today, l: '', x: 0 };
}

/** Applique une auto-évaluation (SM-2). Un « difficile » remet le verset en apprentissage (révision demain). */
export function review(card: Card | undefined, g: Grade, today: string): Card {
  const c = card ?? newCard(today);
  const q = QUALITY[g];
  const e = Math.max(1.3, +(c.e + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))).toFixed(3));
  if (q < 3) return { ...c, r: 0, i: 1, e, d: addDays(today, 1), l: today, x: c.x + (c.r > 0 ? 1 : 0) };
  const r = c.r + 1;
  const i = r === 1 ? 1 : r === 2 ? (q === 5 ? 6 : 3) : Math.max(c.i + 1, Math.round(c.i * e * (q === 3 ? 0.8 : 1)));
  return { ...c, r, i, e, d: addDays(today, i), l: today };
}

export type Status = 'none' | 'learning' | 'memorised' | 'review';
export function cardStatus(c: Card | undefined, today: string): Status {
  if (!c) return 'none';
  if (!c.l) return c.f === today ? 'learning' : 'review';
  if (c.d <= today && c.l !== today) return 'review';
  return c.i >= MATURE ? 'memorised' : 'learning';
}

/** Statut d’un ensemble de versets [début, fin[ : aucun / en cours / mémorisé / à réviser. */
export function rangeStatus(cards: Record<string, Card>, start: number, end: number, today: string): { status: Status; known: number; due: number; mature: number; total: number } {
  let known = 0, due = 0, mature = 0;
  for (let k = start; k < end; k++) {
    const st = cardStatus(cards[k], today);
    if (st === 'none') continue;
    known++;
    if (st === 'review') due++;
    else if (st === 'memorised') mature++;
  }
  const total = end - start;
  const status: Status = known === 0 ? 'none' : due > 0 ? 'review' : mature === total ? 'memorised' : 'learning';
  return { status, known, due, mature, total };
}

export type Queue = { sabaq: number[]; sabqi: number[]; manzil: number[] };
/**
 * File du jour (index globaux, ordre du Mushaf) :
 * - sabaq : versets commencés aujourd’hui (leçon du jour) ;
 * - sabqi : versets récents (intervalle < 21 j) arrivés à échéance ;
 * - manzil : versets anciens (≥ 21 j) arrivés à échéance, plafonnés à `manzilMax` par jour (les plus en retard d’abord).
 */
export function dailyQueue(cards: Record<string, Card>, today: string, manzilMax = 60): Queue {
  const sabaq: number[] = [], sabqi: number[] = [], manzilAll: { k: number; late: number }[] = [];
  for (const key of Object.keys(cards)) {
    const k = +key, c = cards[key];
    if (c.f === today && c.l !== today && c.r === 0) sabaq.push(k);
    else if (c.d <= today && c.l !== today) {
      if (c.i >= MATURE) manzilAll.push({ k, late: daysBetween(c.d, today) });
      else sabqi.push(k);
    }
  }
  const manzil = manzilAll.sort((a, b) => b.late - a.late || a.k - b.k).slice(0, manzilMax).map((x) => x.k);
  const asc = (a: number, b: number) => a - b;
  return { sabaq: sabaq.sort(asc), sabqi: sabqi.sort(asc), manzil: manzil.sort(asc) };
}
export const queueSize = (q: Queue) => q.sabaq.length + q.sabqi.length + q.manzil.length;

/** Regroupe des index consécutifs en plages [début, fin[ (pour réviser verset par verset dans l’ordre). */
export function toRanges(idx: number[]): [number, number][] {
  const out: [number, number][] = [];
  for (const k of [...idx].sort((a, b) => a - b)) {
    const last = out[out.length - 1];
    if (last && last[1] === k) last[1] = k + 1;
    else out.push([k, k + 1]);
  }
  return out;
}
