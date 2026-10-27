import { createContext, useContext, type ReactNode } from 'react';
import { DICTS, type Dict, type Lang } from './i18n';
import { DEFAULT_PLACE, type MethodKey, type Place } from './prayer';
import { usePersistentState } from './storage';

export type Settings = {
  lang: Lang;
  place: Place;
  method: MethodKey;
  madhab: 'shafi' | 'hanafi';
  hijriOffset: number;
  onboarded: boolean;
};
const DEFAULTS: Settings = { lang: 'fr', place: DEFAULT_PLACE, method: 'MuslimWorldLeague', madhab: 'shafi', hijriOffset: 0, onboarded: false };

type Ctx = { s: Settings; set: (p: Partial<Settings>) => void; t: Dict; ready: boolean };
const C = createContext<Ctx | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [s, setS, ready] = usePersistentState<Settings>('settings', DEFAULTS);
  const merged = { ...DEFAULTS, ...s };
  return <C.Provider value={{ s: merged, set: (p) => setS((prev) => ({ ...DEFAULTS, ...prev, ...p })), t: DICTS[merged.lang] ?? DICTS.fr, ready }}>{children}</C.Provider>;
}
export function useSettings() {
  const v = useContext(C);
  if (!v) throw new Error('SettingsProvider manquant');
  return v;
}
