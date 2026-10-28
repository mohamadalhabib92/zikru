import { useEffect } from 'react';
import { Platform } from 'react-native';
import { planFor } from './reminders-common';
import { useSettings } from './settings';

/**
 * Rappels — version web (PWA) : API Notification du navigateur, programmée tant que l’app est ouverte.
 * La version iOS/Android (notifications locales programmées) est dans reminders.native.ts.
 */
export const remindersSupported = () => Platform.OS === 'web' && typeof window !== 'undefined' && 'Notification' in window;
export const remindersNative = false;

export async function requestReminderPermission(): Promise<boolean> {
  if (!remindersSupported()) return false;
  try {
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    return (await Notification.requestPermission()) === 'granted';
  } catch {
    return false;
  }
}

export async function reminderPermission(): Promise<'granted' | 'denied' | 'undetermined'> {
  if (!remindersSupported()) return 'denied';
  return Notification.permission === 'default' ? 'undetermined' : (Notification.permission as 'granted' | 'denied');
}

/** Nombre de rappels programmés (web : 1 minuterie à la fois). */
export async function scheduledCount(): Promise<number> {
  return remindersSupported() && Notification.permission === 'granted' ? 1 : 0;
}

export async function sendTestNotification(title: string, body: string) {
  if (!(await requestReminderPermission())) return;
  try {
    new Notification(title, { body, tag: 'zikru-test' });
  } catch {}
}

/** Programme la prochaine notification du plan tant que l’app (PWA) est ouverte, puis la suivante. */
export function usePrayerReminders() {
  const { s, t: tr, ready } = useSettings();
  useEffect(() => {
    if (!ready || !s.reminders || !remindersSupported() || Notification.permission !== 'granted') return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      const now = new Date();
      const next = planFor(now, s, tr).find((e) => e.kind !== 'paused' && e.date.getTime() > now.getTime() + 1000);
      if (!next) return;
      const delay = Math.min(next.date.getTime() - now.getTime(), 2 ** 31 - 1);
      timer = setTimeout(() => {
        try {
          new Notification(next.title, { body: next.body, tag: `zikru-${next.id}` });
        } catch {}
        schedule();
      }, delay);
    };
    schedule();
    return () => clearTimeout(timer);
  }, [ready, s.reminders, s.place, s.method, s.madhab, s.notif, tr]);
}
