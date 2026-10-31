/** Séries de jours (module pur, testé par scripts/test-pass1.mjs). */
export const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Jour « neutre » (mode dispense) : ne compte pas et ne casse pas une série. */
export type NeutralFn = (k: string) => boolean;
const never: NeutralFn = () => false;

/** Série de jours consécutifs (aujourd'hui ou hier inclus) où `active(day)` est vrai ; les jours neutres sont sautés. */
export function streak(active: (k: string) => boolean, today = new Date(), neutral: NeutralFn = never): number {
  const d = new Date(today);
  if (!active(dayKey(d))) d.setDate(d.getDate() - 1);
  let n = 0;
  for (let steps = 0; steps < 3650; steps++) {
    const k = dayKey(d);
    if (active(k)) n++;
    else if (!neutral(k)) break;
    d.setDate(d.getDate() - 1);
  }
  return n;
}
export function bestStreak(days: string[], neutral: NeutralFn = never): number {
  const set = [...new Set(days)].sort();
  let best = 0;
  let cur = 0;
  let prev: number | null = null;
  for (const k of set) {
    const t = new Date(k + 'T12:00:00').getTime();
    let linked = prev != null && Math.round((t - prev) / 86400000) === 1;
    if (!linked && prev != null) {
      // trou uniquement fait de jours neutres → la série continue
      const gap = Math.round((t - prev) / 86400000);
      linked = gap > 1 && gap <= 366;
      for (let i = 1; linked && i < gap; i++) {
        const d = new Date(prev);
        d.setDate(d.getDate() + i);
        linked = neutral(dayKey(d));
      }
    }
    cur = linked ? cur + 1 : 1;
    best = Math.max(best, cur);
    prev = t;
  }
  return best;
}

