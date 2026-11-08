/** Progression locale des adhkar (aucun serveur) : compteurs du jour et jours où chaque moment a été terminé. */
import { ADHKAR_MOMENTS, momentDone, type AdhkarMoment, type AdhkarProgress } from './adhkar';
import { shared } from './shared-state';
import { dayKey } from './streak';

type DayProgress = { day: string; p: Partial<Record<AdhkarMoment, AdhkarProgress>> };
export const adhkarToday = shared<DayProgress>('adhkar-today', { day: '', p: {} });
/** Jour (AAAA-MM-JJ) → moments terminés. 120 jours gardés. */
export const adhkarDays = shared<Record<string, AdhkarMoment[]>>('adhkar-days', {});

export function progressOf(m: AdhkarMoment, today = dayKey()): AdhkarProgress {
  const v = adhkarToday.get();
  return v.day === today ? (v.p[m] ?? {}) : {};
}

/** Ajoute `n` répétitions (ou remet à zéro avec n = -Infinity) et note le moment s’il est terminé. */
export function bump(m: AdhkarMoment, id: string, n: number, cap: number, today = dayKey()) {
  adhkarToday.set((v) => {
    const base = v.day === today ? v : { day: today, p: {} };
    const cur = base.p[m] ?? {};
    const next = Math.max(0, Math.min(cap, (cur[id] ?? 0) + n));
    return { day: today, p: { ...base.p, [m]: { ...cur, [id]: next } } };
  });
  const prog = progressOf(m, today);
  const { done, total } = momentDone(m, prog);
  adhkarDays.set((d) => {
    const list = d[today] ?? [];
    const has = list.includes(m);
    if ((done >= total && total > 0) === has) return d;
    const nextList = has ? list.filter((x) => x !== m) : [...list, m].sort((a, b) => ADHKAR_MOMENTS.indexOf(a) - ADHKAR_MOMENTS.indexOf(b));
    return Object.fromEntries(Object.entries({ ...d, [today]: nextList }).sort(([a], [b]) => (a < b ? 1 : -1)).slice(0, 120));
  });
}
