/**
 * Pont widgets — version web / par défaut : rien à faire (pas de widgets ni d’activité en direct).
 * Les versions `.ios.ts` et `.android.ts` écrivent dans le groupe d’apps via expo-widgets.
 */
import type { DhikrProps, NextPrayerProps, PrayerActivityProps, TasbihProps } from './widget-data';

export type WidgetPayload = { timeline: { date: Date; props: NextPrayerProps }[]; tasbih: TasbihProps; dhikr: DhikrProps };

export const widgetsAvailable = false;
export const liveActivityAvailable = false;
export function pushWidgets(_p: Partial<WidgetPayload>): void {}
export async function syncLiveActivity(_p: PrayerActivityProps | null): Promise<void> {}
