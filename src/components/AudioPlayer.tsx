import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { View } from 'react-native';
import { Text } from '@/ui/Text';
import { BILAL_SOURCE } from '@/lib/audio';
import { useSettings } from '@/lib/settings';
import { Card, IconButton, Ionicons, Muted, Row } from '@/ui/kit';
import { theme as t } from '@/ui/theme';

/** Mini-lecteur (style « Spotify ») : play/pause fiable, fichier manquant géré sans crash. */
export function AudioPlayer() {
  const { t: tr } = useSettings();
  if (!BILAL_SOURCE) {
    return (
      <Card>
        <Row gap={12}>
          <Ionicons name="volume-mute-outline" size={22} color={t.muted} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: t.text, fontWeight: '700' }}>{tr.audio}</Text>
            <Muted>{tr.audio_missing}</Muted>
          </View>
        </Row>
      </Card>
    );
  }
  return <Player />;
}

function Player() {
  const { t: tr } = useSettings();
  const player = useAudioPlayer(BILAL_SOURCE);
  const st = useAudioPlayerStatus(player);
  const failed = !st.isLoaded && st.playbackState === 'failed';
  const toggle = () => {
    try {
      if (st.playing) player.pause();
      else {
        if (st.duration > 0 && st.currentTime >= st.duration - 0.2) player.seekTo(0);
        player.play();
      }
    } catch {
      // fallback silencieux : jamais de crash
    }
  };
  const pct = st.duration > 0 ? Math.min(1, st.currentTime / st.duration) : 0;
  return (
    <Card>
      <Row gap={12}>
        <IconButton icon={st.playing ? 'pause-circle' : 'play-circle'} size={36} color={t.primary} label={st.playing ? tr.pause : tr.play} onPress={toggle} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: t.text, fontWeight: '700' }}>{tr.audio}</Text>
          {failed ? <Muted>{tr.audio_missing}</Muted> : null}
          <View style={{ height: 4, backgroundColor: t.surfaceAlt, borderRadius: 2, marginTop: 8 }}>
            <View style={{ width: `${pct * 100}%`, height: 4, backgroundColor: t.primary, borderRadius: 2 }} />
          </View>
        </View>
      </Row>
    </Card>
  );
}
