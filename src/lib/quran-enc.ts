/**
 * Adaptateur QuranEnc (sens seulement). L’arabe du lecteur reste Tanzil.
 * Le texte renvoyé par l’API n’est pas reformulé. Les notes (`footnotes`) sont conservées
 * après le sens, séparées par U+2028, pour tenir dans le cache « une ligne par verset ».
 */
import { SURAHS } from './surahs';

const API = 'https://quranenc.com/api/v1';
/** Séparateur sens / notes. N’appartient pas au texte publié. */
export const AYAH_NOTE = '\u2028\u2028';

type Row = { aya: string; translation: string; footnotes?: string | null };

const keepBreaks = (s: string) => s.replace(/\r\n/g, '\n').replace(/\n/g, '\u2028');

/** Assemble le sens tel que publié et, s’il y en a, les notes. Ne réécrit pas les mots. */
export function packAyah(translation: string, footnotes?: string | null): string {
  const text = keepBreaks(translation ?? '');
  if (footnotes == null || footnotes === '') return text;
  return text + AYAH_NOTE + keepBreaks(footnotes);
}

export function splitAyah(stored: string): { text: string; notes?: string } {
  const i = stored.indexOf(AYAH_NOTE);
  const restore = (s: string) => s.replace(/\u2028/g, '\n');
  if (i < 0) return { text: restore(stored) };
  const notes = restore(stored.slice(i + AYAH_NOTE.length));
  return { text: restore(stored.slice(0, i)), notes: notes || undefined };
}

export async function fetchQuranEncSurah(key: string, sura: number): Promise<string[]> {
  const r = await fetch(`${API}/translation/sura/${key}/${sura}`);
  if (!r.ok) throw new Error(`quranenc ${key} ${sura} ${r.status}`);
  const j = (await r.json()) as { result?: Row[] };
  const rows = j.result ?? [];
  const expect = SURAHS[sura - 1]?.[4];
  if (!expect || rows.length !== expect) throw new Error(`quranenc ${key} ${sura} : ${rows.length} versets, attendu ${expect}`);
  const ordered = [...rows].sort((a, b) => Number(a.aya) - Number(b.aya));
  return ordered.map((row) => packAyah(row.translation ?? '', row.footnotes));
}

/** Les 6236 versets, dans l’ordre du muṣḥaf. Rien n’est inventé si un compte ne correspond pas. */
export async function fetchQuranEncQuran(key: string): Promise<string[]> {
  const out: string[] = [];
  for (let s = 1; s <= 114; s++) {
    const lines = await fetchQuranEncSurah(key, s);
    out.push(...lines);
  }
  if (out.length !== 6236) throw new Error(`quranenc ${key} : ${out.length} versets`);
  return out;
}
