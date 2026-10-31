/**
 * Données personnelles du Coran, toutes locales (aucun serveur) : réglages de lecture, marque-pages, notes,
 * surlignages, dernière lecture, khatma, jours de lecture et cartes de mémorisation.
 */
import { dayKey } from './dates';
import { markPage, type Khatma } from './khatma';
import { fromIndex, gIndex, pageOf } from './quran-nav';
import type { Gap } from './recitation';
import { shared } from './shared-state';
import { newCard, review, type Card, type Grade } from './srs';

export type ReaderTheme = 'auto' | 'light' | 'sepia' | 'night';
export type ReaderPrefs = {
  arSize: number;
  trSize: number;
  lineH: number;
  theme: ReaderTheme;
  showTr: boolean;
  showTl: boolean;
  keepAwake: boolean;
  reciter: string;
  rate: number;
  follow: boolean;
  /** Lettres lumineuses (14 lettres des ouvertures) en doré — désactivé par défaut. */
  nurani: boolean;
  /** Souligner les lettres isolées ouvrant 29 sourates — désactivé par défaut. */
  muqattaat: boolean;
};
export const DEFAULT_READER: ReaderPrefs = { arSize: 28, trSize: 15, lineH: 2.1, theme: 'auto', showTr: true, showTl: false, keepAwake: true, reciter: 'alafasy', rate: 1, follow: true, nurani: false, muqattaat: false };
export const readerPrefs = shared<ReaderPrefs>('qr-prefs', DEFAULT_READER, (v) => ({ ...DEFAULT_READER, ...v }));

export type Bookmark = { id: string; s: number; a: number; name: string; color: string; at: number };
export type Note = { text: string; at: number };
export type Marks = { bookmarks: Bookmark[]; notes: Record<string, Note>; hl: Record<string, string> };
export const marks = shared<Marks>('qr-marks', { bookmarks: [], notes: {}, hl: {} }, (v) => ({ bookmarks: v.bookmarks ?? [], notes: v.notes ?? {}, hl: v.hl ?? {} }));

export const BOOKMARK_COLORS = [
  { id: 'gold', label: 'Or', hex: '#C9A341' },
  { id: 'green', label: 'Émeraude', hex: '#23946B' },
  { id: 'blue', label: 'Bleu', hex: '#3E7CC8' },
  { id: 'red', label: 'Rubis', hex: '#C24D5C' },
  { id: 'slate', label: 'Ardoise', hex: '#6B7A86' },
];
export const HIGHLIGHTS = [
  { id: 'yellow', label: 'Jaune', hex: '#F2C94C' },
  { id: 'green', label: 'Vert', hex: '#6FCF97' },
  { id: 'blue', label: 'Bleu', hex: '#56CCF2' },
  { id: 'orange', label: 'Orange', hex: '#F2994A' },
];

/** Dernière lecture (clé historique « quran-last », lue aussi par l’accueil). */
export type LastRead = { n: number; ayah: number; page?: number; at?: number; mode?: 'verse' | 'page' };
export const lastRead = shared<LastRead | null>('quran-last', null);
export const khatma = shared<Khatma | null>('qr-khatma', null);
/** Jours où l’utilisateur a lu (AAAA-MM-JJ), pour la série. */
export const readDays = shared<string[]>('qr-days', []);
/** Pages terminées par jour (objectif « pages de Coran ») ; 120 jours gardés, local uniquement. */
export const pagesDay = shared<Record<string, number[]>>('qr-pages-day', {});

export type HifzPrefs = { each: number; times: number; gap: Gap; hide: HideMode; rate: number; reciter: string | null };
export type HideMode = 'none' | 'first' | 'alt' | 'all' | 'blur';
export const DEFAULT_HIFZ: HifzPrefs = { each: 3, times: 1, gap: 2, hide: 'none', rate: 1, reciter: null };
export const hifzPrefs = shared<HifzPrefs>('hifz-prefs', DEFAULT_HIFZ, (v) => ({ ...DEFAULT_HIFZ, ...v }));
/** Cartes SM-2 par index global de verset (0..6235). */
export const hifzCards = shared<Record<string, Card>>('hifz-cards', {});

