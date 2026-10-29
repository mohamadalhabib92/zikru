/**
 * Texte du lecteur : arabe uthmani Tanzil embarqué (hors-ligne), traduction et translittération (alquran.cloud,
 * mises en cache sur l’appareil), tafsir à la demande (alquran.cloud / api.quran.com).
 */
import { stripBasmala } from './quran';
import { cachedTranslation } from './quran-offline';
import { OFFSETS, TOTAL_AYAHS } from './quran-nav';
import { loadJSON, saveCacheJSON } from './storage';
import { SURAHS } from './surahs';

let uthP: Promise<string[]> | null = null;
/** Les 6236 versets en écriture uthmani (index global), basmala d’ouverture retirée (affichée à part). */
export function loadUthmani(): Promise<string[]> {
  if (!uthP)
    uthP = import('./quran-uthmani').then(({ QURAN_UTHMANI }) => {
      const out: string[] = new Array(TOTAL_AYAHS);
      for (const line of QURAN_UTHMANI.split('\n')) {
        if (!line || line[0] === '#') continue;
        const i = line.indexOf('|'), j = line.indexOf('|', i + 1);
        const s = +line.slice(0, i), a = +line.slice(i + 1, j);
        const t = line.slice(j + 1);
        out[OFFSETS[s - 1] + a - 1] = s !== 1 && a === 1 ? stripBasmala(t) : t;
      }
      return out;
    });
  return uthP;
}
/** Basmala en écriture uthmani (verset 1:1 du texte Tanzil). */
export const BASMALA_UTHMANI = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ';

const mem = new Map<string, Promise<string[] | null>>();
/** Traduction (ou translittération « en.transliteration ») d’une sourate, depuis le cache puis le réseau. */
export function surahEdition(n: number, ed: string): Promise<string[] | null> {
  const k = `${n}-${ed}`;
  if (!mem.has(k)) {
    const p = (async () => {
      const full = await cachedTranslation(ed).catch(() => null);
      if (full?.length) return full.slice(OFFSETS[n - 1], OFFSETS[n - 1] + SURAHS[n - 1][4]);
      const own = await loadJSON<string[] | null>(`qtr-${n}-${ed}`, null);
      if (own?.length) return own;
      const old = await loadJSON<{ ayahs?: { tr: string }[] } | null>(`quran3-${n}-${ed}`, null);
      if (old?.ayahs?.length) return old.ayahs.map((a) => a.tr);
      try {
        const r = await fetch(`https://api.alquran.cloud/v1/surah/${n}/${ed}`);
        if (!r.ok) return null;
        const j = (await r.json()) as { data: { ayahs: { text: string }[] } };
        const out = j.data.ayahs.map((a) => a.text);
        await saveCacheJSON(`qtr-${n}-${ed}`, out);
        return out;
      } catch {
        return null;
      }
    })();
    p.then((v) => v || mem.delete(k));
    mem.set(k, p);
  }
  return mem.get(k)!;
}

export type Tafsir = { id: string; name: string; lang: 'ar' | 'en' | 'fr'; src: string };
export const TAFSIRS: Tafsir[] = [
  { id: 'muyassar', name: 'At-Tafsir al-Muyassar', lang: 'ar', src: 'alquran.cloud (ar.muyassar)' },
  { id: 'jalalayn', name: 'Tafsir al-Jalalayn', lang: 'ar', src: 'alquran.cloud (ar.jalalayn)' },
  { id: 'saadi', name: 'Tafsir as-Sa‘di', lang: 'ar', src: 'api.quran.com (tafsir 91)' },
  { id: 'ibnkathir', name: 'Ibn Kathir (abrégé, anglais)', lang: 'en', src: 'api.quran.com (tafsir 169)' },
];
const QCOM: Record<string, number> = { saadi: 91, ibnkathir: 169 };
const CLOUD: Record<string, string> = { muyassar: 'ar.muyassar', jalalayn: 'ar.jalalayn' };

const decode = (s: string) =>
  s
    .replace(/<\/(p|h\d|div|li)>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&rsquo;/g, '’')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

/** Tafsir d’un verset (mis en cache après la première lecture). */
export async function getTafsir(id: string, s: number, a: number): Promise<string> {
  const key = `tafsir-${id}-${s}-${a}`;
  const c = await loadJSON<string | null>(key, null);
  if (c) return c;
  let text = '';
  if (CLOUD[id]) {
    const r = await fetch(`https://api.alquran.cloud/v1/ayah/${s}:${a}/${CLOUD[id]}`);
    if (!r.ok) throw new Error(String(r.status));
    text = ((await r.json()) as { data: { text: string } }).data.text;
  } else if (QCOM[id]) {
    const r = await fetch(`https://api.quran.com/api/v4/tafsirs/${QCOM[id]}/by_ayah/${s}:${a}`);
    if (!r.ok) throw new Error(String(r.status));
    text = decode(((await r.json()) as { tafsir: { text: string } }).tafsir.text);
  }
  if (!text) throw new Error('vide');
  await saveCacheJSON(key, text);
  return text;
}
