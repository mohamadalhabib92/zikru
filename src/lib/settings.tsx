import { createContext, useContext, type ReactNode } from 'react';
import { DICTS, type Dict, type Lang } from './i18n';
import { dispenseCovers, normalizeDispense, type DispenseState } from './dispense';
import { DEFAULT_PLACE, resolveDefaultMethod, type HighLatKey, type MethodKey, type MinuteAdjustments, type MosqueTimetable, type Place } from './prayer';
import { usePersistentState } from './storage';
import { setUiLang, UiLangContext } from './l10n';
import { DEFAULT_NOTIF, type NotifPrefs } from './notify-plan';

export type Settings = {
  lang: Lang;
  place: Place;
  method: MethodKey;
  /** Calcul de l’heure de l’Asr (ombre ×1 ou ×2) — distinct de l’école de fiqh (`fiqh-madhab`). */
  madhab: 'shafi' | 'hanafi';
  /** true si l’utilisateur a choisi l’Asr lui-même ; sinon il suit l’école de fiqh. */
  asrManual?: boolean;
  hijriOffset: number;
  onboarded: boolean;
  /** Apparence : suit le système par défaut. */
  appearance: 'system' | 'light' | 'dark';
  /** Rappels de prière (notifications web / préférence). */
  reminders: boolean;
  /** Détail des rappels (prières, avant l’adhan, vendredi, adhkar, wird). */
  notif: NotifPrefs;
  /** Commencer chaque composition « Mes zikrs » par Al-Fatiha (1×). Actif par défaut. */
  fatihaFirst?: boolean;
  /** Règle des hautes latitudes. Absent = recommandation adhan (comportement historique). */
  highLat?: HighLatKey;
  /** ± minutes par prière, appliquées au calcul seulement. */
  adjustments?: MinuteAdjustments;
  /** Horaires saisis, prioritaires sur le calcul quand `enabled`. */
  mosque?: MosqueTimetable;
  /** Lieu de prière pour la sourdine opt-in. Local. */
  mosquePlace?: { lat: number; lng: number; label: string } | null;
  /** Mode dispense : local, jamais synchronisé. */
  dispense?: DispenseState;
};
const DEFAULTS: Settings = {
  lang: 'fr',
  place: DEFAULT_PLACE,
  method: resolveDefaultMethod(),
  madhab: 'shafi',
  hijriOffset: 0,
  onboarded: false,
  appearance: 'system',
  reminders: false,
  notif: DEFAULT_NOTIF,
  fatihaFirst: true,
  highLat: 'recommended',
  adjustments: {},
  mosque: { enabled: false, label: '', times: {} },
  mosquePlace: null,
  dispense: { on: false, from: null, ranges: [] },
};

export function excusedDay(s: Settings, day: string): boolean {
  return dispenseCovers(s.dispense, day);
}

type Ctx = { s: Settings; set: (p: Partial<Settings>) => void; t: Dict; ready: boolean };
const C = createContext<Ctx | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [s, setS, ready] = usePersistentState<Settings>('settings', DEFAULTS);
  const merged: Settings = {
    ...DEFAULTS,
    ...s,
    notif: { ...DEFAULT_NOTIF, ...s.notif, prayers: { ...DEFAULT_NOTIF.prayers, ...s.notif?.prayers } },
    adjustments: { ...s.adjustments },
    mosque: { ...DEFAULTS.mosque!, ...s.mosque, times: { ...s.mosque?.times } },
    dispense: normalizeDispense(s.dispense),
  };
  setUiLang(merged.lang);
  return (
    <C.Provider value={{ s: merged, set: (p) => setS((prev) => ({ ...DEFAULTS, ...prev, ...p })), t: DICTS[merged.lang] ?? DICTS.fr, ready }}>
      <UiLangContext.Provider value={merged.lang}>{children}</UiLangContext.Provider>
    </C.Provider>
  );
}
export function useSettings() {
  const v = useContext(C);
  if (!v) throw new Error('SettingsProvider manquant');
  return v;
}
