import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import { clearHistory, DEFAULT_DISPENSE, DISPENSE_KEY, isPausedDay, normalize, pauseLevel, start, stop, type DispenseState } from './dispense';
import type { PauseFn } from './notify-plan';
import { usePersistentState } from './storage';

type Ctx = {
  state: DispenseState;
  /** true si les rappels sont en pause aujourd'hui. */
  pausedToday: boolean;
  begin: (autoDays?: number | null, alsoOthers?: boolean) => void;
  resume: () => void;
  setAlsoOthers: (v: boolean) => void;
  forget: () => void;
  /** Jour neutre pour les séries. */
  neutral: (dayKey: string) => boolean;
  pause: PauseFn;
};
const C = createContext<Ctx | null>(null);

/** Mode dispense : stockage local uniquement (jamais synchronisé, jamais envoyé). */
export function DispenseProvider({ children }: { children: ReactNode }) {
  const [raw, setRaw] = usePersistentState<DispenseState>(DISPENSE_KEY, DEFAULT_DISPENSE);
  const today = new Date().toDateString();
  const state = useMemo(() => normalize(raw), [raw, today]); // eslint-disable-line react-hooks/exhaustive-deps
  const begin = useCallback((autoDays?: number | null, alsoOthers?: boolean) => setRaw((s) => start(normalize(s), new Date(), autoDays, alsoOthers)), [setRaw]);
  const resume = useCallback(() => setRaw((s) => stop(s)), [setRaw]);
  const setAlsoOthers = useCallback((v: boolean) => setRaw((s) => ({ ...normalize(s), alsoOthers: v })), [setRaw]);
  const forget = useCallback(() => setRaw((s) => clearHistory(normalize(s))), [setRaw]);
  const value = useMemo<Ctx>(
    () => ({
      state,
      pausedToday: pauseLevel(state, new Date()) !== 'none',
      begin,
      resume,
      setAlsoOthers,
      forget,
      neutral: (k) => isPausedDay(state, k),
      pause: (d) => pauseLevel(state, d),
    }),
    [state, begin, resume, setAlsoOthers, forget],
  );
  return <C.Provider value={value}>{children}</C.Provider>;
}

const FALLBACK: Ctx = {
  state: DEFAULT_DISPENSE,
  pausedToday: false,
  begin: () => {},
  resume: () => {},
  setAlsoOthers: () => {},
  forget: () => {},
  neutral: () => false,
  pause: () => 'none',
};
export function useDispense(): Ctx {
  return useContext(C) ?? FALLBACK;
}
