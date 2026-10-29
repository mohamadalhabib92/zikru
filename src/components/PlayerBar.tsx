import { setAudioModeAsync, type AudioPlayer, type AudioStatus } from 'expo-audio';
import { useState } from 'react';
import { Platform, Pressable, View, type LayoutChangeEvent } from 'react-native';
import { Text } from '@/ui/Text';
import { IconButton, Ionicons, Muted, Row } from '@/ui/kit';
import { L } from '@/lib/l10n';
import { theme as t } from '@/ui/theme';

let configured = false;
/** Lecture en arrière-plan / écran verrouillé (iOS : UIBackgroundModes audio via le plugin expo-audio). */
export async function enableBackgroundAudio() {
  if (configured || Platform.OS === 'web') return;
  configured = true;
  try {
    await setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true, interruptionMode: 'doNotMix' });
  } catch {
    configured = false;
  }
}

export function fmt(sec: number) {
  if (!isFinite(sec) || sec < 0) return '0:00';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

/** Barre de lecture : play/pause, ±15 s, barre de progression cliquable. */
export function PlayerBar({ player, st, onPrev, onNext }: { player: AudioPlayer; st: AudioStatus; onPrev?: () => void; onNext?: () => void }) {
  const [w, setW] = useState(1);
  const pct = st.duration > 0 ? Math.min(1, st.currentTime / st.duration) : 0;
  const safe = (fn: () => void) => () => {
    try {
      fn();
    } catch {}
  };
  return (
    // Commandes de lecture non inversées en RTL (convention des lecteurs média ; la barre de progression reste cohérente avec seekTo).
    <View style={{ direction: 'ltr' }}>
      <Pressable
        accessibilityRole="adjustable"
        accessibilityLabel={L('Position {a} sur {b}', { a: fmt(st.currentTime), b: fmt(st.duration) })}
        onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width || 1)}
        onPress={(e) => st.duration > 0 && safe(() => player.seekTo((e.nativeEvent.locationX / w) * st.duration))()}
        style={{ paddingVertical: 10 }}
      >
        <View style={{ height: 6, backgroundColor: t.surfaceAlt, borderRadius: 3 }}>
          <View style={{ width: `${pct * 100}%`, height: 6, backgroundColor: t.primary, borderRadius: 3 }} />
        </View>
      </Pressable>
      <Row style={{ justifyContent: 'space-between' }}>
        <Muted>{fmt(st.currentTime)}</Muted>
        <Muted>{st.isBuffering ? L('Mise en mémoire…') : fmt(st.duration)}</Muted>
      </Row>
      <Row style={{ justifyContent: 'center', alignItems: 'center', flexWrap: 'nowrap' }} gap={onPrev || onNext ? 6 : 16}>
        {onPrev ? <IconButton icon="play-skip-back" size={28} color={t.text} label={L('Précédent')} onPress={onPrev} /> : null}
        <IconButton icon="play-back" size={28} color={t.text} label={L('Reculer de 15 secondes')} onPress={safe(() => player.seekTo(Math.max(0, st.currentTime - 15)))} />
        <PlayPauseButton
          playing={st.playing}
          onPress={safe(() => {
            if (st.playing) player.pause();
            else {
              void enableBackgroundAudio();
              if (st.duration > 0 && st.currentTime >= st.duration - 0.3) player.seekTo(0);
              player.play();
            }
          })}
        />
        <IconButton icon="play-forward" size={28} color={t.text} label={L('Avancer de 15 secondes')} onPress={safe(() => player.seekTo(Math.min(st.duration || 0, st.currentTime + 15)))} />
        {onNext ? <IconButton icon="play-skip-forward" size={28} color={t.text} label={L('Suivant')} onPress={onNext} /> : null}
      </Row>
    </View>
  );
}

/**
 * Bouton rond Lecture/Pause : cercle dessiné par une View (taille fixe, jamais rogné), icône pleine au centre.
 * Remplace l’ancien glyphe « play-circle » de 64 pt dans une boîte de 44 pt, que iOS coupait à moitié
 * (police d’icônes + Dynamic Type). L’icône ne suit pas la taille du texte (allowFontScaling=false).
 */
export const PLAY_BUTTON_SIZE = 64;
export function PlayPauseButton({ playing, onPress, size = PLAY_BUTTON_SIZE, color = t.primary }: { playing: boolean; onPress: () => void; size?: number; color?: string }) {
  const icon = Math.round(size * 0.46);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={playing ? L('Pause') : L('Lecture')}
      accessibilityState={{ selected: playing }}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => ({ width: size, height: size, minWidth: size, flexShrink: 0, borderRadius: size / 2, backgroundColor: color, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.96 : 1 }] })}
    >
      {/* Le triangle « play » est décalé de ~6 % vers la droite pour paraître centré (centre optique). */}
      <Ionicons name={playing ? 'pause' : 'play'} size={icon} color="#fff" allowFontScaling={false} style={{ marginLeft: playing ? 0 : Math.round(size * 0.06) }} />
    </Pressable>
  );
}

export function NowPlaying({ title, sub }: { title: string; sub?: string }) {
  return (
    <View style={{ alignItems: 'center', marginBottom: 6 }}>
      <Text style={{ color: t.text, fontWeight: '800', fontSize: 18, textAlign: 'center' }} numberOfLines={2}>
        {title}
      </Text>
      {sub ? <Muted>{sub}</Muted> : null}
    </View>
  );
}
