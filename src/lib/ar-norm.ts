/** Normalisation de l’arabe pour la recherche et la comparaison (module pur, sans dépendance). */

/** Arabe : retire tashkīl, tatwīl, signes coraniques ; unifie alif / yā’ / tā’ marbūṭa / hamza. */
export function normAr(s: string): string {
  return s
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640\u08D3-\u08FF]/g, '')
    .replace(/[\u0622\u0623\u0625\u0671\u0672\u0673]/g, '\u0627')
    .replace(/\u0649/g, '\u064A')
    .replace(/\u0629/g, '\u0647')
    .replace(/[\u0624]/g, '\u0648')
    .replace(/[\u0626]/g, '\u064A')
    .replace(/\u0621/g, '')
    .replace(/[^\u0621-\u064A\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
export const hasArabic = (s: string) => /[\u0600-\u06FF]/.test(s);
