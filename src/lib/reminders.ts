import { useEffect } from 'react';
import { Platform } from 'react-native';
import { computeDay, type PrayerKey } from './prayer';
import { useSettings } from './settings';

/** Rappels de prière : API Notification du navigateur (PWA). Les notifications natives iOS viendront plus tard. */
export const remindersSupported = () => Platform.OS === 'web' && typeof window !== 'undefined' && 'Notification' in window;

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

const FARD: PrayerKey[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

/** Programme une notification à l’heure de la prochaine prière tant que l’app (PWA) est ouverte. */
export function usePrayerReminders() {
  const { s, t: tr, ready } = useSettings();
  useEffect(() => {
    if (!ready || !s.reminders || !remindersSupported() || Notification.permission !== 'granted') return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      const now = new Date();
      const list = [...computeDay(now, s.place, s.method, s.madhab), ...computeDay(new Date(now.getTime() + 86400000), s.place, s.method, s.madhab)];
      const next = list.find((p) => FARD.includes(p.key) && p.time.getTime() > now.getTime() + 1000);
      if (!next) return;
      const delay = Math.min(next.time.getTime() - now.getTime(), 2 ** 31 - 1);
      timer = setTimeout(() => {
        try {
          new Notification(`${tr[next.key]} · ${s.place.label}`, { body: 'C’est l’heure de la prière.', tag: `zikru-${next.key}` });
        } catch {}
        schedule();
      }, delay);
    };
    schedule();
    return () => clearTimeout(timer);
  }, [ready, s.reminders, s.place, s.method, s.madhab, tr]);
}
