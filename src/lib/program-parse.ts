/**
 * Programmes de zikr importés (collage, photo, PDF) : découpe en étapes « formule × nombre », dans l’ordre.
 * Module pur, sans dépendance. Rien n’est deviné en silence : un nombre douteux est signalé (`sure: false`),
 * un nombre absent reste `null` (« nombre à préciser ») et chaque ligne non retenue est rendue dans `ignored`.
 */

export type ProgramStep = {
  /** Position (1, 2, 3…) dans le programme tel qu’il est lu. */
  order: number;
  /** Index de page (0 pour un texte collé ou une photo). */
  page: number;
  /** Numéros de ligne (0-based, dans la page) dont provient l’étape. */
  lines: number[];
  /** Texte arabe de la formule, copié tel quel de la source (sans le nombre ni la numérotation). */
  ar: string;
  /** Texte latin de l’étape quand la source n’a pas d’arabe (ex. « Astaghfirullah »). */
  latin: string;
  /** Titre latin lu juste avant la formule (ex. « Salat al-Fatih »), simple indication. */
  hint: string;
  /** Nombre de répétitions, ou null s’il n’a pas été trouvé. */
  count: number | null;
  /** Morceau de texte d’où vient le nombre (ex. « ×100 », « ١٠٠ مرة »). */
  countRaw: string;
  /** false : nombre lu sans marque explicite (« (100) », nombre seul en fin de ligne) ou plusieurs nombres : à confirmer. */
  sure: boolean;
  /** Autres nombres trouvés sur la même étape (signalés, jamais choisis à la place de l’utilisateur). */
  alt: number[];
};
export type IgnoredLine = { page: number; line: number; text: string };
export type ParsedProgram = { steps: ProgramStep[]; ignored: IgnoredLine[] };

const AR_LETTER = /[\u0621-\u064A\u066E-\u06D3\u06D5\u06FA-\u06FC\uFB50-\uFDFF\uFE70-\uFEFC]/;
const HAS_AR = new RegExp(AR_LETTER.source);
const HAS_LATIN = /[A-Za-zÀ-ÖØ-öø-ÿĀ-žḀ-ỿ]/;

/** Chiffres arabes-indiens (٠-٩) et persans (۰-۹) → 0-9, caractère pour caractère (les positions restent valables). */
export function latinDigits(s: string): string {
  return s.replace(/[\u0660-\u0669]/g, (c) => String(c.charCodeAt(0) - 0x0660)).replace(/[\u06F0-\u06F9]/g, (c) => String(c.charCodeAt(0) - 0x06f0));
}

// Arabe : tolère tashkīl/tatwīl entre les lettres et les variantes alif/hamza, tā’ marbūṭa/hā’.
const D = '[\\u064B-\\u0652\\u0670\\u0640]*';
const AR_VAR: Record<string, string> = { 'ا': '[اأإآ]', 'ة': '[ةه]', 'ي': '[يى]' };
const arPat = (w: string) => [...w].map((c) => (c === ' ' ? '\\s+' : (AR_VAR[c] ?? c) + D)).join('');
const MARRA = arPat('مرة');
const MARRAT = arPat('مرات');
const AR_UNITS: [string, number][] = [
  ['ثلاث', 3], ['اربع', 4], ['خمس', 5], ['ست', 6], ['سبع', 7], ['ثماني', 8], ['ثمان', 8], ['تسع', 9], ['عشر', 10],
];
const AR_HUNDRED = `(?:${arPat('مائة')}|${arPat('مئة')}|${arPat('ماية')})`;

const FR_UNITS: Record<string, number> = { un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10, onze: 11, douze: 12, vingt: 20, trente: 30, quarante: 40, cinquante: 50, cent: 100, mille: 1000 };
const EN_UNITS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, twenty: 20, thirty: 30, forty: 40, fifty: 50, hundred: 100, 'a hundred': 100, 'one hundred': 100, thousand: 1000, 'a thousand': 1000, 'one thousand': 1000 };

