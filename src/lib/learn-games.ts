/**
 * Jeux d’apprentissage (module pur) : ordre des mots, mot manquant, suite du verset, cartes des 99 Noms.
 * Rappel actif + révision espacée SM-2 (src/lib/srs.ts). Les versets viennent tels quels du texte Tanzil :
 * on ne fait que découper sur les espaces et recoller (aucune lettre ni signe modifié).
 */
import { cardStatus, review, type Card, type Grade } from './srs';

/** Générateur pseudo-aléatoire reproductible (mulberry32), pour des tests déterministes. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function shuffle<T>(xs: readonly T[], r: () => number): T[] {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Signes de pause, ۞ et ۩ (sans lettre) : rattachés au mot voisin, jamais proposés seuls. */
const MARK_ONLY = /^[\u06D6-\u06ED\u200C\u200D]+$/;
/** Mots d’un verset ; `words(v).join(' ') === v` (aucun caractère perdu). */
export function words(verse: string): string[] {
  const out: string[] = [];
  let lead = '';
  for (const w of verse.split(' ')) {
    if (MARK_ONLY.test(w)) {
      if (out.length) out[out.length - 1] += ' ' + w;
      else lead += w + ' ';
    } else {
      out.push(lead + w);
      lead = '';
    }
  }
  if (lead) out.push(lead.trimEnd());
  return out;
}
/** Clé de comparaison : lettres seules (sans voyelles ni signes). Sert uniquement à écarter les distracteurs identiques. */
export function letterKey(w: string): string {
  return w.replace(/[^\u0621-\u063A\u0641-\u064A\u0671]/g, '');
}

// ——— Ordre des mots ———
export type OrderPuzzle = { words: string[]; shuffled: string[] };
/** Mélange garanti différent de l’ordre d’origine (quand c’est possible). */
export function orderPuzzle(verse: string, r: () => number): OrderPuzzle {
  const w = words(verse);
  let s = shuffle(w, r);
  const distinct = new Set(w).size > 1;
  for (let k = 0; distinct && k < 20 && s.join(' ') === w.join(' '); k++) s = shuffle(w, r);
  return { words: w, shuffled: s };
}
/** Le mot touché est-il le bon à cette position ? (Les mots répétés sont interchangeables.) */
export const orderStepOk = (p: OrderPuzzle, picked: string[], next: string) => p.words[picked.length] === next;
export const orderDone = (p: OrderPuzzle, picked: string[]) => picked.length === p.words.length && picked.every((w, i) => w === p.words[i]);

// ——— Mot manquant ———
export type ClozePuzzle = { before: string[]; answer: string; after: string[]; options: string[] };
/**
 * Un mot du verset est masqué (de préférence un mot long) ; 3 distracteurs pris dans les autres versets
 * de la même sourate (lettres différentes de la réponse).
 */
export function clozePuzzle(verse: string, pool: readonly string[], r: () => number, nOptions = 4): ClozePuzzle | null {
  const w = words(verse);
  const cands = w.map((x, i) => ({ i, n: letterKey(x).length })).filter((x) => x.n >= 3);
  if (!cands.length) return null;
  const top = cands.sort((a, b) => b.n - a.n).slice(0, Math.max(1, Math.ceil(cands.length / 2)));
  const i = top[Math.floor(r() * top.length)].i;
  const answer = w[i];
  const key = letterKey(answer);
  const seen = new Set([key]);
  const others: string[] = [];
  for (const x of shuffle(pool.flatMap(words), r)) {
    const k = letterKey(x);
    if (k.length < 2 || seen.has(k)) continue;
    seen.add(k);
    others.push(x);
    if (others.length >= nOptions - 1) break;
  }
  if (!others.length) return null;
  return { before: w.slice(0, i), answer, after: w.slice(i + 1), options: shuffle([answer, ...others], r) };
}

