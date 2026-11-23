/** Plan et série de mémorisation, à part des cartes. Préfixe @zikru/ via shared(). */
import { shared } from './shared-state';
import { sanitizePlan, sanitizeStreak, type HifzPlan, type HifzStreak } from './hifz-wave';

export const hifzPlan = shared<HifzPlan | null>('hifz-plan', null, (v) => sanitizePlan(v));
export const hifzStreak = shared<HifzStreak | null>('hifz-streak', null, (v) => sanitizeStreak(v));
