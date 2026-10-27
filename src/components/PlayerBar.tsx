import { setAudioModeAsync, type AudioPlayer, type AudioStatus } from 'expo-audio';
import { useState } from 'react';
import { Platform, Pressable, Text, View, type LayoutChangeEvent } from 'react-native';
import { IconButton, Muted, Row } from '@/ui/kit';
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
    <View>
      <Pressable
        accessibilityRole="adjustable"
        accessibilityLabel={`Position ${fmt(st.currentTime)} sur ${fmt(st.duration)}`}
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
        <Muted>{st.isBuffering ? 'Mise en mémoire…' : fmt(st.duration)}</Muted>
      </Row>
      <Row style={{ justifyContent: 'center' }} gap={18}>
        {onPrev ? <IconButton icon="play-skip-back" size={28} color={t.text} label="Précédent" onPress={onPrev} /> : null}
        <IconButton icon="play-back" size={28} color={t.text} label="Reculer de 15 secondes" onPress={safe(() => player.seekTo(Math.max(0, st.currentTime - 15)))} />
        <IconButton
          icon={st.playing ? 'pause-circle' : 'play-circle'}
          size={64}
          color={t.primary}
          label={st.playing ? 'Pause' : 'Lecture'}
          onPress={safe(() => {
            if (st.playing) player.pause();
            else {
              void enableBackgroundAudio();
              if (st.duration > 0 && st.currentTime >= st.duration - 0.3) player.seekTo(0);
              player.play();
            }
          })}
        />
        <IconButton icon="play-forward" size={28} color={t.text} label="Avancer de 15 secondes" onPress={safe(() => player.seekTo(Math.min(st.duration || 0, st.currentTime + 15)))} />
        {onNext ? <IconButton icon="play-skip-forward" size={28} color={t.text} label="Suivant" onPress={onNext} /> : null}
      </Row>
    </View>
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
