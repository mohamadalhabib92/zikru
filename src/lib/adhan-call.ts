/**
 * Déclenche la voix d’adhan choisie quand une notification de prière arrive
 * ou quand l’utilisateur l’ouvre. Ne fait rien pour les autres rappels.
 */
import { useEffect } from 'react';
import { playAdhanSource, type AdhanMeta } from './adhan-playback';
import { payloadPlaysAdhan, type AdhanSource } from './adhan-voices';
import { selectedAdhanVoice } from './audio';
import { useSettings } from './settings';

type Bound = { source: AdhanSource; meta: AdhanMeta } | null;
let current: () => Bound = () => null;
const recent = new Map<string, number>();

export function setAdhanPlaybackGetter(fn: () => Bound) {
  current = fn;
}

/** Branche la voix enregistrée. À appeler depuis le hook de rappels. */
export function useBindAdhanPlayback() {
  const { s } = useSettings();
  useEffect(() => {
    setAdhanPlaybackGetter(() => {
      if (!s.reminders || s.notif.adhan === false) return null;
      const v = selectedAdhanVoice(s.adhanVoice);
      if (!v.source) return null;
      return { source: v.source, meta: { title: v.title, artist: v.reciter || v.title } };
    });
  }, [s.reminders, s.notif.adhan, s.adhanVoice]);
}

/** Une même notification ne lance pas l’adhan deux fois de suite (réception + ouverture). */
export async function maybePlayScheduledAdhan(id: string, data: unknown): Promise<void> {
  if (!payloadPlaysAdhan(data)) return;
  const now = Date.now();
  const prev = id ? recent.get(id) : undefined;
  if (prev != null && now - prev < 20_000) return;
  if (id) recent.set(id, now);
  const next = current();
  if (!next) return;
  try {
    await playAdhanSource(next.source, next.meta, { restart: true });
  } catch {
    // fichier ou réseau manquant : la notification reste, l’app ne plante pas
  }
}
