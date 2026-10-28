/**
 * Navigation dans le Mushaf (module pur, testé par scripts/test-pages.mjs) : index global des versets,
 * pagination de Médine (604 pages), juz’, hizb / rub‘, sajdas, et analyse des références tapées (« 2:255 », « p 50 », « juz 3 »…).
 * Métadonnées : Tanzil Quran Metadata (CC BY 3.0), voir quran-meta.ts.
 */
import { JUZ_STARTS, MANZIL_STARTS, PAGE_STARTS, RUB_STARTS, SAJDAS } from './quran-meta';
import { SURAHS } from './surahs';

export const TOTAL_AYAHS = 6236;
export const TOTAL_PAGES = 604;

export const OFFSETS: number[] = (() => {
  const o: number[] = [];
  let acc = 0;
  for (const m of SURAHS) {
    o.push(acc);
    acc += m[4];
  }
  return o;
})();

/** (sourate, verset) → index global 0..6235. */
export const gIndex = (s: number, a: number) => OFFSETS[s - 1] + a - 1;
/** Index global → [sourate, verset]. */
export function fromIndex(i: number): [number, number] {
  const k = upper(OFFSETS, i);
  return [k + 1, i - OFFSETS[k] + 1];
}
/** Dernier rang k tel que arr[k] <= x (arr trié). */
function upper(arr: number[], x: number) {
  let lo = 0, hi = arr.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (arr[mid] <= x) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}
const rangeOf = (arr: number[], k: number): [number, number] => [arr[k - 1], k < arr.length ? arr[k] : TOTAL_AYAHS];

/** Page (1..604) d’un verset. */
export const pageOfIndex = (i: number) => upper(PAGE_STARTS, i) + 1;
export const pageOf = (s: number, a: number) => pageOfIndex(gIndex(s, a));
/** Versets d’une page : [début, fin exclue[. */
export const pageRange = (p: number) => rangeOf(PAGE_STARTS, Math.min(TOTAL_PAGES, Math.max(1, p)));
export const juzOfIndex = (i: number) => upper(JUZ_STARTS, i) + 1;
export const juzRange = (j: number) => rangeOf(JUZ_STARTS, Math.min(30, Math.max(1, j)));
/** Quart de hizb (rub‘) 1..240 ; hizb 1..60. */
export const rubOfIndex = (i: number) => upper(RUB_STARTS, i) + 1;
export const hizbOfIndex = (i: number) => Math.ceil(rubOfIndex(i) / 4);
export function hizbRange(h: number): [number, number] {
  const k = Math.min(60, Math.max(1, h));
  return [RUB_STARTS[(k - 1) * 4], k < 60 ? RUB_STARTS[k * 4] : TOTAL_AYAHS];
}
export const manzilOfIndex = (i: number) => upper(MANZIL_STARTS, i) + 1;
/** Page de début d’un juz’ / hizb / sourate. */
export const juzPage = (j: number) => pageOfIndex(juzRange(j)[0]);
export const hizbPage = (h: number) => pageOfIndex(hizbRange(h)[0]);
export const surahPage = (s: number) => pageOfIndex(OFFSETS[s - 1]);

const RUB_SET = new Map(RUB_STARTS.map((x, k) => [x, k + 1]));
const SAJDA_MAP = new Map(SAJDAS.map(([x, o]) => [x, o]));
/** Si le verset ouvre un quart de hizb : son numéro de rub‘ (1..240), sinon 0. */
export const rubStartAt = (i: number) => RUB_SET.get(i) ?? 0;
/** Sajda : -1 aucune, 0 recommandée, 1 obligatoire (selon Tanzil). */
export const sajdaAt = (i: number) => SAJDA_MAP.get(i) ?? -1;
/** Libellé d’un début de rub‘ : « Hizb 5 », « ¼ Hizb 5 », « ½ … », « ¾ … ». */
export function rubLabel(r: number) {
  const h = Math.ceil(r / 4), q = (r - 1) % 4;
  return `${['', '¼ ', '½ ', '¾ '][q]}Hizb ${h}`;
}

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
/** Chiffres arabo-indiens (١٢٣). */
export const arNum = (n: number) => String(n).replace(/\d/g, (d) => AR_DIGITS[+d]);

export type Ref =
  | { kind: 'ayah'; s: number; a: number }
  | { kind: 'surah'; s: number }
  | { kind: 'page'; p: number }
  | { kind: 'juz'; j: number }
  | { kind: 'hizb'; h: number };

/** Référence tapée → destination (null si ce n’est pas une référence). */
export function parseRef(q: string): Ref | null {
  const t = q.trim().toLowerCase().replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d)));
  let m = t.match(/^(\d{1,3})\s*[:.\s,]\s*(\d{1,3})$/);
  if (m) {
    const s = +m[1], a = +m[2];
    if (s >= 1 && s <= 114 && a >= 1 && a <= SURAHS[s - 1][4]) return { kind: 'ayah', s, a };
    return null;
  }
  m = t.match(/^(?:p|pg|page|ص|صفحة)\.?\s*(\d{1,3})$/);
  if (m) return +m[1] >= 1 && +m[1] <= TOTAL_PAGES ? { kind: 'page', p: +m[1] } : null;
  m = t.match(/^(?:j|juz|juz'|juz’|jouz|جزء|الجزء)\.?\s*(\d{1,2})$/);
  if (m) return +m[1] >= 1 && +m[1] <= 30 ? { kind: 'juz', j: +m[1] } : null;
  m = t.match(/^(?:h|hizb|حزب|الحزب)\.?\s*(\d{1,2})$/);
  if (m) return +m[1] >= 1 && +m[1] <= 60 ? { kind: 'hizb', h: +m[1] } : null;
  m = t.match(/^(\d{1,3})$/);
  if (m) return +m[1] >= 1 && +m[1] <= 114 ? { kind: 'surah', s: +m[1] } : null;
  return null;
}
