import { requireOptionalNativeModule } from 'expo';
import type { Widget } from 'expo-widgets';
import type { DhikrProps, NextPrayerProps, PrayerActivityProps, TasbihProps } from './widget-data';
import type { WidgetPayload } from './widget-bridge';

/** Android : widgets d’écran d’accueil (pas de chronologie ni d’activité en direct sur Android). */
const native = requireOptionalNativeModule('ExpoWidgets');
type Mods = { next: Widget<NextPrayerProps>; tasbih: Widget<TasbihProps>; dhikr: Widget<DhikrProps> };
let mods: Mods | null | undefined;
function load(): Mods | null {
  if (mods !== undefined) return mods;
  if (!native) return (mods = null);
  try {
    /* eslint-disable @typescript-eslint/no-require-imports */
    mods = {
      next: require('../../widgets/android/NextPrayer').default,
      tasbih: require('../../widgets/android/Tasbih').default,
      dhikr: require('../../widgets/android/DailyDhikr').default,
    };
    /* eslint-enable @typescript-eslint/no-require-imports */
  } catch {
    mods = null;
  }
  return mods;
}

export const widgetsAvailable = !!native;
export const liveActivityAvailable = false;

export function pushWidgets(p: Partial<WidgetPayload>): void {
  const m = load();
  if (!m) return;
  try {
    // Sans chronologie : on écrit la prochaine prière ; l’app réécrit à chaque ouverture et à chaque adhan passé.
    if (p.timeline?.[0]) m.next.updateSnapshot(p.timeline[0].props);
    if (p.tasbih) m.tasbih.updateSnapshot(p.tasbih);
    if (p.dhikr) m.dhikr.updateSnapshot(p.dhikr);
  } catch {
    /* sans effet */
  }
}
export async function syncLiveActivity(_p: PrayerActivityProps | null): Promise<void> {}
