import { createContext, useContext, type ReactNode } from 'react';
import { DICTS, type Dict, type Lang } from './i18n';
import { DEFAULT_PLACE, type MethodKey, type Place } from './prayer';
import { usePersistentState } from './storage';
import { DEFAULT_NOTIF, type NotifPrefs } from './notify-plan';

export type Settings = {
  lang: Lang;
  place: Place;
  method: MethodKey;
  madhab: 'shafi' | 'hanafi';
  hijriOffset: number;
  onboarded: boolean;
  /** Apparence : suit le système par défaut. */
  appearance: 'system' | 'light' | 'dark';
  /** Rappels de prière (notifications web / préférence). */
  reminders: boolean;
  /** Détail des rappels (prières, avant l’adhan, vendredi, adhkar, wird). */
  notif: NotifPrefs;
};
const DEFAULTS: Settings = { lang: 'fr', place: DEFAULT_PLACE, method: 'MuslimWorldLeague', madhab: 'shafi', hijriOffset: 0, onboarded: false, appearance: 'system', reminders: false, notif: DEFAULT_NOTIF };

type Ctx = { s: Settings; set: (p: Partial<Settings>) => void; t: Dict; ready: boolean };
const C = createContext<Ctx | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [s, setS, ready] = usePersistentState<Settings>('settings', DEFAULTS);
  const merged = { ...DEFAULTS, ...s, notif: { ...DEFAULT_NOTIF, ...s.notif, prayers: { ...DEFAULT_NOTIF.prayers, ...s.notif?.prayers } } };
  return <C.Provider value={{ s: merged, set: (p) => setS((prev) => ({ ...DEFAULTS, ...prev, ...p })), t: DICTS[merged.lang] ?? DICTS.fr, ready }}>{children}</C.Provider>;
}
export function useSettings() {
  const v = useContext(C);
  if (!v) throw new Error('SettingsProvider manquant');
  return v;
}
