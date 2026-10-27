import { loadJSON, saveJSON } from './storage';

/** Récitation de Mishary Rashid Alafasy — diffusée en streaming depuis des serveurs publics, jamais incluse dans l'app. */
export const KAHF_AUDIO = ['https://server8.mp3quran.net/afs/018.mp3', 'https://cdn.islamic.network/quran/audio-surah/128/ar.alafasy/18.mp3'];
export const KAHF_TEXT_URL = 'https://api.alquran.cloud/v1/surah/18/editions/quran-uthmani,fr.hamidullah,en.sahih';

export type Ayah = { n: number; ar: string; fr: string; en: string };
const KEY = 'kahf-text-v1';

/** Texte récupéré à l'exécution depuis api.alquran.cloud puis mis en cache sur l'appareil. */
export async function getKahfText(force = false): Promise<{ ayahs: Ayah[]; cached: boolean }> {
  const cached = await loadJSON<Ayah[] | null>(KEY, null);
  if (cached?.length && !force) return { ayahs: cached, cached: true };
  try {
    const r = await fetch(KAHF_TEXT_URL);
    if (!r.ok) throw new Error(String(r.status));
    const j = (await r.json()) as { data: { ayahs: { numberInSurah: number; text: string }[] }[] };
    const [ar, fr, en] = j.data;
    const ayahs = ar.ayahs.map((a, i) => ({ n: a.numberInSurah, ar: a.text, fr: fr?.ayahs[i]?.text ?? '', en: en?.ayahs[i]?.text ?? '' }));
    if (ayahs.length) await saveJSON(KEY, ayahs);
    return { ayahs, cached: false };
  } catch (e) {
    if (cached?.length) return { ayahs: cached, cached: true };
    throw e;
  }
}

/** Vendredi « islamique » : du coucher du soleil le jeudi au coucher du soleil le vendredi (approx. 18 h si inconnu). */
export function isKahfTime(now: Date, maghrib?: Date) {
  const d = now.getDay();
  const cut = maghrib ? maghrib.getHours() * 60 + maghrib.getMinutes() : 18 * 60;
  const m = now.getHours() * 60 + now.getMinutes();
  return (d === 4 && m >= cut) || (d === 5 && m < cut);
}

/** Identifiant de la semaine (vendredi concerné) pour mémoriser « lu cette semaine ». */
export function fridayKey(now: Date) {
  const d = new Date(now);
  const diff = (5 - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + (diff === 6 ? -1 : diff));
  return d.toISOString().slice(0, 10);
}