const ref = (s: number, a: number) => `${s}:${a}`;
export const keyOf = ref;

/** Note la lecture d’un verset : dernière lecture, jour de lecture et, si une khatma est en cours, la page. */
/** Note une page terminée aujourd’hui (objectif du jour, local uniquement). */
export function logPageRead(page: number, today = dayKey()) {
  if (!(page >= 1 && page <= 604)) return;
  const pd = pagesDay.get();
  const cur = pd[today] ?? [];
  if (cur.includes(page)) return;
  const next = { ...pd, [today]: [...cur, page] };
  pagesDay.set(Object.fromEntries(Object.entries(next).sort(([a], [b]) => (a < b ? 1 : -1)).slice(0, 120)));
}

export function recordRead(s: number, a: number, mode: 'verse' | 'page', opts: { page?: number; pageDone?: number } = {}) {
  const today = dayKey();
  lastRead.set({ n: s, ayah: a, page: opts.page ?? pageOf(s, a), at: Date.now(), mode });
  const days = readDays.get();
  if (days[days.length - 1] !== today) readDays.set([...days.filter((d) => d !== today), today].slice(-400));
  if (opts.pageDone) logPageRead(opts.pageDone, today);
  const k = khatma.get();
  if (k && !k.finished && opts.pageDone) {
    const rel = opts.pageDone - k.from + 1;
    // progression séquentielle seulement : sauter à la page 500 ne « lit » pas 499 pages
    if (rel > k.done && rel <= k.done + 3) khatma.set(markPage(k, opts.pageDone, today));
  }
}

export function toggleBookmark(s: number, a: number, name?: string, color = BOOKMARK_COLORS[0].hex) {
  marks.set((m) => {
    const has = m.bookmarks.find((x) => x.s === s && x.a === a);
    if (has) return { ...m, bookmarks: m.bookmarks.filter((x) => x !== has) };
    return { ...m, bookmarks: [{ id: `${Date.now()}`, s, a, name: name ?? '', color, at: Date.now() }, ...m.bookmarks] };
  });
}
export function saveBookmark(s: number, a: number, name: string, color: string) {
  marks.set((m) => {
    const rest = m.bookmarks.filter((x) => !(x.s === s && x.a === a));
    return { ...m, bookmarks: [{ id: `${Date.now()}`, s, a, name, color, at: Date.now() }, ...rest] };
  });
}
export const removeBookmark = (id: string) => marks.set((m) => ({ ...m, bookmarks: m.bookmarks.filter((x) => x.id !== id) }));
export function setNote(s: number, a: number, text: string) {
  marks.set((m) => {
    const notes = { ...m.notes };
    if (text.trim()) notes[ref(s, a)] = { text: text.trim(), at: Date.now() };
    else delete notes[ref(s, a)];
    return { ...m, notes };
  });
}
export function setHighlight(s: number, a: number, color: string | null) {
  marks.set((m) => {
    const hl = { ...m.hl };
    if (color) hl[ref(s, a)] = color;
    else delete hl[ref(s, a)];
    return { ...m, hl };
  });
}

/** Ajoute des versets à la mémorisation (leçon du jour) sans écraser ceux déjà suivis. */
export function startHifz(from: number, to: number) {
  const today = dayKey();
  hifzCards.set((c) => {
    const n = { ...c };
    for (let i = from; i < to; i++) if (!n[i]) n[i] = newCard(today);
    return n;
  });
}
export function gradeVerses(idx: number[], g: Grade) {
  const today = dayKey();
  hifzCards.set((c) => {
    const n = { ...c };
    for (const i of idx) n[i] = review(n[i], g, today);
    return n;
  });
}
export function forgetHifz(from: number, to: number) {
  hifzCards.set((c) => {
    const n = { ...c };
    for (let i = from; i < to; i++) delete n[i];
    return n;
  });
}
export const verseRef = (i: number) => {
  const [s, a] = fromIndex(i);
  return ref(s, a);
};
export { gIndex };
