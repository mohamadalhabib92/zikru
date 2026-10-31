/**
 * Recherche par translittération (module pur, testé par scripts/test-quran-pass3.mjs).
 * La translittération (api.alquran.cloud « en.transliteration ») est irrégulière : voyelles longues doublées
 * (« Rahmaanir Raheem »), z pour ذ (« lazeena »), apostrophes pour ‘ayn… On compare donc une forme « écrasée » :
 * minuscules sans accents ni ponctuation, ee→i, oo→u, e→i, o→u, y→i, w→u, dh→z, th→s, q→k, lettres doublées fusionnées.
 * C’est une aide pour retrouver un verset, pas une lecture : le texte arabe reste la référence.
 */
export function squashTl(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’'‘ʿʾ`´]/g, '')
    .replace(/[^a-z\s]/g, ' ')
    .replace(/dh/g, 'z')
    .replace(/th/g, 's')
    .replace(/q/g, 'k')
    .replace(/ee/g, 'i')
    .replace(/oo/g, 'u')
    .replace(/e/g, 'i')
    .replace(/o/g, 'u')
    .replace(/y/g, 'i')
    .replace(/w/g, 'u')
    .replace(/([a-z])\1+/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}
/** Clé d’index d’un verset : forme écrasée sans espaces (« al-hamdu lillah » ≈ « alhamdulillah »). */
export const tlKey = (s: string) => squashTl(s).replace(/ /g, '');

/** 0 = pas de correspondance, 2 = expression entière, 1 = tous les mots (ordre libre). Requête : ≥ 3 lettres. */
export function tlMatch(key: string, q: string): 0 | 1 | 2 {
  const words = squashTl(q).split(' ').filter((w) => w.length >= 2);
  const whole = words.join('');
  if (whole.length < 3) return 0;
  if (key.includes(whole)) return 2;
  return words.length > 1 && words.every((w) => key.includes(w)) ? 1 : 0;
}
