/**
 * Lecture du Coran : arabe Tanzil / alquran.cloud, sens Hamidullah, Pickthall, Muyassar,
 * ou une édition QuranEnc citée (téléchargée à la demande, non réécrite).
 * Chaque sourate téléchargée est mise en cache sur l'appareil → relecture hors-ligne.
 */
import { editionFor, isQuranEncId, quranEncKeyOf, type QuranEdition } from './quran-licenses';
import { fetchQuranEncSurah } from './quran-enc';
import { loadJSON, saveCacheJSON } from './storage';

export type Ayah = { n: number; ar: string; tr: string };
export type SurahText = { n: number; edition: string; ayahs: Ayah[] };

/** Sens affiché pour une langue d’interface. `wo` reste Hamidullah (pas d’édition wolof). */
export function translationFor(lang: string): QuranEdition {
  return editionFor(lang);
}

const BASMALA = 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ';

const bare = (s: string) => s.replace(/[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, '').replace(/[\u0671\u0622\u0623\u0625]/g, '\u0627');
/** Retire la basmala (4 mots) placée en tête du verset 1 par l'édition uthmani. */
export function stripBasmala(t: string): string {
  const w = t.split(/\s+/);
  if (w.length > 4 && bare(w[0]) === 'بسم' && bare(w[3]).endsWith('رحيم')) return w.slice(4).join(' ');
  return t;
}

export async function getSurah(n: number, edition: string): Promise<SurahText> {
  const key = `quran3-${n}-${edition}`;
  const cached = await loadJSON<SurahText | null>(key, null);
  if (cached?.ayahs?.length) return cached;
  if (isQuranEncId(edition)) {
    try {
      const { offlineSurah } = await import('./quran-offline');
      const base = await offlineSurah(n);
      const tr = await fetchQuranEncSurah(quranEncKeyOf(edition), n);
      const ayahs = base.map((a, i) => ({ n: a.n, ar: a.ar, tr: tr[i] ?? '' }));
      const out = { n, edition, ayahs };
      await saveCacheJSON(key, out);
      return out;
    } catch (e) {
      const { offlineSurah } = await import('./quran-offline');
      const ayahs = await offlineSurah(n, edition).catch(() => null);
      if (ayahs?.length) return { n, edition, ayahs };
      throw e;
    }
  }
  let j: { data: { ayahs: { numberInSurah: number; text: string }[] }[] };
  try {
    const r = await fetch(`https://api.alquran.cloud/v1/surah/${n}/editions/quran-simple-enhanced,${edition}`);
    if (!r.ok) throw new Error(`alquran.cloud ${r.status}`);
    j = await r.json();
  } catch (e) {
    // Hors connexion : texte arabe embarqué (Tanzil) + traduction si elle a été téléchargée.
    const { offlineSurah } = await import('./quran-offline');
    const ayahs = await offlineSurah(n, edition).catch(() => null);
    if (ayahs?.length) return { n, edition, ayahs };
    throw e;
  }
  const [ar, tr] = j.data;
  const ayahs = ar.ayahs.map((a, i) => {
    let t = a.text.replace(/^\ufeff/, '');
    // L'édition uthmani préfixe la basmala au verset 1 (sauf al-Fatiha) : on l'affiche à part.
    if (n !== 1 && i === 0) t = stripBasmala(t);
    return { n: a.numberInSurah, ar: t, tr: tr.ayahs[i]?.text ?? '' };
  });
  const out = { n, edition, ayahs };
  await saveCacheJSON(key, out);
  return out;
}
export { BASMALA };
