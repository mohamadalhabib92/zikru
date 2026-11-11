/**
 * Calcul abjad (ḥisāb al-jummal), abjad kabīr — logique pure, sans dépendance.
 *
 * Mashriqi (oriental, défaut) : أبجد هوز حطي كلمن سعفص قرشت ثخذ ضظغ.
 *   1–9, 10–90, 100–900, غ = 1000. Même série que l’abjad oriental classique.
 * Maghribi (Maghreb, al-Andalus) : les mêmes valeurs, sauf six lettres,
 *   ص 60, ض 90, س 300, ظ 800, غ 900, ش 1000.
 *   C’est l’ordre occidental rappelé par G. S. Colin, « Abjad », Encyclopaedia of Islam, 2e éd.
 *   (les groupes deviennent سعفض، قرست، ثخذ، ضظغ، et ش porte le millier).
 *
 * Normalisation, dans cet ordre :
 * 1. ligatures lam-alif (U+FEF5–FEFC) → ل + alif (آ أ إ ou ا) ;
 * 2. voyelles et signes retirés, sauf la shadda si on demande de la compter deux fois ;
 * 3. shadda : une fois par défaut (la lettre reste une) ; deux fois si l’option est demandée ;
 * 4. آ : 1 par défaut (un alif) ; 2 si l’option « alif madda » est demandée (alif + alif) ;
 * 5. ٱ alif waslah : 1 (comme alif) par défaut ; 0 si l’option est demandée ;
 * 6. أ إ ٱ (restant) ى ؤ ئ et les variantes de graphie ramenés à leur lettre de base ;
 * 7. ة et ء isolé restent, et suivent leurs options ;
 * 8. chiffres, espaces et lettres non arabes ne comptent pas.
 * La hamza portée (أ إ ؤ ئ) ne s’ajoute pas à la lettre d’appui : seul le siège compte.
 */
export type AbjadSystem = 'mashriqi' | 'maghribi';

export type AbjadOptions = {
  /** ة compte comme ه (5) par défaut, ou comme ت (400). */
  taMarbuta?: 'ha' | 'ta';
  /** ء isolé compte 1 (comme alif) par défaut, ou 0. */
  hamza?: 1 | 0;
  /** آ compte 1 (défaut, usage qui donne آدم = 45) ou 2 (alif + madd). */
  madda?: 'one' | 'two';
  /** Lettre portant une shadda : une fois (défaut) ou deux fois. */
  shadda?: 'once' | 'twice';
  /** ٱ : comme un alif (1, défaut) ou ignoré (0). */
  wasl?: 'alif' | 'zero';
};

export const MASHRIQI: Record<string, number> = {
  ا: 1, ب: 2, ج: 3, د: 4, ه: 5, و: 6, ز: 7, ح: 8, ط: 9,
  ي: 10, ك: 20, ل: 30, م: 40, ن: 50, س: 60, ع: 70, ف: 80, ص: 90,
  ق: 100, ر: 200, ش: 300, ت: 400, ث: 500, خ: 600, ذ: 700, ض: 800, ظ: 900, غ: 1000,
};

export const MAGHRIBI: Record<string, number> = { ...MASHRIQI, ص: 60, ض: 90, س: 300, ظ: 800, غ: 900, ش: 1000 };

export const TABLES: Record<AbjadSystem, Record<string, number>> = { mashriqi: MASHRIQI, maghribi: MAGHRIBI };

/** Lettres dont la valeur diffère entre les deux systèmes. */
export const DIFF_LETTERS = Object.keys(MASHRIQI).filter((k) => MASHRIQI[k] !== MAGHRIBI[k]);

/** Ordre traditionnel « abjad hawwaz » (mashriqi). */
export const ORDER_MASHRIQI = 'ابجدهوزحطيكلمنسعفصقرشتثخذضظغ'.split('');

// Voyelles, sukūn, shadda, alif suscrit, signes coraniques, tatwīl. La shadda est traitée à part.
const SHADDA = '\u0651';
const DIACRITICS_KEEP_SHADDA = /[\u0610-\u061A\u064B-\u0650\u0652-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED\u0640]/g;
/** Ligatures de présentation lam-alif → deux lettres (ou lam + alif madda). */
const LAM_ALIF: Record<string, string> = {
  '\uFEFB': 'لا', '\uFEFC': 'لا',
  '\uFEF5': 'لآ', '\uFEF6': 'لآ',
  '\uFEF7': 'لأ', '\uFEF8': 'لأ',
  '\uFEF9': 'لإ', '\uFEFA': 'لإ',
};

