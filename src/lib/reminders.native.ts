import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import { maybePlayScheduledAdhan, useBindAdhanPlayback } from './adhan-call';
import { ADHAN_CHANNEL_ID, ADHAN_CUE_SOUND, adhanResponseIsFresh, payloadPlaysAdhan } from './adhan-voices';
import { planHash } from './notify-plan';
import { planFor } from './reminders-common';
import { useDispense } from './dispense-context';
import { useRamadan } from './ramadan-store';
import { useSettings } from './settings';
import { loadJSON, saveJSON } from './storage';

/**
 * Rappels natifs (iOS/Android) : notifications LOCALES programmées à l’avance (aucun serveur, aucun push distant).
 * iOS garde au plus 64 notifications : le plan glissant (notify-plan.ts) en programme ≤ 64 et se renouvelle
 * à chaque ouverture de l’app, à minuit, et dès que le lieu, la méthode, l’école ou les préférences changent.
 *
 * L’adhan complet (voix choisie, souvent plusieurs minutes, fichier distant) ne peut pas être le son
 * de la notification : iOS n’accepte qu’un son embarqué de moins de 30 secondes, et Android ne lit pas
 * une adresse distante dans la notification. Le son embarqué est la lecture courte de Jarih
 * (`adhan_cue.wav`, CC BY-SA 3.0). La voix choisie démarre si l’app est ouverte, ou à l’ouverture
 * de la notification. Un démarrage ordinaire ne relance pas un ancien adhan.
 */
export const remindersSupported = () => true;
export const remindersNative = true;

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const adhan = payloadPlaysAdhan(notification.request.content.data);
    // Android : shouldPlaySound false masque aussi la bannière. iOS : on coupe le son court
    // pour ne pas le superposer à la voix choisie, que l’app lance elle-même au premier plan.
    return {
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: Platform.OS === 'android' || !adhan,
      shouldSetBadge: false,
    };
  },
});

const CHANNEL = 'prayers';
/** Android : canal séparé pour les rappels secondaires (adhkar, wird, Coran, bilal…), réglable à part dans le système. */
const CHANNEL_OTHER = 'reminders';
async function ensureChannel() {
  if (Platform.OS !== 'android') return;
  const imp = Notifications.AndroidImportance;
  await Notifications.setNotificationChannelAsync(CHANNEL, { name: 'Prières', importance: imp.HIGH, sound: 'default' });
  await Notifications.setNotificationChannelAsync(CHANNEL_OTHER, { name: 'Rappels (adhkar, wird, Coran, bilan)', importance: imp.DEFAULT, sound: 'default' });
  // Le son court n’est dans le binaire qu’après un prebuild. S’il manque, on garde le canal par défaut.
  await Notifications.setNotificationChannelAsync(ADHAN_CHANNEL_ID, { name: 'Adhan', importance: imp.HIGH, sound: ADHAN_CUE_SOUND }).catch(() => {});
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
    const cue = !!e.playsAdhan;
    const channelId = cue ? ADHAN_CHANNEL_ID : e.kind === 'prayer' || e.kind === 'before' || e.kind === 'paused' || e.kind === 'suhur' || e.kind === 'iftar' ? CHANNEL : CHANNEL_OTHER;
    const content = {
      title: e.title,
      body: e.body,
      sound: cue ? ADHAN_CUE_SOUND : 'default',
      data: { url: e.url, kind: e.kind, playsAdhan: cue ? '1' : '0' },
    };
    const when = { type: Notifications.SchedulableTriggerInputTypes.DATE, date: e.date };
    try {
      await Notifications.scheduleNotificationAsync({
        identifier: e.id,
        content,
        trigger: { ...when, channelId },
      });
    } catch {
      await Notifications.scheduleNotificationAsync({
        identifier: e.id,
        content: { ...content, sound: 'default' },
        trigger: { ...when, channelId: channelId === ADHAN_CHANNEL_ID ? CHANNEL : channelId },
      }).catch(() => {});
    }
  }
  await saveJSON(HASH_KEY, hash);
}

export function usePrayerReminders() {
  const { s, t: tr, ready } = useSettings();
  const router = useRouter();
  const { pause } = useDispense();
  const { fast } = useRamadan();
  const latest = useRef({ s, tr, pause, fast });
  latest.current = { s, tr, pause, fast };
  useBindAdhanPlayback();

  // Ouverture depuis une notification → écran concerné, et adhan si c’est l’heure d’une prière.
  useEffect(() => {
    const go = (r: Notifications.NotificationResponse | null, cold: boolean) => {
      const url = r?.notification.request.content.data?.url;
      if (typeof url === 'string' && url.startsWith('/')) setTimeout(() => router.push(url as never), 300);
      if (!r) return;
      if (cold && !adhanResponseIsFresh(r.notification.date)) return;
      void maybePlayScheduledAdhan(r.notification.request.identifier, r.notification.request.content.data);
    };
    Notifications.getLastNotificationResponseAsync().then((r) => go(r, true)).catch(() => {});
    const opened = Notifications.addNotificationResponseReceivedListener((r) => go(r, false));
    const received = Notifications.addNotificationReceivedListener((n) => {
      void maybePlayScheduledAdhan(n.request.identifier, n.request.content.data);
    });
    return () => {
      opened.remove();
      received.remove();
    };
  }, [router]);

  useEffect(() => {
    if (!ready) return;
    const run = () => {
      const { s: cur, tr: t } = latest.current;
      const job = (running ?? Promise.resolve()).then(() => sync(cur.reminders, () => planFor(new Date(), cur, t, latest.current.pause, latest.current.fast))).catch(() => {});
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
  }, [ready, s.reminders, s.place, s.method, s.madhab, s.prayer, s.notif, s.lang, pause, fast]);
}