type Rule = { re: RegExp; value: (m: RegExpExecArray) => number; sure: boolean };
const NB = '(?<![\\p{L}\\p{N}])';
const NA = '(?![\\p{L}\\p{N}])';
const RULES: Rule[] = [
  // ×100, x 100, X100
  { re: new RegExp(`(?<![\\p{L}\\p{N}])[×xX✕✖]\\s*(\\d{1,6})(?!\\d)`, 'gu'), value: (m) => +m[1], sure: true },
  // 100×, 100 x
  { re: new RegExp(`${NB}(\\d{1,6})\\s*[×xX✕✖]${NA}`, 'gu'), value: (m) => +m[1], sure: true },
  // 100 fois, 100 times, ١٠٠ مرة / مرات
  { re: new RegExp(`${NB}(\\d{1,6})\\s*(?:fois|times?|${MARRA}|${MARRAT}|${arPat('مره')})${NA}`, 'giu'), value: (m) => +m[1], sure: true },
  // Arabe en lettres (toujours suivi de مرة/مرات, sinon ignoré)
  { re: new RegExp(`${NB}${arPat('الف')}\\s+${MARRA}${NA}`, 'gu'), value: () => 1000, sure: true },
  { re: new RegExp(`${NB}(${AR_UNITS.slice(0, 8).map(([w]) => arPat(w)).join('|')})\\s*${AR_HUNDRED}\\s+${MARRA}${NA}`, 'gu'), value: (m) => 100 * arUnit(m[1]), sure: true },
  { re: new RegExp(`${NB}(?:${arPat('مائتي')}|${arPat('مئتي')}|${arPat('مائتين')}|${arPat('مئتين')})\\s+${MARRA}${NA}`, 'gu'), value: () => 200, sure: true },
  { re: new RegExp(`${NB}${AR_HUNDRED}\\s+${MARRA}${NA}`, 'gu'), value: () => 100, sure: true },
  { re: new RegExp(`${NB}(${AR_UNITS.map(([w]) => arPat(w)).join('|')})\\s+${MARRAT}${NA}`, 'gu'), value: (m) => arUnit(m[1]), sure: true },
  { re: new RegExp(`${NB}(?:${arPat('مرتين')}|${arPat('مرتان')})${NA}`, 'gu'), value: () => 2, sure: true },
  { re: new RegExp(`${NB}${MARRA}\\s*${arPat('واحدة')}${NA}`, 'gu'), value: () => 1, sure: true },
  // Français / anglais en lettres
  { re: new RegExp(`${NB}(${Object.keys(FR_UNITS).join('|')})\\s+fois${NA}`, 'giu'), value: (m) => FR_UNITS[m[1].toLowerCase()], sure: true },
  { re: new RegExp(`${NB}(${Object.keys(EN_UNITS).sort((a, b) => b.length - a.length).join('|')})\\s+times${NA}`, 'giu'), value: (m) => EN_UNITS[m[1].toLowerCase()], sure: true },
  { re: new RegExp(`${NB}(once|twice|thrice)${NA}`, 'giu'), value: (m) => ({ once: 1, twice: 2, thrice: 3 })[m[1].toLowerCase() as 'once'], sure: true },
  // (100) ou [100] : probablement un nombre, à confirmer (les numéros de verset ﴿١﴾ ne sont pas concernés)
  { re: /[([]\s*(\d{1,6})\s*[)\]]/gu, value: (m) => +m[1], sure: false },
];
function arUnit(w: string): number {
  const n = w.replace(/[\u064B-\u0652\u0670\u0640]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي');
  for (const [k, v] of AR_UNITS) if (n === k) return v;
  return 0;
}

type Hit = { start: number; end: number; n: number; raw: string; sure: boolean };
/** Nombres de répétitions trouvés dans une ligne (positions dans la ligne d’origine). */
export function findCounts(line: string): Hit[] {
  const w = latinDigits(line);
  const hits: Hit[] = [];
  for (const r of RULES) {
    r.re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = r.re.exec(w))) {
      const start = m.index;
      const end = start + m[0].length;
      if (hits.some((h) => start < h.end && end > h.start)) continue;
      const n = r.value(m);
      if (n > 0) hits.push({ start, end, n, raw: line.slice(start, end).trim(), sure: r.sure });
    }
  }
  if (!hits.length) {
    // Nombre seul en fin de ligne (« أستغفر الله 100 ») : retenu mais à confirmer.
    const m = /(?:^|\s)(\d{1,6})\s*[.:;]?\s*$/u.exec(w);
    if (m && +m[1] > 0) {
      const start = m.index + m[0].indexOf(m[1]);
      hits.push({ start, end: start + m[1].length, n: +m[1], raw: line.slice(start, start + m[1].length), sure: false });
    }
  }
  return hits.sort((a, b) => a.start - b.start);
}

