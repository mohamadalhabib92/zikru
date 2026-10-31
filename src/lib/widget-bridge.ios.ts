import { requireOptionalNativeModule } from 'expo';
import type { LiveActivity, LiveActivityFactory, Widget } from 'expo-widgets';
import type { DhikrProps, NextPrayerProps, PrayerActivityProps, TasbihProps } from './widget-data';
import type { WidgetPayload } from './widget-bridge';

/**
 * iOS : widgets (accueil + écran verrouillé) et activité en direct via expo-widgets.
 * Chargement paresseux et protégé : un binaire sans l’extension (ancienne version, ZIKRU_NO_WIDGETS=1)
 * ne plante pas — tout devient sans effet.
 */
const native = requireOptionalNativeModule('ExpoWidgets');
type Mods = { next: Widget<NextPrayerProps>; tasbih: Widget<TasbihProps>; dhikr: Widget<DhikrProps>; live: LiveActivityFactory<PrayerActivityProps> };
let mods: Mods | null | undefined;
function load(): Mods | null {
  if (mods !== undefined) return mods;
  if (!native) return (mods = null);
  try {
    /* eslint-disable @typescript-eslint/no-require-imports */
    mods = {
      next: require('../../widgets/ios/NextPrayer').default,
      tasbih: require('../../widgets/ios/Tasbih').default,
      dhikr: require('../../widgets/ios/DailyDhikr').default,
      live: require('../../widgets/ios/PrayerActivity').default,
    };
    /* eslint-enable @typescript-eslint/no-require-imports */
  } catch {
    mods = null;
  }
  return mods;
}

export const widgetsAvailable = !!native;
export const liveActivityAvailable = !!native;

export function pushWidgets(p: Partial<WidgetPayload>): void {
  const m = load();
  if (!m) return;
  try {
    if (p.timeline) {
      if (p.timeline.length) m.next.updateTimeline(p.timeline);
    }
    if (p.tasbih) m.tasbih.updateSnapshot(p.tasbih);
    if (p.dhikr) m.dhikr.updateSnapshot(p.dhikr);
  } catch {
    /* widget non installé ou extension absente : sans effet */
  }
}

/** Démarre, met à jour ou termine l’unique activité « prochaine prière ». `null` = aucune activité. */
export async function syncLiveActivity(p: PrayerActivityProps | null): Promise<void> {
  const m = load();
  if (!m) return;
  try {
    const list: LiveActivity<PrayerActivityProps>[] = m.live.getInstances();
    if (!p) {
      await Promise.all(list.map((a) => a.end('immediate')));
      return;
    }
    const stale = new Date(p.at + 10 * 60000);
    const [first, ...rest] = list;
    await Promise.all(rest.map((a) => a.end('immediate')));
    if (first) await first.update(p, stale);
    else m.live.start(p, 'zikru:///prayers', stale);
    // Après l’heure : le minuteur système s’arrête à 0, iOS grise l’activité (staleDate) et la
    // prochaine ouverture de l’app la remplace ou la termine. Aucun push serveur.
  } catch {
    /* activités désactivées par l’utilisateur dans Réglages iOS : sans effet */
  }
}
