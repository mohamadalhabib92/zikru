import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { useEffect, useRef, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { assembleAdhanVoices, type AdhanVoice } from '@/lib/phone';
import { useTv } from '@/lib/settings';
import { Focusable, Muted, Screen, Title, ink } from '@/ui/focus';

function published(): AdhanVoice[] {
  return assembleAdhanVoices({}, null).filter((v) => v.kind === 'published' && v.source && typeof v.source !== 'number');
}

export default function Adhan() {
  const { t } = useTv();
  const voices = published();
  const [current, setCurrent] = useState(voices[0]?.id ?? '');
  const [playing, setPlaying] = useState(false);
  const player = useRef<AudioPlayer | null>(null);
  const voice = voices.find((v) => v.id === current) ?? voices[0];

  useEffect(() => {
    return () => {
      try {
        player.current?.pause();
        player.current?.remove();
      } catch {
        // le lecteur peut déjà être parti
      }
    };
  }, []);

  async function toggle() {
    if (!voice?.source || typeof voice.source === 'number') return;
    try {
      await setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'doNotMix', shouldPlayInBackground: false });
    } catch {
      // le mode audio de la TV peut refuser une option : on tente quand même la lecture
    }
    if (!player.current) player.current = createAudioPlayer(voice.source);
    else player.current.replace(voice.source);
    if (playing) {
      player.current.pause();
      setPlaying(false);
    } else {
      player.current.play();
      setPlaying(true);
    }
  }

  return (
    <Screen>
      <Title>{t.voices}</Title>
      <Muted>{t.voicesHint}</Muted>
      <View style={{ marginTop: 18, gap: 10 }}>
        {voices.map((v) => (
          <Focusable
            key={v.id}
            onPress={() => {
              setCurrent(v.id);
              setPlaying(false);
              try {
                player.current?.pause();
              } catch {
                // rien à couper
              }
            }}
            style={[styles.row, current === v.id && styles.on]}
          >
            <Text style={styles.name}>{v.title}</Text>
            <Text style={styles.origin}>{v.origin}</Text>
          </Focusable>
        ))}
      </View>
      {voice ? (
        <View style={styles.card}>
          <Text style={styles.name}>{voice.title}</Text>
          {voice.reciter ? (
            <Muted>
              {t.author} : {voice.reciter}
            </Muted>
          ) : null}
          {voice.license ? (
            <Muted>
              {t.license} : {voice.license}
            </Muted>
          ) : null}
          <Muted>{voice.origin}</Muted>
          {voice.pageUrl ? (
            <Focusable onPress={() => void Linking.openURL(voice.pageUrl!)} style={styles.link}>
              <Text style={styles.linkText}>
                {t.page} : {voice.pageUrl}
              </Text>
            </Focusable>
          ) : null}
          {voice.licenseUrl ? (
            <Focusable onPress={() => void Linking.openURL(voice.licenseUrl!)} style={styles.link}>
              <Text style={styles.linkText}>{voice.licenseUrl}</Text>
            </Focusable>
          ) : null}
          <Focusable onPress={() => void toggle()} style={styles.play}>
            <Text style={styles.playText}>{playing && current === voice.id ? t.pause : t.play}</Text>
          </Focusable>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { backgroundColor: ink.card, padding: 16, borderRadius: 14 },
  on: { borderColor: ink.gold },
  name: { color: ink.text, fontSize: 22, fontWeight: '700' },
  origin: { color: ink.muted, fontSize: 16, marginTop: 4 },
  card: { marginTop: 22, padding: 18, backgroundColor: '#10241E', borderRadius: 16, gap: 8 },
  link: { paddingVertical: 6 },
  linkText: { color: ink.gold, fontSize: 16 },
  play: { marginTop: 8, backgroundColor: ink.green, paddingVertical: 14, paddingHorizontal: 18, alignSelf: 'flex-start' },
  playText: { color: ink.text, fontSize: 22, fontWeight: '700' },
});
