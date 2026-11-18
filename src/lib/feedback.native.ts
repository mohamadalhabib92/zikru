/** Retour sensoriel natif : expo-haptics + sons courts (assets/audio/click.wav, success.wav, générés). */
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import { Platform } from 'react-native';
import { applyUiClickMode } from '@/components/PlayerBar';
import { isIosAppOnMac } from '@/lib/mac';

type HapticModule = typeof import('expo-haptics');
// Même règle que tapHaptic : iPhone charge expo-haptics ; Apple TV non (pas de Taptic Engine, module non lié).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Haptics: HapticModule | null = Platform.isTV ? null : (require('expo-haptics') as HapticModule);

let players: { tap: AudioPlayer; cycle: AudioPlayer } | null = null;
function getPlayers() {
  if (players) return players;
  try {
    applyUiClickMode();
    players = { tap: createAudioPlayer(require('../../assets/audio/click.wav')), cycle: createAudioPlayer(require('../../assets/audio/success.wav')) };
  } catch {
    players = null;
  }
  return players;
}
export function feedback(kind: 'tap' | 'cycle', opts: { sound: boolean; haptics: boolean }) {
  if (opts.haptics && Haptics && !isIosAppOnMac()) void (kind === 'cycle' ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success) : Haptics.selectionAsync()).catch(() => {});
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
