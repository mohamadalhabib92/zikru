/**
 * Coran hors-ligne : texte arabe Tanzil « Simple » embarqué (chargé à la demande, ~1,3 Mo) + traduction
 * téléchargée une fois depuis api.alquran.cloud puis gardée sur l’appareil. Index insensible aux diacritiques.
 */
import { SURAHS } from './surahs';
import { stripBasmala } from './quran';
import { readText, writeText } from './text-cache';
import { hasArabic, normAr } from './ar-norm';
import { tlKey, tlMatch } from './translit-norm';

export { hasArabic, normAr };

export type Verse = { s: number; a: number; ar: string };
export type VerseHit = Verse & { tr?: string; /** trouvé par la translittération (aide phonétique) */ tl?: string };

/** Édition de translittération latine (api.alquran.cloud) utilisée pour la recherche phonétique. */
export const TRANSLIT_EDITION = 'en.transliteration';

/** Latin : minuscules, sans accents ni ponctuation. */
export function normLat(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’'‘ʿʾ`]/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Index global (rang 0..6235) → [sourate, verset]. */
const OFFSETS: number[] = (() => {
  const o: number[] = [];
  let acc = 0;
  for (const m of SURAHS) {
    o.push(acc);
    acc += m[4];
  }
  return o;
})();
export const verseIndex = (s: number, a: number) => OFFSETS[s - 1] + a - 1;

let arP: Promise<{ verses: Verse[]; keys: string[] }> | null = null;
export function loadArabic() {
  if (!arP)
    arP = import('./quran-text').then(({ QURAN_TEXT }) => {
      const verses: Verse[] = [];
      for (const line of QURAN_TEXT.split('\n')) {
        if (!line || line[0] === '#') continue;
        const i = line.indexOf('|'), j = line.indexOf('|', i + 1);
        const sn = +line.slice(0, i), an = +line.slice(i + 1, j), t = line.slice(j + 1);
        // Basmala en tête du verset 1 (sauf al-Fātiḥa) : retirée à l’affichage, comme dans le lecteur.
        verses.push({ s: sn, a: an, ar: sn !== 1 && an === 1 ? stripBasmala(t) : t });
      }
      return { verses, keys: verses.map((v) => normAr(v.ar)) };
    });
  return arP;
}

const trMem: Record<string, Promise<string[] | null> | undefined> = {};
const trKey = (ed: string) => `quran-tr-${ed}`;

/** Traduction en cache local (null si jamais téléchargée). */
export function cachedTranslation(edition: string): Promise<string[] | null> {
  if (!trMem[edition])
    trMem[edition] = readText(trKey(edition)).then((t) => {
      const lines = t ? t.split('\n') : null;
      if (!lines || lines.length < 6236) {
        trMem[edition] = undefined;
        return null;
      }
      return lines;
    });
  return trMem[edition]!;
}

/** Télécharge la traduction complète (une requête), la compacte (1 ligne / verset) et la garde. */
export async function downloadTranslation(edition: string): Promise<string[]> {
  const have = await cachedTranslation(edition);
  if (have) return have;
  const r = await fetch(`https://api.alquran.cloud/v1/quran/${edition}`);
  if (!r.ok) throw new Error(`alquran.cloud ${r.status}`);
  const j = (await r.json()) as { data: { surahs: { ayahs: { text: string }[] }[] } };
  const lines = j.data.surahs.flatMap((s) => s.ayahs.map((a) => a.text.replace(/\s*\n\s*/g, ' ')));
  if (lines.length !== 6236) throw new Error('traduction incomplète');
  await writeText(trKey(edition), lines.join('\n'));
  trMem[edition] = Promise.resolve(lines);
  return lines;
}

let latIdx: { ed: string; keys: string[] } | null = null;

/**
 * Recherche hors-ligne. Arabe → texte arabe ; latin → traduction (si en cache) ; « 2:255 » ou « 2 255 » → référence.
 * Tous les mots doivent apparaître (ordre libre) ; tri : expression exacte d’abord, puis ordre du Mushaf.
 */
export async function searchVerses(q: string, edition: string, limit = 40): Promise<{ hits: VerseHit[]; total: number; translated: boolean; phonetic?: boolean }> {
  const { verses, keys } = await loadArabic();
  const tr = await cachedTranslation(edition);
  const tl = await cachedTranslation(TRANSLIT_EDITION);
  const raw = q.trim();
  const ref = raw.match(/^(\d{1,3})\s*[:.\s]\s*(\d{1,3})(?:\s*-\s*(\d{1,3}))?$/);
  if (ref) {
    const s = +ref[1], a = +ref[2], z = Math.min(+(ref[3] ?? ref[2]), a + 19);
    const meta = SURAHS[s - 1];
    if (!meta) return { hits: [], total: 0, translated: !!tr };
    const out: VerseHit[] = [];
    for (let k = a; k <= Math.min(z, meta[4]); k++) {
      const i = verseIndex(s, k);
      out.push({ ...verses[i], tr: tr?.[i] });
    }
    return { hits: out, total: out.length, translated: !!tr };
  }
  const arabic = hasArabic(raw);
  const nq = arabic ? normAr(raw) : normLat(raw);
  if (nq.length < 2) return { hits: [], total: 0, translated: !!tr };
  let hay: string[] = [];
  if (arabic) hay = keys;
  else {
    if (!tr && !tl) return { hits: [], total: 0, translated: false, phonetic: false };
    if (tr && latIdx?.ed !== edition) latIdx = { ed: edition, keys: tr.map(normLat) };
    if (tr && latIdx) hay = latIdx.keys;
  }
  const words = nq.split(' ');
  const exact: number[] = [], loose: number[] = [];
  for (let i = 0; i < hay.length; i++) {
    const h = arabic ? hay[i] : ` ${hay[i]} `;
    if (h.includes(arabic ? nq : ` ${nq}`)) exact.push(i);
    else if (words.length > 1 && words.every((w) => h.includes(arabic ? w : ` ${w}`))) loose.push(i);
  }
  // Latin : aussi la translittération (si téléchargée) — « bismillah », « ayat al kursi » n’est pas dans la traduction.
  const tlExact: number[] = [], tlLoose: number[] = [];
  if (!arabic && tl) {
    if (!tlIdx) tlIdx = tl.map(tlKey);
    const seen = new Set([...exact, ...loose]);
    for (let i = 0; i < tlIdx.length; i++) {
      if (seen.has(i)) continue;
      const m = tlMatch(tlIdx[i], raw);
      if (m === 2) tlExact.push(i);
      else if (m === 1) tlLoose.push(i);
    }
  }
  const tlSet = new Set([...tlExact, ...tlLoose]);
  const all = [...exact, ...tlExact, ...loose, ...tlLoose];
  return {
    hits: all.slice(0, limit).map((i) => ({ ...verses[i], tr: tr?.[i], tl: tlSet.has(i) ? tl?.[i] : undefined })),
    total: all.length,
    translated: !!tr,
    phonetic: !!tl,
  };
}
let tlIdx: string[] | null = null;

/** Versets d’une sourate depuis le texte embarqué (lecture sans connexion). */
export async function offlineSurah(s: number, edition?: string): Promise<{ n: number; ar: string; tr: string }[]> {
  const { verses } = await loadArabic();
  const tr = edition ? await cachedTranslation(edition) : null;
  const meta = SURAHS[s - 1];
  const start = verseIndex(s, 1);
  return verses.slice(start, start + meta[4]).map((v, k) => ({ n: v.a, ar: v.ar, tr: tr?.[start + k] ?? '' }));
}
