/**
 * Tajwid (module pur) : leçons par règle (riwāya Ḥafṣ ‘an ‘Āṣim), lecture des annotations colorées au format
 * « [code[lettres] » (édition « quran-tajweed » d’alquran.cloud / GlobalQuran) et quiz.
 *
 * - Les textes des leçons sont des définitions usuelles, À RELIRE PAR UN ENSEIGNANT DE TAJWID (fiche de validation).
 * - Les exemples sont désignés par (sourate, verset, mots) : le mot est lu dans le texte Tanzil embarqué, jamais recopié.
 * - Le mushaf coloré n’est activé que si la licence des annotations est confirmée (PLACEHOLDERS.TAJWID_DATA_LICENSE),
 *   et uniquement verset par verset si le texte annoté, une fois les marques retirées, est IDENTIQUE au texte Tanzil
 *   (sinon on affiche le texte Tanzil sans couleur : le Coran n’est jamais altéré).
 * - L’app n’évalue ni ne corrige la récitation.
 */
import { isPlaceholder, PLACEHOLDERS } from './app-placeholders';

export const TAJWID_REVIEW_NOTE = 'À relire par un enseignant de tajwid';

/** Familles de règles (couleur commune). */
export type RuleGroup = 'ghunna' | 'madd' | 'qalqala' | 'ikhfa' | 'idgham' | 'iqlab' | 'silent';
/** Codes de l’édition « quran-tajweed » (documentation islamic-network/alquran-tools, tajweed.md). */
export const CODES: Record<string, { group: RuleGroup; name: string }> = {
  h: { group: 'silent', name: 'Hamzat al-waṣl' },
  s: { group: 'silent', name: 'Lettre non prononcée' },
  l: { group: 'silent', name: 'Lām shamsiyya' },
  n: { group: 'madd', name: 'Madd naturel (2 temps)' },
  p: { group: 'madd', name: 'Madd permis (2, 4 ou 6 temps)' },
  m: { group: 'madd', name: 'Madd nécessaire (6 temps)' },
  o: { group: 'madd', name: 'Madd obligatoire (4 ou 5 temps)' },
  q: { group: 'qalqala', name: 'Qalqala' },
  c: { group: 'ikhfa', name: 'Ikhfā’ shafawī' },
  f: { group: 'ikhfa', name: 'Ikhfā’' },
  w: { group: 'idgham', name: 'Idghām shafawī' },
  i: { group: 'iqlab', name: 'Iqlāb' },
  a: { group: 'idgham', name: 'Idghām avec ghunna' },
  u: { group: 'idgham', name: 'Idghām sans ghunna' },
  d: { group: 'idgham', name: 'Idghām mutajānisayn' },
  b: { group: 'idgham', name: 'Idghām mutaqāribayn' },
  g: { group: 'ghunna', name: 'Ghunna (2 temps)' },
};
export const GROUP_LABEL: Record<RuleGroup, string> = {
  ghunna: 'Ghunna',
  madd: 'Madd (prolongation)',
  qalqala: 'Qalqala',
  ikhfa: 'Ikhfā’',
  idgham: 'Idghām',
  iqlab: 'Iqlāb',
  silent: 'Non prononcé',
};
/** Couleurs (texte) : contraste ≥ 4,5:1 sur les fonds clairs et sombres de l’app (testé). */
export const GROUP_COLOR: Record<RuleGroup, { light: string; dark: string }> = {
  ghunna: { light: '#A84B00', dark: '#FFA463' },
  madd: { light: '#1F4FB8', dark: '#8FB2FF' },
  qalqala: { light: '#B3141C', dark: '#FF8F8F' },
  ikhfa: { light: '#8E1A84', dark: '#F29EE8' },
  idgham: { light: '#11703A', dark: '#7FD69B' },
  iqlab: { light: '#00657F', dark: '#6FD0F0' },
  silent: { light: '#666666', dark: '#A6A6A6' },
};
export const GROUPS = Object.keys(GROUP_LABEL) as RuleGroup[];