/** Numérotation de liste en début de ligne (« 1. », « ١- », « 2) », « • ») : retirée, jamais lue comme un nombre. */
const NUMBERING = /^\s*(?:[-–—•·▪●◦*]+|\(?[0-9\u0660-\u0669\u06F0-\u06F9]{1,3}\s*[.)\-–—:،]|[0-9\u0660-\u0669\u06F0-\u06F9]{1,3}\s*[-–—])\s+/u;
const TRIM = /^[\s\-–—:,;.|·•،؛()[\]«»"“”'’=+/]+|[\s\-–—:,;.|·•،؛()[\]«»"“”'’=+/]+$/gu;

function arabicSpan(s: string): { ar: string; rest: string } {
  let a = -1;
  let b = -1;
  for (let i = 0; i < s.length; i++) if (AR_LETTER.test(s[i])) { if (a < 0) a = i; b = i; }
  if (a < 0) return { ar: '', rest: s };
  // garde les signes (tashkīl, šadda…) qui suivent la dernière lettre
  while (b + 1 < s.length && /[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/.test(s[b + 1])) b++;
  return { ar: s.slice(a, b + 1).trim(), rest: (s.slice(0, a) + ' ' + s.slice(b + 1)).replace(TRIM, '').trim() };
}

type Lexed = { line: number; text: string; ar: string; latin: string; counts: Hit[] };
function lex(text: string, line: number): Lexed {
  let s = text.replace(NUMBERING, '');
  const counts = findCounts(s);
  // retire les nombres (de la fin vers le début pour garder les positions)
  for (const h of [...counts].reverse()) s = s.slice(0, h.start) + ' ' + s.slice(h.end);
  s = s.replace(TRIM, '').replace(/\s+/g, ' ').trim();
  const { ar, rest } = arabicSpan(s);
  const latin = HAS_LATIN.test(rest) ? rest.replace(TRIM, '').trim() : '';
  return { line, text, ar, latin: ar ? '' : latin, counts };
}

/**
 * Découpe un programme (une chaîne par page) en étapes.
 * Règles : une ligne « formule + nombre » = une étape ; des lignes arabes consécutives sans nombre suivies
 * d’un nombre forment une seule étape (formule sur plusieurs lignes) ; une ligne qui ne contient qu’un nombre
 * complète l’étape qui précède ; une ligne vide termine une formule ; un titre latin sans nombre suivi d’arabe
 * devient une simple indication.
 */
export function parseProgram(pages: string[]): ParsedProgram {
  const steps: ProgramStep[] = [];
  const ignored: IgnoredLine[] = [];
  pages.forEach((pageText, page) => {
    const lines = pageText.replace(/\r\n?/g, '\n').split('\n');
    let pend: Lexed[] = [];
    let heading: Lexed | null = null;
    const push = (parts: Lexed[], countFrom: Lexed | null, latin = '') => {
      const counts = countFrom ? countFrom.counts : [];
      const distinct = [...new Set(counts.map((c) => c.n))];
      steps.push({
        order: steps.length + 1,
        page,
        lines: [...new Set([...parts.map((p) => p.line), ...(countFrom ? [countFrom.line] : [])])],
        ar: parts.map((p) => p.ar).filter(Boolean).join(' '),
        latin,
        hint: heading ? heading.latin : '',
        count: counts.length ? counts[0].n : null,
        countRaw: counts.map((c) => c.raw).join(' '),
        sure: counts.length > 0 && distinct.length === 1 && counts.every((c) => c.sure),
        alt: distinct.slice(1),
      });
      heading = null;
    };
    const flush = () => {
      if (pend.length) push(pend, null);
      pend = [];
    };
    const dropHeading = () => {
      if (heading) ignored.push({ page, line: heading.line, text: heading.text.trim() });
      heading = null;
    };
    lines.forEach((raw, i) => {
      if (!raw.trim()) {
        flush();
        return;
      }
      const l = lex(raw, i);
      const hasCount = l.counts.length > 0;
      if (l.ar) {
        if (hasCount) {
          push([...pend, l], l);
          pend = [];
        } else pend.push(l);
        return;
      }
      if (!l.latin && hasCount) {
        // ligne « ×100 » seule : complète la formule en attente, ou l’étape précédente si son nombre manque
        if (pend.length) {
          push(pend, l);
          pend = [];
        } else if (heading) {
          const h: Lexed = heading;
          push([h], l, h.latin);
        } else {
          const prev = steps[steps.length - 1];
          if (prev && prev.page === page && prev.count === null) {
            const distinct = [...new Set(l.counts.map((c) => c.n))];
            prev.count = l.counts[0].n;
            prev.countRaw = l.counts.map((c) => c.raw).join(' ');
            prev.sure = distinct.length === 1 && l.counts.every((c) => c.sure);
            prev.alt = distinct.slice(1);
            prev.lines.push(i);
          } else ignored.push({ page, line: i, text: raw.trim() });
        }
        return;
      }
      if (l.latin && hasCount) {
        flush();
        dropHeading();
        push([], l, l.latin);
        return;
      }
      if (l.latin) {
        // titre latin : indication pour la formule arabe qui suit, sinon ligne ignorée
        flush();
        dropHeading();
        heading = l;
        return;
      }
      flush();
      ignored.push({ page, line: i, text: raw.trim() });
    });
    flush();
    dropHeading();
  });
  return { steps, ignored };
}

/** Le texte contient-il de l’arabe (lettres de base ou formes de présentation) ? */
export const programHasArabic = (s: string) => HAS_AR.test(s);
