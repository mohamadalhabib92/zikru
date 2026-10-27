/** Retour sensoriel natif : expo-haptics + sons courts (assets/audio/click.wav, success.wav, générés). */
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';

let players: { tap: AudioPlayer; cycle: AudioPlayer } | null = null;
function getPlayers() {
  if (players) return players;
  try {
    void setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' }).catch(() => {});
    players = { tap: createAudioPlayer(require('../../assets/audio/click.wav')), cycle: createAudioPlayer(require('../../assets/audio/success.wav')) };
  } catch {
    players = null;
  }
  return players;
}
export function feedback(kind: 'tap' | 'cycle', opts: { sound: boolean; haptics: boolean }) {
  if (opts.haptics) void (kind === 'cycle' ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success) : Haptics.selectionAsync()).catch(() => {});
  if (opts.sound) {
    const p = getPlayers()?.[kind];
    if (p) {
      try {
        p.seekTo(0);
        p.play();
      } catch {
        /* ignoré */
      }
    }
  }
}
