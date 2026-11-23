/**
 * Mémorisation sur Apple TV : mêmes cartes SM-2 que l’iPhone (`hifz-cards`), sans écran à part.
 * Gratuit, comme sur l’iPhone : aucun verrou Premium autour du hifz.
 */
import { gIndex } from './quran-nav';
import { SURAHS } from './surahs';
import { dailyQueue, type Card } from './srs';

export const TV_HIFZ_IS_PREMIUM = false;
export const TV_HIFZ_ARABIC = 60;
export const TV_HIFZ_LINE = 108;
export const TV_HIFZ_LESSON = 5;

export type TvHide = 'none' | 'first' | 'alt' | 'all' | 'blur';

const CYCLE: TvHide[] = ['none', 'first', 'alt', 'all'];

export function nextTvHide(mode: TvHide): TvHide {
  const cur = mode === 'blur' ? 'all' : mode;
  const i = CYCLE.indexOf(cur);
  return CYCLE[(i + 1) % CYCLE.length];
}

/** Prochaine leçon : jusqu’à 5 versets à partir du premier non suivi dans la sourate. */
export function tvLessonSpan(surah: number, cards: Record<string, Card>, count = TV_HIFZ_LESSON): { from: number; to: number } {
  const meta = SURAHS[Math.min(114, Math.max(1, surah)) - 1];
  let from = 1;
  for (let a = 1; a <= meta[4]; a++) {
    if (!cards[String(gIndex(surah, a))] && !cards[gIndex(surah, a)]) {
      from = a;
      break;
    }
  }
  return { from, to: Math.min(meta[4], from + count - 1) };
}

/** File du jour, dans l’ordre iPhone : sabaq, puis sabqi, puis manzil. */
export function tvReviewKeys(cards: Record<string, Card>, today: string): number[] {
  const q = dailyQueue(cards, today);
  return [...q.sabaq, ...q.sabqi, ...q.manzil];
}
