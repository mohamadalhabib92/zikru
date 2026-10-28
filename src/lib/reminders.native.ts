import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import { planHash } from './notify-plan';
import { planFor } from './reminders-common';
import { useSettings } from './settings';
import { loadJSON, saveJSON } from './storage';

/**
 * Rappels natifs (iOS/Android) : notifications LOCALES programmées à l’avance (aucun serveur, aucun push distant).
 * iOS garde au plus 64 notifications : le plan glissant (notify-plan.ts) en programme ≤ 64 et se renouvelle
 * à chaque ouverture de l’app, à minuit, et dès que le lieu, la méthode, l’école ou les préférences changent.
 * Son : son système par défaut (aucun adhan protégé embarqué).
 */
export const remindersSupported = () => true;
export const remindersNative = true;

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

const CHANNEL = 'prayers';
async function ensureChannel() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL, { name: 'Prières', importance: Notifications.AndroidImportance.HIGH, sound: 'default' });
  }
}

export async function reminderPermission(): Promise<'granted' | 'denied' | 'undetermined'> {
  try {
    const p = await Notifications.getPermissionsAsync();
    if (p.granted || p.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) return 'granted';
    return p.canAskAgain ? 'undetermined' : 'denied';
  } catch {
    return 'denied';
  }
}

export async function requestReminderPermission(): Promise<boolean> {
  try {
    const cur = await Notifications.getPermissionsAsync();
    if (cur.granted) return true;
    if (!cur.canAskAgain) return false;
    const r = await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: true, allowBadge: false } });
    return r.granted || r.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
  } catch {
    return false;
  }
}

export async function scheduledCount(): Promise<number> {
  try {
    return (await Notifications.getAllScheduledNotificationsAsync()).length;
  } catch {
    return 0;
  }
}

export async function sendTestNotification(title: string, body: string) {
  if (!(await requestReminderPermission())) return;
  await ensureChannel();
  await Notifications.scheduleNotificationAsync({
    content: { title, body, sound: 'default', data: { url: '/settings' } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 3, channelId: CHANNEL },
  });
}

const HASH_KEY = 'notif-hash';
let running: Promise<void> | null = null;

/** (Re)programme le plan si nécessaire. Sans permission ou rappels désactivés : tout est annulé. */
async function sync(enabled: boolean, build: () => ReturnType<typeof planFor>) {
  if (!enabled || (await reminderPermission()) !== 'granted') {
    await Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
    await saveJSON(HASH_KEY, '');
    return;
  }
  const plan = build();
  const hash = planHash(plan);
  const [prev, current] = await Promise.all([loadJSON<string>(HASH_KEY, ''), Notifications.getAllScheduledNotificationsAsync().catch(() => [])]);
  const stillThere = plan.filter((e) => e.date.getTime() > Date.now() + 60000).length;
  if (prev === hash && current.length >= stillThere && current.length > 0) return;
  await ensureChannel();
  await Notifications.cancelAllScheduledNotificationsAsync();
  for (const e of plan) {
    if (e.date.getTime() <= Date.now() + 2000) continue;
    await Notifications.scheduleNotificationAsync({
      identifier: e.id,
      content: { title: e.title, body: e.body, sound: 'default', data: { url: e.url, kind: e.kind } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: e.date, channelId: CHANNEL },
    });
  }
  await saveJSON(HASH_KEY, hash);
}

export function usePrayerReminders() {
  const { s, t: tr, ready } = useSettings();
  const router = useRouter();
  const latest = useRef({ s, tr });
  latest.current = { s, tr };

  // Ouverture depuis une notification → écran concerné.
  useEffect(() => {
    const go = (r: Notifications.NotificationResponse | null) => {
      const url = r?.notification.request.content.data?.url;
      if (typeof url === 'string' && url.startsWith('/')) setTimeout(() => router.push(url as never), 300);
    };
    Notifications.getLastNotificationResponseAsync().then(go).catch(() => {});
    const sub = Notifications.addNotificationResponseReceivedListener(go);
    return () => sub.remove();
  }, [router]);

  useEffect(() => {
    if (!ready) return;
    const run = () => {
      const { s: cur, tr: t } = latest.current;
      const job = (running ?? Promise.resolve()).then(() => sync(cur.reminders, () => planFor(new Date(), cur, t))).catch(() => {});
      running = job;
    };
    run();
    // Au retour au premier plan + à minuit (+1 min) tant que l’app reste ouverte.
    const sub = AppState.addEventListener('change', (st) => st === 'active' && run());
    let timer: ReturnType<typeof setTimeout>;
    const arm = () => {
      const n = new Date();
      const mid = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1, 0, 1).getTime() - n.getTime();
      timer = setTimeout(() => {
        run();
        arm();
      }, mid);
    };
    arm();
    return () => {
      sub.remove();
      clearTimeout(timer);
    };
  }, [ready, s.reminders, s.place, s.method, s.madhab, s.notif, s.lang]);
}
