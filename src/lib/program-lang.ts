/**
 * Langues probables d’un texte lu (programme importé) : simple estimation à partir de l’écriture et de mots
 * très courants. Affichée à l’utilisateur comme une indication, jamais utilisée pour modifier le texte.
 */
export type LangCode = 'ar' | 'ur' | 'fr' | 'en' | 'de' | 'it' | 'es' | 'pt' | 'tr' | 'id' | 'wo' | 'latin';

/** Libellés (français, traduits par le catalogue d’interface). */
export const LANG_LABEL: Record<LangCode, string> = {
  ar: 'arabe',
  ur: 'ourdou',
  fr: 'français',
  en: 'anglais',
  de: 'allemand',
  it: 'italien',
  es: 'espagnol',
  pt: 'portugais',
  tr: 'turc',
  id: 'indonésien / malais',
  wo: 'wolof',
  latin: 'écriture latine (langue non identifiée)',
};

const ARABIC_SCRIPT = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/;
/** Lettres propres à l’ourdou (ٹ ڈ ڑ ں ے ۓ ھ). */
const URDU = /[\u0679\u0688\u0691\u06BA\u06D2\u06D3\u06BE]/;
const LATIN = /[A-Za-zÀ-ÖØ-öø-ÿĀ-žḀ-ỿ]/;

/** Mots marqueurs : un mot de répétition compte double, les mots outils simple. */
const MARKERS: Record<Exclude<LangCode, 'ar' | 'ur' | 'latin'>, { strong: string[]; weak: string[] }> = {
  fr: { strong: ['fois'], weak: ['le', 'la', 'les', 'et', 'puis', 'ensuite', 'après', 'avant', 'chaque', 'matin', 'soir', 'prière', 'du', 'des'] },
  en: { strong: ['times', 'once', 'twice'], weak: ['the', 'and', 'then', 'after', 'before', 'each', 'every', 'morning', 'evening', 'prayer', 'of'] },
  de: { strong: ['mal'], weak: ['der', 'die', 'das', 'und', 'dann', 'nach', 'vor', 'jeden', 'morgens', 'abends', 'gebet'] },
  it: { strong: ['volte', 'volta'], weak: ['il', 'gli', 'e', 'poi', 'dopo', 'prima', 'ogni', 'mattina', 'sera', 'preghiera'] },
  es: { strong: ['veces'], weak: ['el', 'los', 'las', 'y', 'luego', 'después', 'antes', 'cada', 'mañana', 'tarde', 'oración'] },
  pt: { strong: ['vezes'], weak: ['o', 'os', 'as', 'e', 'depois', 'antes', 'cada', 'manhã', 'noite', 'oração'] },
  tr: { strong: ['defa', 'kere', 'kez'], weak: ['ve', 'sonra', 'önce', 'her', 'sabah', 'akşam', 'namaz', 'namazdan'] },
  id: { strong: ['kali'], weak: ['dan', 'lalu', 'kemudian', 'setelah', 'sebelum', 'setiap', 'pagi', 'petang', 'sholat', 'solat', 'sebanyak'] },
  wo: { strong: ['yoon'], weak: ['ak', 'ba', 'ci', 'gannaaw', 'bu', 'nekk'] },
};

/** Langues probables, dans l’ordre d’importance (écritures d’abord). */
export function detectLanguages(text: string): LangCode[] {
  const out: LangCode[] = [];
  if (ARABIC_SCRIPT.test(text)) out.push(URDU.test(text) ? 'ur' : 'ar');
  if (URDU.test(text) && !out.includes('ur')) out.push('ur');
  if (!LATIN.test(text)) return out;
  const words = text.toLowerCase().normalize('NFC').match(/\p{L}+/gu) ?? [];
  const scores: [LangCode, number][] = [];
  for (const [code, m] of Object.entries(MARKERS) as [LangCode, { strong: string[]; weak: string[] }][]) {
    let n = 0;
    for (const w of words) n += m.strong.includes(w) ? 2 : m.weak.includes(w) ? 1 : 0;
    if (n >= 2) scores.push([code, n]);
  }
  scores.sort((a, b) => b[1] - a[1]);
  const top = scores[0]?.[1] ?? 0;
  // garde les langues proches de la meilleure (texte mixte), au plus 3
  const kept = scores.filter(([, n]) => n >= Math.max(2, top / 3)).slice(0, 3).map(([c]) => c);
  return [...out, ...(kept.length ? kept : ['latin' as const])];
}