// ——— Suite du verset ———
export type ContinuePuzzle = { start: string; answer: string; options: string[] };
/** Début du verset affiché ; choisir la bonne suite parmi les fins d’autres versets de la sourate. */
export function continuePuzzle(verse: string, pool: readonly string[], r: () => number, nOptions = 3): ContinuePuzzle | null {
  const w = words(verse);
  if (w.length < 2) return null;
  const cut = Math.max(1, Math.floor(w.length / 2));
  const answer = w.slice(cut).join(' ');
  const seen = new Set([letterKey(answer)]);
  const others: string[] = [];
  for (const v of shuffle(pool, r)) {
    const vw = words(v);
    if (vw.length < 2) continue;
    const end = vw.slice(Math.max(1, Math.floor(vw.length / 2))).join(' ');
    const k = letterKey(end);
    if (seen.has(k)) continue;
    seen.add(k);
    others.push(end);
    if (others.length >= nOptions - 1) break;
  }
  if (!others.length) return null;
  return { start: w.slice(0, cut).join(' '), answer, options: shuffle([answer, ...others], r) };
}

// ——— Paliers (privés) ———
/** Palier 1 : versets courts (≤ 6 mots) ; 2 : ≤ 12 ; 3 : tous. Le nombre de choix augmente avec le palier. */
export const MAX_WORDS = [6, 12, Infinity] as const;
export const OPTIONS = [3, 4, 4] as const;
export type GameLevel = 0 | 1 | 2;
export const versesForLevel = (verses: readonly string[], lvl: GameLevel) => verses.map((v, i) => ({ v, i })).filter((x) => words(x.v).length <= MAX_WORDS[lvl] && words(x.v).length >= 2);
/** Palier suivant proposé après 8 bonnes réponses au premier essai d’affilée ; jamais imposé. */
export const levelUp = (streak: number, lvl: GameLevel): GameLevel => (streak >= 8 && lvl < 2 ? ((lvl + 1) as GameLevel) : lvl);

// ——— Révision espacée (SM-2) ———
/** Note SM-2 à partir du déroulé : du premier coup = facile, avec erreurs = moyen, révélé ou ≥ 3 erreurs = difficile. */
export function gradeOf(mistakes: number, revealed = false): Grade {
  if (revealed || mistakes >= 3) return 'hard';
  return mistakes === 0 ? 'easy' : 'medium';
}
export type Deck = Record<string, Card>;
/** Enregistre un résultat dans le paquet (clé libre : « order:2:255 », « name:12 »…). */
export function record(deck: Deck, key: string, g: Grade, today: string): Deck {
  return { ...deck, [key]: review(deck[key], g, today) };
}
/**
 * File du jour : d’abord les cartes à réviser (les plus en retard d’abord), puis des nouvelles (au plus `newMax`),
 * dans l’ordre de `keys`. Les cartes déjà vues aujourd’hui ou pas encore échues sont écartées.
 */
export function dueQueue(deck: Deck, keys: readonly string[], today: string, newMax = 5, max = 20): string[] {
  const due = keys.filter((k) => deck[k] && cardStatus(deck[k], today) === 'review').sort((a, b) => (deck[a].d < deck[b].d ? -1 : deck[a].d > deck[b].d ? 1 : 0));
  const fresh = keys.filter((k) => !deck[k]).slice(0, newMax);
  return [...due, ...fresh].slice(0, max);
}
/** Résumé privé (jamais affiché comme score) : cartes vues, à revoir aujourd’hui, bien ancrées (≥ 21 j). */
export function deckSummary(deck: Deck, keys: readonly string[], today: string) {
  let seen = 0, due = 0, solid = 0;
  for (const k of keys) {
    const c = deck[k];
    if (!c) continue;
    seen++;
    const st = cardStatus(c, today);
    if (st === 'review') due++;
    else if (st === 'memorised') solid++;
  }
  return { seen, due, solid, total: keys.length };
}
