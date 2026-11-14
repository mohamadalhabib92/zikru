import { useEffect, useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { Text } from '@/ui/Text';
import { getAdhanSnap, pauseAdhan, playAdhanSource, subscribeAdhan, type AdhanSnap } from '@/lib/adhan-playback';
import { adhanVoices, selectedAdhanVoice, type AdhanVoice } from '@/lib/audio';
import { useSettings } from '@/lib/settings';
import { L } from '@/lib/l10n';
import { Card, H2, IconButton, Ionicons, ListItem, Muted, Row, Spacer } from '@/ui/kit';
import { theme as t } from '@/ui/theme';

function useAdhanSnap(): AdhanSnap {
  const [st, setSt] = useState(getAdhanSnap);
  useEffect(() => subscribeAdhan(setSt), []);
  return st;
}

function Attribution({ voice }: { voice: AdhanVoice }) {
  if (!voice.reciter && !voice.license && !voice.pageUrl) return null;
  return (
    <View style={{ marginTop: 8 }}>
      {voice.style ? <Muted>{L('Style : {s}', { s: L(voice.style) })}</Muted> : null}
      {voice.reciter ? <Muted>{L('Auteur : {name}', { name: voice.reciter })}</Muted> : null}
      {voice.license ? <Muted>{L('Licence : {license}', { license: voice.license })}</Muted> : null}
      {voice.pageUrl ? (
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={L('Page de la source')}
          onPress={() => void Linking.openURL(voice.pageUrl!)}
          style={{ minHeight: 44, justifyContent: 'center' }}
        >
          <Text style={{ color: t.primary }}>{voice.pageUrl}</Text>
        </Pressable>
      ) : null}
      {voice.licenseUrl ? (
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={L('Licence : {license}', { license: voice.license ?? '' })}
          onPress={() => void Linking.openURL(voice.licenseUrl!)}
          style={{ minHeight: 44, justifyContent: 'center' }}
        >
          <Text style={{ color: t.primary }}>{voice.licenseUrl}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Liste des voix publiées (et locales, si un fichier a été branché). Le choix est gardé dans les réglages. */
export function AdhanVoicePicker() {
  const { s, set } = useSettings();
  const voices = adhanVoices();
  const voice = selectedAdhanVoice(s.adhanVoice);
  return (
    <View>
      <H2>Voix de l’adhan</H2>
      <Muted>{L('Certains enregistrements sont dans l’application, les autres sont lus en ligne. Le choix reste sur cet appareil.')}</Muted>
      <Spacer h={8} />
      <Card>
        {voices.map((v) => (
          <ListItem
            key={v.id}
            title={v.title}
            subtitle={v.origin}
            icon={voice.id === v.id ? 'radio-button-on' : 'radio-button-off'}
            onPress={() => {
              if (v.id !== voice.id) pauseAdhan();
              set({ adhanVoice: v.id });
            }}
          />
        ))}
      </Card>
      <Attribution voice={voice} />
    </View>
  );
}

/** Mini-lecteur de la voix choisie. Fichier manquant : message, pas de crash. */
export function AudioPlayer() {
  return (
    <View>
      <AdhanVoicePicker />
      <Spacer />
      <PlayerCard />
    </View>
  );
}

function PlayerCard() {
  const { s, t: tr } = useSettings();
  const voice = selectedAdhanVoice(s.adhanVoice);
  const st = useAdhanSnap();
  if (!voice.source) {
    return (
      <Card>
        <Row gap={12}>
          <Ionicons name="volume-mute-outline" size={22} color={t.muted} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: t.text, fontWeight: '700' }}>{voice.title}</Text>
            <Muted>Fichier manquant pour cette voix : lecture désactivée (aucun crash).</Muted>
          </View>
        </Row>
      </Card>
    );
  }
  const source = voice.source;
  const toggle = () => {
    try {
      if (st.playing) {
        pauseAdhan();
        return;
      }
      const atEnd = st.duration > 0 && st.currentTime >= st.duration - 0.2;
      void playAdhanSource(source, { title: voice.title, artist: voice.reciter }, { restart: atEnd || st.failed }).catch(() => {});
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
          <Text style={{ color: t.text, fontWeight: '700' }}>{voice.title}</Text>
          {st.failed ? <Muted>Fichier manquant pour cette voix : lecture désactivée (aucun crash).</Muted> : null}
          <View style={{ height: 4, backgroundColor: t.surfaceAlt, borderRadius: 2, marginTop: 8 }}>
            <View style={{ width: `${pct * 100}%`, height: 4, backgroundColor: t.primary, borderRadius: 2 }} />
          </View>
        </View>
      </Row>
    </Card>
  );
}