// ——— Leçons ———
/** Exemple : mots [de, à] (inclus, index à partir de 0) du verset s:a, lus dans le texte Tanzil. */
export type Example = { s: number; a: number; w: [number, number] };
export type Lesson = { id: string; group: RuleGroup | 'izhar' | 'qamariyya'; title: string; ar: string; text: string; ex: Example };
export const LESSONS: Lesson[] = [
  { id: 'ghunna', group: 'ghunna', title: 'Ghunna', ar: 'الغُنَّة', text: 'Nasalisation d’environ deux temps sur le nūn et le mīm portant une shadda (نّ ، مّ).', ex: { s: 2, a: 6, w: [0, 0] } },
  { id: 'izhar', group: 'izhar', title: 'Iẓhār ḥalqī', ar: 'الإِظْهَار الحَلْقِي', text: 'Nūn sākin ou tanwīn suivi d’une des six lettres de la gorge (ء ه ع ح غ خ) : le nūn se prononce clairement, sans ghunna prolongée.', ex: { s: 1, a: 7, w: [2, 2] } },
  { id: 'idgham-ghunna', group: 'idgham', title: 'Idghām avec ghunna', ar: 'الإِدْغَام بِغُنَّة', text: 'Nūn sākin ou tanwīn en fin de mot, suivi de ي ن م و au début du mot suivant : le nūn s’assimile à la lettre suivante, avec une ghunna de deux temps.', ex: { s: 2, a: 8, w: [2, 3] } },
  { id: 'idgham-bila', group: 'idgham', title: 'Idghām sans ghunna', ar: 'الإِدْغَام بِلَا غُنَّة', text: 'Nūn sākin ou tanwīn suivi de ل ou ر : assimilation complète, sans ghunna.', ex: { s: 2, a: 5, w: [3, 4] } },
  { id: 'iqlab', group: 'iqlab', title: 'Iqlāb', ar: 'الإِقْلَاب', text: 'Nūn sākin ou tanwīn suivi de ب : le nūn se change en mīm caché, avec ghunna ; le petit mīm (ۢ) du mushaf l’indique.', ex: { s: 2, a: 27, w: [4, 5] } },
  { id: 'ikhfa', group: 'ikhfa', title: 'Ikhfā’ ḥaqīqī', ar: 'الإِخْفَاء الحَقِيقِي', text: 'Nūn sākin ou tanwīn suivi d’une des quinze autres lettres (ت ث ج د ذ ز س ش ص ض ط ظ ف ق ك) : le nūn est dit « caché », entre iẓhār et idghām, avec ghunna.', ex: { s: 2, a: 32, w: [9, 9] } },
  { id: 'ikhfa-shafawi', group: 'ikhfa', title: 'Ikhfā’ shafawī', ar: 'الإِخْفَاء الشَّفَوِي', text: 'Mīm sākin suivi de ب : le mīm est caché, avec ghunna.', ex: { s: 105, a: 4, w: [0, 1] } },
  { id: 'idgham-shafawi', group: 'idgham', title: 'Idghām shafawī', ar: 'الإِدْغَام الشَّفَوِي', text: 'Mīm sākin suivi d’un autre mīm : les deux mīm se fondent en un mīm accentué, avec ghunna.', ex: { s: 106, a: 4, w: [1, 2] } },
  { id: 'madd-tabii', group: 'madd', title: 'Madd ṭabī‘ī', ar: 'المَدّ الطَّبِيعِي', text: 'Prolongation naturelle de deux temps : alif après une fatḥa, wāw sākin après une ḍamma, yā’ sākin après une kasra (de même l’alif suscrit).', ex: { s: 1, a: 4, w: [0, 0] } },
  { id: 'madd-muttasil', group: 'madd', title: 'Madd muttaṣil', ar: 'المَدّ المُتَّصِل', text: 'Lettre de madd suivie d’une hamza dans le même mot : prolongation obligatoire de quatre ou cinq temps (Ḥafṣ par la voie de la Shāṭibiyya).', ex: { s: 110, a: 1, w: [1, 1] } },
  { id: 'madd-munfasil', group: 'madd', title: 'Madd munfaṣil', ar: 'المَدّ المُنْفَصِل', text: 'Lettre de madd en fin de mot suivie d’une hamza au début du mot suivant : quatre ou cinq temps par la voie de la Shāṭibiyya.', ex: { s: 108, a: 1, w: [0, 1] } },
  { id: 'madd-lazim', group: 'madd', title: 'Madd lāzim', ar: 'المَدّ اللَّازِم', text: 'Lettre de madd suivie, dans le même mot, d’une lettre à sukūn permanent (souvent une shadda) : six temps.', ex: { s: 1, a: 7, w: [8, 8] } },
  { id: 'qalqala', group: 'qalqala', title: 'Qalqala', ar: 'القَلْقَلَة', text: 'Les cinq lettres ق ط ب ج د (« قطب جد ») portant un sukūn se prononcent avec un léger rebond, plus marqué à l’arrêt.', ex: { s: 112, a: 3, w: [1, 1] } },
  { id: 'shamsiyya', group: 'silent', title: 'Lām shamsiyya', ar: 'اللَّام الشَّمْسِيَّة', text: 'Le lām de l’article suivi d’une lettre « solaire » ne se prononce pas : la lettre suivante porte une shadda.', ex: { s: 91, a: 1, w: [0, 0] } },
  { id: 'qamariyya', group: 'qamariyya', title: 'Lām qamariyya', ar: 'اللَّام القَمَرِيَّة', text: 'Le lām de l’article suivi d’une lettre « lunaire » se prononce, avec un sukūn.', ex: { s: 91, a: 2, w: [0, 0] } },
];

