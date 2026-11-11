/**
 * Istikhraj : relie le calcul abjad aux 99 Noms déjà dans l’app (liste de Tirmidhī 3507).
 * Aucun nom n’est ajouté. Aucune promesse : ce n’est qu’une égalité de nombres.
 */
import { computeAbjad, type AbjadOptions, type AbjadSystem } from './abjad';
import { NAMES, nameBare } from './names';

export type NameHit = { n: number; ar: string; bare: string; tr: string; fr: string; value: number };

/** Noms dont la valeur, sans l’article, est exactement `value`. */
export function namesByValue(value: number, system: AbjadSystem = 'mashriqi', opts: AbjadOptions = {}): NameHit[] {
  if (!Number.isFinite(value) || value <= 0) return [];
  const out: NameHit[] = [];
  for (const name of NAMES) {
    const bare = nameBare(name.ar);
    const v = computeAbjad(bare, system, opts).total;
    if (v === value) out.push({ n: name.n, ar: name.ar, bare, tr: name.tr, fr: name.fr, value: v });
  }
  return out;
}

/**
 * Note de la recette de tawassul : « 50 = واحد أحد حي ».
 * Ce sont trois mots additionnés, pas un Nom de la liste.
 * الأحد n’est pas dans l’énumération de Tirmidhī utilisée ici (elle a الواحد, pas الأحد).
 */
export function wahidAhadHayy(system: AbjadSystem = 'mashriqi', opts: AbjadOptions = {}): { parts: { ar: string; value: number }[]; total: number } {
  const parts = ['واحد', 'أحد', 'حي'].map((ar) => ({ ar, value: computeAbjad(ar, system, opts).total }));
  return { parts, total: parts.reduce((a, p) => a + p.value, 0) };
}
