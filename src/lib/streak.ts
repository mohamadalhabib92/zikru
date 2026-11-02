import { addDays, dayKey } from './dates';

/**
 * Série de jours consécutifs (aujourd'hui, ou hier si aujourd'hui n'est pas encore actif).
 * `excused` : jour pont (mode dispense). Il n'incrémente pas la série et ne la casse pas.
 */
export function streak(active: (k: string) => boolean, today = new Date(), excused?: (k: string) => boolean): number {
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12);
  const key = () => dayKey(d);
  const bridge = () => !!excused?.(key()) && !active(key());
  if (!active(key())) {
    if (bridge()) while (bridge()) d.setDate(d.getDate() - 1);
    else d.setDate(d.getDate() - 1);
  }
  let n = 0;
  while (n < 3650) {
    if (active(key())) {
      n++;
      d.setDate(d.getDate() - 1);
      continue;
    }
    if (bridge()) {
      d.setDate(d.getDate() - 1);
      continue;
    }
    break;
  }
  return n;
}

/** Jours strictement entre `from` et `to` : consécutifs, ou tous couverts par `excused`. */
function gapExcused(from: string, to: string, excused?: (k: string) => boolean): boolean {
  const span = Math.round((new Date(to + 'T12:00:00').getTime() - new Date(from + 'T12:00:00').getTime()) / 86400000);
  if (span === 1) return true;
  if (span <= 0 || span > 40 || !excused) return false;
  for (let i = 1; i < span; i++) if (!excused(addDays(from, i))) return false;
  return true;
}

/** Plus longue série. Les jours `excused` entre deux jours actifs ne la coupent pas. */
export function bestStreak(days: string[], excused?: (k: string) => boolean): number {
  const set = [...new Set(days)].sort();
  let best = 0;
  let cur = 0;
  let prev: string | null = null;
  for (const k of set) {
    cur = prev != null && gapExcused(prev, k, excused) ? cur + 1 : 1;
    best = Math.max(best, cur);
    prev = k;
  }
  return best;
}
