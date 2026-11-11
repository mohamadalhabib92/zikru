import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { DICTS, type Dict, type Lang } from './i18n';
import { DEFAULT_PLACE, DEFAULT_PRAYER_OPTS, type MethodKey, type Place, type PrayerOpts } from './prayer';
import { resolveDefaultMethod } from './app-placeholders';
import { usePersistentState } from './storage';
import { setUiLang, UiLangContext } from './l10n';
import { DEFAULT_ADHAN_VOICE_ID } from './adhan-voices';
import { DEFAULT_NOTIF, DEFAULT_QUIET, type NotifPrefs } from './notify-plan';
import { setHijriCalendar, type HijriCalendar } from './hijri';
import { sanitizeLandscape, type LandscapeChoice } from './landscapes';

export type Settings = {
  lang: Lang;
  place: Place;
  method: MethodKey;
  /** Calcul de l’heure de l’Asr (ombre ×1 ou ×2) — distinct de l’école de fiqh (`fiqh-madhab`). */
  madhab: 'shafi' | 'hanafi';
  /** true si l’utilisateur a choisi l’Asr lui-même ; sinon il suit l’école de fiqh. */
  asrManual?: boolean;
  hijriOffset: number;
  /** Calendrier hégirien : tabulaire (défaut) ou Umm al-Qura (si l’appareil le fournit, auto-contrôlé ; sinon repli tabulaire). */
  hijriCalendar?: HijriCalendar;
  onboarded: boolean;
  /** Apparence : suit le système par défaut. */
  appearance: 'system' | 'light' | 'dark';
  /** Fond du compteur. Absent des anciens réglages : « aucun ». */
  landscape?: LandscapeChoice;
  /** true : la récitation peut se télécharger en réseau mobile. Absent = Wi-Fi seulement. */
  audioCellular?: boolean;
  /** Rappels de prière (notifications web / préférence). */
  reminders: boolean;
  /** Détail des rappels (prières, avant l’adhan, vendredi, adhkar, wird). */
  notif: NotifPrefs;
  /** Commencer chaque composition « Mes zikrs » par Al-Fatiha (1×). Actif par défaut. */
  fatihaFirst?: boolean;
  /** Identifiant de la voix d’adhan (`adhan-voices.ts`). */
  adhanVoice?: string;
  /** Règle hautes latitudes, ajustements ±min et « Horaires de ma mosquée ». */
  prayer?: PrayerOpts;
};
const DEFAULTS: Settings = { lang: 'fr', place: DEFAULT_PLACE, method: resolveDefaultMethod(), madhab: 'shafi', hijriOffset: 0, onboarded: false, appearance: 'system', landscape: 'none', reminders: false, notif: DEFAULT_NOTIF, fatihaFirst: true, adhanVoice: DEFAULT_ADHAN_VOICE_ID, prayer: DEFAULT_PRAYER_OPTS };

function mergePrayer(p: PrayerOpts | undefined): PrayerOpts {
  return { ...DEFAULT_PRAYER_OPTS, ...p, adjust: { ...p?.adjust }, mosque: { enabled: false, ...p?.mosque, times: { ...p?.mosque?.times } } };
}

type Ctx = { s: Settings; set: (p: Partial<Settings>) => void; t: Dict; ready: boolean };
const C = createContext<Ctx | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [s, setS, ready] = usePersistentState<Settings>('settings', DEFAULTS);
  const prayerKey = JSON.stringify(s.prayer ?? null);
  const prayer = useMemo(() => mergePrayer(s.prayer), [prayerKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const merged = { ...DEFAULTS, ...s, landscape: sanitizeLandscape(s.landscape), notif: { ...DEFAULT_NOTIF, ...s.notif, prayers: { ...DEFAULT_NOTIF.prayers, ...s.notif?.prayers }, quiet: { ...DEFAULT_QUIET, ...s.notif?.quiet } }, prayer };
  setUiLang(merged.lang);
  setHijriCalendar(merged.hijriCalendar);
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
