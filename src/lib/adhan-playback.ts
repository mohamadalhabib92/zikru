/**
 * Lecteur unique pour l’adhan (aperçu et appel à l’heure).
 * Une instance pour toute la session : le mini-lecteur et la notification
 * partagent la même lecture, sans se superposer.
 */
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer, type AudioStatus } from 'expo-audio';
import type { AdhanSource } from './adhan-voices';

export type AdhanSnap = {
  playing: boolean;
  currentTime: number;
  duration: number;
  loaded: boolean;
  failed: boolean;
};

export type AdhanMeta = { title: string; artist: string };

const EMPTY: AdhanSnap = { playing: false, currentTime: 0, duration: 0, loaded: false, failed: false };
let snap: AdhanSnap = EMPTY;
let player: AudioPlayer | null = null;
let sourceKey = '';
const listeners = new Set<(s: AdhanSnap) => void>();

function emit() {
  for (const fn of listeners) fn(snap);
}

function keyOf(source: AdhanSource): string {
  return typeof source === 'number' ? `asset:${source}` : source.uri;
}

function applyStatus(status: AudioStatus) {
  snap = {
    playing: !!status.playing,
    currentTime: status.currentTime ?? 0,
    duration: status.duration ?? 0,
    loaded: !!status.isLoaded,
    failed: !status.isLoaded && status.playbackState === 'failed',
  };
  if (status.didJustFinish) {
    try {
      player?.setActiveForLockScreen(false);
    } catch {
      // le verrou n’existe pas sur le web
    }
  }
  emit();
}

function ensure(source: AdhanSource): AudioPlayer {
  const key = keyOf(source);
  if (!player) {
    player = createAudioPlayer(source, { updateInterval: 300 });
    sourceKey = key;
    player.addListener('playbackStatusUpdate', applyStatus);
    return player;
  }
  if (key !== sourceKey || snap.failed) {
    player.replace(source);
    sourceKey = key;
    snap = { ...snap, failed: false, loaded: false };
  }
  return player;
}

export function subscribeAdhan(fn: (s: AdhanSnap) => void): () => void {
  listeners.add(fn);
  fn(snap);
  return () => listeners.delete(fn);
}

export function getAdhanSnap(): AdhanSnap {
  return snap;
}

export function pauseAdhan() {
  try {
    player?.pause();
    player?.setActiveForLockScreen(false);
  } catch {
    // jamais de crash si le lecteur n’est pas prêt
  }
}

/** Joue une voix déjà publiée ou un fichier local. `restart` reprend au début. */
export async function playAdhanSource(source: AdhanSource, meta?: AdhanMeta, opts?: { restart?: boolean }): Promise<void> {
  await setAudioModeAsync({
    playsInSilentMode: true,
    interruptionMode: 'doNotMix',
    shouldPlayInBackground: true,
  });
  const p = ensure(source);
  if (opts?.restart) {
    try {
      await p.seekTo(0);
    } catch {
      // le fichier peut ne pas être chargé : play() réessaie
    }
  }
  p.play();
  try {
    p.setActiveForLockScreen(true, { title: meta?.title || 'Adhan', artist: meta?.artist || '' });
  } catch {
    // pas d’écran verrouillé dans le navigateur
  }
}
