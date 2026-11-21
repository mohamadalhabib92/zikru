import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Même requête que `getSurah` dans src/lib/quran.ts :
 * arabe `quran-simple-enhanced` (Tanzil via alquran.cloud) + une édition déjà citée.
 * Le texte n’est pas réécrit, sauf le retrait de la basmala en tête du verset 1
 * (sauf al-Fātiḥa), comme sur l’iPhone.
 */
export type Ayah = { n: number; ar: string; tr: string };

const bare = (s: string) => s.replace(/[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, '').replace(/[\u0671\u0622\u0623\u0625]/g, '\u0627');

export function stripBasmala(t: string): string {
  const w = t.split(/\s+/);
  if (w.length > 4 && bare(w[0]) === 'بسم' && bare(w[3]).endsWith('رحيم')) return w.slice(4).join(' ');
  return t;
}

export function surahUrl(n: number, edition: string): string {
  return `https://api.alquran.cloud/v1/surah/${n}/editions/quran-simple-enhanced,${edition}`;
}

type Payload = { data: { ayahs: { numberInSurah: number; text: string }[] }[] };

export async function readSurah(n: number, edition: string): Promise<Ayah[]> {
  const key = `zikru-tv-quran-${n}-${edition}`;
  const cached = await AsyncStorage.getItem(key);
  if (cached) {
    const parsed = JSON.parse(cached) as Ayah[];
    if (Array.isArray(parsed) && parsed.length) return parsed;
  }
  const r = await fetch(surahUrl(n, edition));
  if (!r.ok) throw new Error(`alquran.cloud ${r.status}`);
  const j = (await r.json()) as Payload;
  const [ar, tr] = j.data;
  const ayahs = ar.ayahs.map((a, i) => {
    let t = a.text.replace(/^\ufeff/, '');
    if (n !== 1 && i === 0) t = stripBasmala(t);
    return { n: a.numberInSurah, ar: t, tr: tr.ayahs[i]?.text ?? '' };
  });
  await AsyncStorage.setItem(key, JSON.stringify(ayahs));
  return ayahs;
}