const FOLD: Record<string, string> = {
  أ: 'ا', إ: 'ا', آ: 'ا', ٱ: 'ا', ٲ: 'ا', ٳ: 'ا',
  ى: 'ي', ی: 'ي', ئ: 'ي', ؤ: 'و',
  ک: 'ك', ڪ: 'ك', ہ: 'ه', ھ: 'ه', ۀ: 'ه',
  // variantes maghrébines (points en dessous / au-dessus)
  ڢ: 'ف', ڧ: 'ق', ٯ: 'ق',
};

/**
 * Normalise un texte arabe selon les options. ة et ء isolé sont conservés.
 * Les défauts reproduisent l’usage déjà testé (آ = 1, shadda = une fois, ٱ = 1).
 */
export function normalizeArabic(input: string, opts: AbjadOptions = {}): string {
  let s = input.normalize('NFC').replace(/[\uFEF5-\uFEFC]/g, (c) => LAM_ALIF[c] ?? c);
  s = s.replace(DIACRITICS_KEEP_SHADDA, '');
  if (opts.shadda === 'twice') s = s.replace(new RegExp(`(.)(${SHADDA})`, 'gu'), '$1$1');
  s = s.replace(new RegExp(SHADDA, 'g'), '');
  if (opts.madda === 'two') s = s.replace(/آ/g, 'اا');
  if (opts.wasl === 'zero') s = s.replace(/ٱ/g, '');
  s = s.replace(/./gu, (c) => FOLD[c] ?? c);
  return s;
}

/** Abjad saghīr : la valeur kabīr ramenée à un chiffre de 1 à 9 (le reste 0 reste 9, comme 9, 18, 90…). */
export function saghirDigit(n: number): number {
  if (n <= 0) return 0;
  const r = n % 9;
  return r === 0 ? 9 : r;
}

/** Somme des chiffres, une seule fois (786 → 21). */
export function digitSum(n: number): number {
  if (n <= 0) return 0;
  let s = 0;
  for (let x = Math.floor(n); x > 0; x = Math.floor(x / 10)) s += x % 10;
  return s;
}

export function letterValue(ch: string, system: AbjadSystem, opts: AbjadOptions = {}): number | null {
  const t = TABLES[system];
  if (ch === 'ة') return opts.taMarbuta === 'ta' ? t['ت'] : t['ه'];
  if (ch === 'ء') return opts.hamza === 0 ? 0 : 1;
  return ch in t ? t[ch] : null;
}

export type LetterPart = { ch: string; value: number };
export type WordPart = { word: string; letters: LetterPart[]; total: number };
export type AbjadResult = {
  system: AbjadSystem;
  normalized: string;
  words: WordPart[];
  letters: LetterPart[];
  /** Abjad kabīr. */
  total: number;
  /** Somme des chiffres du total, une fois. */
  digitSum: number;
  /** Somme répétée jusqu’à un chiffre. */
  root: number;
  /** Somme des abjad saghīr de chaque lettre. */
  saghir: number;
  ignored: string[];
};

/** Racine numérique (somme itérée des chiffres, 0 si total 0). */
export function digitalRoot(n: number): number {
  if (n <= 0) return 0;
  return 1 + ((n - 1) % 9);
}

export function computeAbjad(input: string, system: AbjadSystem, opts: AbjadOptions = {}): AbjadResult {
  const normalized = normalizeArabic(input, opts);
  const ignored = new Set<string>();
  const words: WordPart[] = [];
  for (const w of normalized.split(/[^\u0621-\u064A]+/u).filter(Boolean)) {
    const letters: LetterPart[] = [];
    for (const ch of w) {
      const v = letterValue(ch, system, opts);
      if (v === null) ignored.add(ch);
      else letters.push({ ch, value: v });
    }
    if (letters.length) words.push({ word: letters.map((l) => l.ch).join(''), letters, total: letters.reduce((a, l) => a + l.value, 0) });
  }
  for (const ch of normalized) if (/\p{L}/u.test(ch) && !/[\u0621-\u064A]/u.test(ch)) ignored.add(ch);
  const letters = words.flatMap((w) => w.letters);
  const total = words.reduce((a, w) => a + w.total, 0);
  const saghir = letters.reduce((a, l) => a + saghirDigit(l.value), 0);
  return { system, normalized, words, letters, total, digitSum: digitSum(total), root: digitalRoot(total), saghir, ignored: [...ignored] };
}

export const ABJAD_EXAMPLES = ['بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ', 'اللَّه', 'مُحَمَّد', 'سُبْحَانَ اللَّهِ', 'شَمْس', 'رَحْمَة'];
