import { dayKey } from './dates';

/** Période locale où les rappels sont suspendus et les séries ne sont pas cassées. Jamais synchronisée. */
export type DispenseRange = { from: string; to: string };
export type DispenseState = { on: boolean; from: string | null; ranges: DispenseRange[] };

export const DISPENSE_OFF: DispenseState = { on: false, from: null, ranges: [] };

export function normalizeDispense(raw: Partial<DispenseState> | null | undefined): DispenseState {
  const ranges = Array.isArray(raw?.ranges) ? raw.ranges.filter((r) => r && typeof r.from === 'string' && typeof r.to === 'string') : [];
  return { on: raw?.on === true, from: typeof raw?.from === 'string' ? raw.from : null, ranges };
}

/** Le jour civil `day` (AAAA-MM-JJ) est-il couvert par le mode dispense ? */
export function dispenseCovers(state: DispenseState | null | undefined, day: string, today = dayKey()): boolean {
  const s = normalizeDispense(state);
  if (s.on && s.from && day >= s.from && day <= today) return true;
  return s.ranges.some((r) => day >= r.from && day <= r.to);
}

/** Active ou clôt le mode. La clôture archive la période (la série passée reste protégée). */
export function setDispense(state: DispenseState | null | undefined, on: boolean, today = dayKey()): DispenseState {
  const cur = normalizeDispense(state);
  if (on) return { ...cur, on: true, from: cur.on && cur.from ? cur.from : today };
  if (!cur.on || !cur.from) return { ...cur, on: false, from: null };
  return { on: false, from: null, ranges: [...cur.ranges, { from: cur.from, to: today }].slice(-400) };
}
