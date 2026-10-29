/**
 * Lecture du Coran via l'API publique gratuite api.alquran.cloud (texte arabe vocalisé « simple-enhanced », lisible avec toutes les polices + traduction).
 * Chaque sourate téléchargée est mise en cache sur l'appareil → relecture hors-ligne.
 */
import { loadJSON, saveCacheJSON } from './storage';

export type Ayah = { n: number; ar: string; tr: string };
export type SurahText = { n: number; edition: string; ayahs: Ayah[] };

export function translationFor(lang: string): { id: string; label: string } {
  if (lang === 'fr' || lang === 'ff' || lang === 'wo') return { id: 'fr.hamidullah', label: 'Muhammad Hamidullah (FR)' };
  if (lang === 'de' || lang === 'de-CH') return { id: 'de.bubenheim', label: 'Bubenheim & Elyas (DE)' };
  // Arabe : pas de « traduction » ; tafsir abrégé al-Muyassar (Complexe du roi Fahd), source arabe classique contemporaine.
  if (lang === 'ar') return { id: 'ar.muyassar', label: 'التفسير الميسر (مجمع الملك فهد)' };
  // Anglais : Pickthall (1930), domaine public. Saheeh International est sous copyright (Dar Abul-Qasim) : non utilisée.
  return { id: 'en.pickthall', label: 'M. Pickthall (EN, public domain)' };
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
