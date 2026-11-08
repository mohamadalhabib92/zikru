import type { PauseLevel } from './notify-plan';

/**
 * Mode dispense — 100 % local, discret, jamais synchronisé ni envoyé (clé de stockage « dispense »).
 * Met en pause les rappels liés à la prière et rend les jours concernés NEUTRES pour les séries :
 * un jour en pause ne compte pas et ne casse pas une série. Aucune règle de fiqh n'est codée ici
 * (pas de durée imposée) : l'utilisateur choisit quand commencer et quand reprendre.
 */
export type DispenseState = {
  /** Pause en cours depuis `since` (clé de jour AAAA-MM-JJ). */
  active: boolean;
  since?: string;
  /** Reprise automatique ce jour-là (exclu de la pause) ; absent = reprise manuelle. */
  until?: string | null;
  /** Mettre aussi en pause les autres rappels (adhkar, wird, Coran, al-Kahf). */
  alsoOthers?: boolean;
  /** Périodes terminées (bornes incluses), gardées pour que les séries restent intactes. */
  history: { from: string; to: string }[];
};
export const DISPENSE_KEY = 'dispense';
export const DEFAULT_DISPENSE: DispenseState = { active: false, until: null, alsoOthers: false, history: [] };
/** Au-delà, les plus anciennes périodes sont oubliées (minimisation). */
export const MAX_HISTORY = 24;
export const MAX_AUTO_DAYS = 60;

export const dayKeyOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDays = (k: string, n: number) => {
  const d = new Date(k + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return dayKeyOf(d);
};

/** Fin automatique atteinte → la pause passe dans l'historique. */
export function normalize(s: DispenseState | null | undefined, today: Date = new Date()): DispenseState {
  const st: DispenseState = { ...DEFAULT_DISPENSE, ...s, history: Array.isArray(s?.history) ? s!.history : [] };
  const tk = dayKeyOf(today);
  if (st.active && st.since && st.until && tk >= st.until) {
    return { ...st, active: false, since: undefined, until: null, history: [...st.history, { from: st.since, to: addDays(st.until, -1) }].slice(-MAX_HISTORY) };
  }
  return st;
}

export function start(s: DispenseState, today: Date = new Date(), autoDays?: number | null, alsoOthers = s.alsoOthers ?? false): DispenseState {
  const since = dayKeyOf(today);
  const n = autoDays && Number.isFinite(autoDays) ? Math.max(1, Math.min(MAX_AUTO_DAYS, Math.round(autoDays))) : null;
  return { ...normalize(s, today), active: true, since, until: n ? addDays(since, n) : null, alsoOthers };
}

/** Reprendre maintenant : la journée en cours reste neutre. */
export function stop(s: DispenseState, today: Date = new Date()): DispenseState {
  const st = normalize(s, today);
  if (!st.active || !st.since) return { ...st, active: false };
  return { ...st, active: false, since: undefined, until: null, history: [...st.history, { from: st.since, to: dayKeyOf(today) }].slice(-MAX_HISTORY) };
}

export const clearHistory = (s: DispenseState): DispenseState => ({ ...s, history: [] });

/** Jour neutre pour les séries (passé ou en cours). */
export function isPausedDay(s: DispenseState, key: string): boolean {
  if (s.history.some((p) => key >= p.from && key <= p.to)) return true;
  return !!(s.active && s.since && key >= s.since && (!s.until || key < s.until));
}

/** Niveau de pause des rappels pour un jour futur (le plan suit la reprise automatique). */
export function pauseLevel(s: DispenseState, day: Date): PauseLevel {
  if (!s.active || !s.since) return 'none';
  const k = dayKeyOf(day);
  if (k < s.since || (s.until && k >= s.until)) return 'none';
  return s.alsoOthers ? 'all' : 'prayers';
}
