/**
 * Chargement des annotations tajwid (édition « quran-tajweed » d’alquran.cloud), sourate par sourate.
 * N’est appelé QUE si la licence est confirmée (tajwidColorsAllowed) ou dans une build d’aperçu locale
 * (EXPO_PUBLIC_TAJWID_PREVIEW=1, jamais en production). Aucune donnée tajwid n’est embarquée dans l’app.
 */
import { tajwidColorsAllowed } from '@/lib/tajwid';

export const TAJWID_PREVIEW = process.env.EXPO_PUBLIC_TAJWID_PREVIEW === '1';
export const tajwidVisible = () => tajwidColorsAllowed() || TAJWID_PREVIEW;

const cache = new Map<number, Promise<string[] | null>>();
/** Versets annotés de la sourate (null si indisponible ou non autorisé). */
export function loadTajweedSurah(n: number): Promise<string[] | null> {
  if (!tajwidVisible()) return Promise.resolve(null);
  let p = cache.get(n);
  if (!p) {
    p = fetch(`https://api.alquran.cloud/v1/surah/${n}/quran-tajweed`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { data?: { ayahs?: { text: string }[] } } | null) => j?.data?.ayahs?.map((a) => a.text) ?? null)
      .catch(() => null);
    cache.set(n, p);
  }
  return p;
}