// ——— Annotations colorées ———
export type Seg = { t: string; code?: string };
const TAG = /\[([a-z])(?::\d+)?\[([^\]]*)\]/g;
/** Découpe un verset annoté en segments (texte brut / texte d’une règle). */
export function parseTajweed(src: string): Seg[] {
  const out: Seg[] = [];
  let last = 0;
  for (const m of src.matchAll(TAG)) {
    if (m.index! > last) out.push({ t: src.slice(last, m.index) });
    out.push(CODES[m[1]] ? { t: m[2], code: m[1] } : { t: m[2] });
    last = m.index! + m[0].length;
  }
  if (last < src.length) out.push({ t: src.slice(last) });
  return out.filter((s) => s.t.length > 0);
}
export const plainOf = (segs: Seg[]) => segs.map((s) => s.t).join('');
/** Segments utilisables seulement si le texte annoté redonne EXACTEMENT le texte Tanzil du verset. */
export function aligned(src: string, tanzil: string): Seg[] | null {
  const segs = parseTajweed(src);
  return plainOf(segs) === tanzil ? segs : null;
}
export const groupOf = (s: Seg): RuleGroup | null => (s.code ? CODES[s.code].group : null);

/** Mots (séparés par une espace) avec leurs segments et l’ensemble des familles de règles présentes. */
export type TajWord = { segs: Seg[]; groups: RuleGroup[] };
export function tajWords(segs: Seg[]): TajWord[] {
  const out: TajWord[] = [{ segs: [], groups: [] }];
  for (const s of segs) {
    const parts = s.t.split(' ');
    parts.forEach((p, i) => {
      if (i > 0) out.push({ segs: [], groups: [] });
      if (!p) return;
      const w = out[out.length - 1];
      w.segs.push({ t: p, code: s.code });
      const g = groupOf(s);
      if (g && !w.groups.includes(g)) w.groups.push(g);
    });
  }
  return out.filter((w) => w.segs.length > 0);
}

// ——— Licence ———
export type TajwidSource = { id: string; name: string; licence: string; note: string; url: string };
/** Sources étudiées (31.10.2026). Aucune n’est activée tant que PLACEHOLDERS.TAJWID_DATA_LICENSE n’est pas renseigné. */
export const TAJWID_SOURCES: TajwidSource[] = [
  {
    id: 'alquran-cloud',
    name: 'alquran.cloud — édition « quran-tajweed » (GlobalQuran)',
    licence: 'Conditions du site : reproduction libre à des fins non commerciales ; aucune licence propre aux annotations',
    note: 'Format « [code[lettres] » lu par l’app. Texte non identique à Tanzil sur certains versets (ex. 112:4) : ces versets restent sans couleur.',
    url: 'https://alquran.cloud/terms-and-conditions',
  },
  {
    id: 'cpfair',
    name: 'cpfair/quran-tajweed (index de caractères)',
    licence: 'CC BY 4.0 (annotations) + conditions Tanzil (texte)',
    note: 'Annotations générées automatiquement, projet non maintenu ; liées à une copie 2017 du texte Tanzil Uthmani.',
    url: 'https://github.com/cpfair/quran-tajweed',
  },
  {
    id: 'qul-qpc',
    name: 'QUL (Tarteel) — QPC Hafs Tajweed',
    licence: 'Conditions du Complexe du Roi Fahd (KFGQPC) ; à vérifier ressource par ressource',
    note: 'Écriture et police QPC (différentes du texte Tanzil embarqué).',
    url: 'https://qul.tarteel.ai/resources/quran-script',
  },
];
/** Mushaf coloré disponible ? Uniquement avec une licence confirmée (jamais avec la valeur « YOUR_… »). */
export const tajwidColorsAllowed = (licence: string = PLACEHOLDERS.TAJWID_DATA_LICENSE) => !isPlaceholder(licence);

// ——— Quiz ———
export type Quiz<T> = { prompt: T; answer: string; options: string[] };
/** Quiz des définitions : lire une définition, retrouver la règle. */
export function definitionQuiz(r: () => number, n = 4): Quiz<Lesson> {
  const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)];
  const l = pick(LESSONS);
  const others = LESSONS.filter((x) => x.id !== l.id);
  const opts = [l.id];
  while (opts.length < n && others.length) opts.push(others.splice(Math.floor(r() * others.length), 1)[0].id);
  return { prompt: l, answer: l.id, options: sortRandom(opts, r) };
}
/** Jeu « quelle règle sur ce mot coloré ? » : uniquement des mots portant une seule famille de règles. */
export function colouredWordQuiz(verses: Seg[][], r: () => number, n = 4): Quiz<TajWord> | null {
  const pool = verses.flatMap(tajWords).filter((w) => w.groups.length === 1);
  if (!pool.length) return null;
  const w = pool[Math.floor(r() * pool.length)];
  const g = w.groups[0];
  const others = GROUPS.filter((x) => x !== g);
  const opts: string[] = [g];
  while (opts.length < n && others.length) opts.push(others.splice(Math.floor(r() * others.length), 1)[0]);
  return { prompt: w, answer: g, options: sortRandom(opts, r) };
}
function sortRandom<T>(xs: T[], r: () => number): T[] {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
