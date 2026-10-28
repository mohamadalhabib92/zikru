/**
 * Calcul abjad (ḥisāb al-jummal) — logique pure, sans dépendance.
 * Deux ordres de valeurs : mashriqi (oriental) et maghribi (occidental).
 * Ils ne diffèrent que sur six lettres : ص ض س ظ غ ش.
 */
export type AbjadSystem = 'mashriqi' | 'maghribi';

export type AbjadOptions = {
  /** ة compte comme ه (5) par défaut, ou comme ت (400). */
  taMarbuta?: 'ha' | 'ta';
  /** ء isolé compte 1 (comme alif) par défaut, ou 0. */
  hamza?: 1 | 0;
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

// Tashkeel (U+064B–U+065F), alif suscrit (U+0670), signes coraniques (U+06D6–U+06ED), tatweel (U+0640)
const DIACRITICS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED\u0640]/g;

const FOLD: Record<string, string> = {
  أ: 'ا', إ: 'ا', آ: 'ا', ٱ: 'ا', ٲ: 'ا', ٳ: 'ا',
  ى: 'ي', ی: 'ي', ئ: 'ي', ؤ: 'و',
  ک: 'ك', ڪ: 'ك', ہ: 'ه', ھ: 'ه', ۀ: 'ه',
  // variantes maghrébines (points en dessous / au-dessus)
  ڢ: 'ف', ڧ: 'ق', ٯ: 'ق',
};

/** Normalise un texte arabe : retire tashkeel/tatweel, uniformise les variantes de lettres. ة et ء sont conservés. */
export function normalizeArabic(input: string): string {
  let s = input.normalize('NFC').replace(DIACRITICS, '');
  s = s.replace(/./gu, (c) => FOLD[c] ?? c);
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
export type AbjadResult = { system: AbjadSystem; normalized: string; words: WordPart[]; letters: LetterPart[]; total: number; root: number; ignored: string[] };

/** Racine numérique (somme itérée des chiffres, 0 si total 0). */
export function digitalRoot(n: number): number {
  if (n <= 0) return 0;
  return 1 + ((n - 1) % 9);
}

export function computeAbjad(input: string, system: AbjadSystem, opts: AbjadOptions = {}): AbjadResult {
  const normalized = normalizeArabic(input);
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
  return { system, normalized, words, letters, total, root: digitalRoot(total), ignored: [...ignored] };
}

export const ABJAD_EXAMPLES = ['بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ', 'اللَّه', 'مُحَمَّد', 'سُبْحَانَ اللَّهِ', 'شَمْس', 'رَحْمَة'];
