/**
 * Lecture multilingue (Apple Vision) : choix des langues à demander et fusion de deux passes
 * (modèle arabe, puis modèle latin en détection automatique). Module pur, testé dans scripts/test-programs.mjs.
 * Rien n’est corrigé : chaque ligne gardée est exactement celle qu’une des passes a lue.
 */
import type { OcrLine } from './ocr-types';

/** Codes Vision de l’écriture arabe (iOS 18+). */
export const ARABIC_CODES = ['ar-SA', 'ars-SA'];
/** Ordre de préférence des autres langues (les codes absents de l’appareil sont simplement ignorés). */
const PREFERRED = ['fr-FR', 'en-US', 'en-GB', 'de-DE', 'it-IT', 'es-ES', 'pt-BR', 'pt-PT', 'tr-TR', 'id-ID', 'ms-MY', 'nl-NL'];
/** Chinois / japonais / coréen / thaï / cantonais : Vision ne les accepte pas avec n’importe quelle autre langue. */
const SEPARATE = /^(zh|yue|ja|ko|th)(-|$)/;

export type OcrPlan = {
  /** Passe 1 : écriture arabe (vide si l’appareil ne la propose pas, iOS < 18). */
  arabic: string[];
  /** Passe 2 : langues latines et autres (cyrillique, vietnamien…), arabe exclu, en détection automatique. */
  others: string[];
};

/** Répartit les langues proposées par l’appareil (supportedRecognitionLanguages) en passes. */
export function planLanguages(supported: string[]): OcrPlan {
  const all = [...new Set(supported)];
  const arabic = ARABIC_CODES.filter((l) => all.includes(l));
  const rest = all.filter((l) => !arabic.includes(l) && !SEPARATE.test(l));
  const others = [...PREFERRED.filter((l) => rest.includes(l)), ...rest.filter((l) => !PREFERRED.includes(l))];
  return { arabic, others };
}

const AR = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/;
const LETTER = /\p{L}/u;

type Box = [number, number, number, number];
const boxOf = (l: OcrLine): Box | null => (Array.isArray(l.box) && l.box.length === 4 ? (l.box as Box) : null);
/** Part de la plus petite boîte couverte par l’autre (0 à 1). */
function overlap(a: Box, b: Box): number {
  const w = Math.min(a[0] + a[2], b[0] + b[2]) - Math.max(a[0], b[0]);
  const h = Math.min(a[1] + a[3], b[1] + b[3]) - Math.max(a[1], b[1]);
  if (w <= 0 || h <= 0) return 0;
  const min = Math.min(a[2] * a[3], b[2] * b[3]);
  return min > 0 ? (w * h) / min : 0;
}

/**
 * Fusionne la passe arabe et la passe « autres langues ».
 * - Une ligne de la passe arabe qui contient de l’arabe est gardée : le modèle latin ne sait pas lire cette écriture.
 * - Sinon, pour une même zone, on garde la lecture de meilleure confiance.
 * - Les lignes vues par une seule passe sont toutes gardées. Ordre final : de haut en bas, puis de gauche à droite.
 * Sans positions (ancien build), on garde la passe arabe si elle contient de l’arabe, sinon la meilleure passe.
 */
export function mergePasses(arabic: OcrLine[], others: OcrLine[]): OcrLine[] {
  const A = arabic.filter((l) => l.text.trim());
  const B = others.filter((l) => l.text.trim());
  if (!A.length) return B;
  if (!B.length) return A;
  if (![...A, ...B].every(boxOf)) {
    if (A.some((l) => AR.test(l.text))) return A;
    const avg = (xs: OcrLine[]) => xs.reduce((s, l) => s + l.confidence, 0) / xs.length;
    return avg(B) > avg(A) ? B : A;
  }
  const usedB = new Set<number>();
  const out: OcrLine[] = [];
  for (const a of A) {
    const near = B.map((b, i) => [i, overlap(boxOf(a)!, boxOf(b)!)] as const).filter(([, o]) => o >= 0.5);
    if (AR.test(a.text)) {
      near.forEach(([i]) => usedB.add(i));
      out.push(a);
      continue;
    }
    const free = near.filter(([i]) => !usedB.has(i));
    const best = free.map(([i]) => B[i]).filter((b) => LETTER.test(b.text) || !LETTER.test(a.text)).sort((x, y) => y.confidence - x.confidence)[0];
    free.forEach(([i]) => usedB.add(i));
    out.push(best && best.confidence >= a.confidence ? best : a);
  }
  B.forEach((b, i) => {
    if (!usedB.has(i)) out.push(b);
  });
  // origine en bas à gauche : y décroissant = de haut en bas
  return out.sort((x, y) => {
    const bx = boxOf(x)!;
    const by = boxOf(y)!;
    const dy = by[1] + by[3] / 2 - (bx[1] + bx[3] / 2);
    return Math.abs(dy) > Math.min(bx[3], by[3]) / 2 ? dy : bx[0] - by[0];
  });
}
