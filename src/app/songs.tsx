import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useEffect, useRef, useState } from 'react';
import { Alert, Platform, Pressable, View } from 'react-native';
import { Text } from '@/ui/Text';
import { enableBackgroundAudio, NowPlaying, PlayerBar } from '@/components/PlayerBar';
import { useSettings } from '@/lib/settings';
import { importFiles, removeFile, resolveUri } from '@/lib/songs';
import { titleFromName, validUrl, type Track } from '@/lib/songs-types';
import { uid, usePersistentState } from '@/lib/storage';
import { Button, Card, Empty, Eyebrow, Field, H1, H2, IconButton, Ionicons, Muted, Notice, Row, Screen, Spacer } from '@/ui/kit';
import { theme as t } from '@/ui/theme';
import { L } from '@/lib/l10n';

export default function Songs() {
  const { t: tr } = useSettings();
  const [tracks, setTracks] = usePersistentState<Track[]>('songs', []);
  const [cur, setCur] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showUrl, setShowUrl] = useState(false);
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const player = useAudioPlayer(null, { updateInterval: 500 });
  const st = useAudioPlayerStatus(player);
  const autoNext = useRef(false);

  useEffect(() => {
    void enableBackgroundAudio();
  }, []);

  const play = async (i: number) => {
    const tk = tracks[i];
    if (!tk) return;
    setErr(null);
    const uri = await resolveUri(tk);
    if (!uri) {
      setErr('Fichier introuvable sur cet appareil. Réimportez-le.');
      return;
    }
    try {
      player.replace({ uri });
      setCur(i);
      autoNext.current = true;
      player.play();
      if (Platform.OS !== 'web') player.setActiveForLockScreen(true, { title: tk.title, artist: L('Zikru · Chants soufis') });
    } catch {
      setErr('Lecture impossible pour ce fichier.');
    }
  };
  // Enchaîne la piste suivante à la fin.
  useEffect(() => {
    if (st.didJustFinish && autoNext.current && cur != null && cur < tracks.length - 1) void play(cur + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st.didJustFinish]);

  const add = async () => {
    setBusy(true);
    try {
      const added = await importFiles();
      if (added.length) setTracks([...tracks, ...added]);
    } catch {
      setErr('Import impossible.');
    }
    setBusy(false);
  };
  const addUrl = () => {
    if (!validUrl(url)) {
      setErr('URL invalide (http/https).');
      return;
    }
    const u = url.trim();
    setTracks([...tracks, { id: uid('song-'), kind: 'url', uri: u, title: title.trim() || titleFromName(decodeURIComponent(u.split('/').pop() ?? '')), addedAt: Date.now() }]);
    setUrl('');
    setTitle('');
    setShowUrl(false);
    setErr(null);
  };
  const remove = (i: number) => {
    const go = async () => {
      const tk = tracks[i];
      if (cur === i) {
        try {
          player.pause();
        } catch {}
        setCur(null);
      } else if (cur != null && cur > i) setCur(cur - 1);
      await removeFile(tk);
      setTracks(tracks.filter((_, j) => j !== i));
    };
    if (Platform.OS === 'web') void go();
    else Alert.alert(L('Retirer cette piste ?'), tracks[i].title, [{ text: L('Annuler'), style: 'cancel' }, { text: L('Retirer'), style: 'destructive', onPress: () => void go() }]);
  };

  const now = cur != null ? tracks[cur] : null;
  return (
    <Screen>
      <Eyebrow>Qasa’id · madih</Eyebrow>
      <H1>{tr.songs}</H1>
      <Muted>Votre bibliothèque personnelle de chants, stockée uniquement sur cet appareil.</Muted>
      <Spacer />
      {now ? (
        <Card>
          <NowPlaying title={now.title} sub={now.kind === 'url' ? 'Lien' : 'Fichier local'} />
          <PlayerBar player={player} st={st} onPrev={cur! > 0 ? () => void play(cur! - 1) : undefined} onNext={cur! < tracks.length - 1 ? () => void play(cur! + 1) : undefined} />
        </Card>
      ) : null}
      {err ? <Notice tone="warning" title={err} /> : null}
      <Row gap={10}>
        <Button title="Importer des fichiers" icon="folder-open-outline" loading={busy} onPress={add} style={{ flex: 1 }} />
        <Button title="Ajouter un lien" icon="link-outline" variant="secondary" onPress={() => setShowUrl(!showUrl)} style={{ flex: 1 }} />
      </Row>
      {showUrl ? (
        <Card style={{ marginTop: 12 }}>
          <Field label="URL du fichier audio" placeholder={L("https://…/chant.mp3")} autoCapitalize="none" autoCorrect={false} keyboardType="url" value={url} onChangeText={setUrl} />
          <Field label="Titre (facultatif)" value={title} onChangeText={setTitle} />
          <Button title="Ajouter" icon="add" onPress={addUrl} />
        </Card>
      ) : null}
      <Spacer />
      {tracks.length === 0 ? (
        <Empty
          icon="musical-notes-outline"
          title="Aucun chant pour l’instant"
          text={
            Platform.OS === 'web'
              ? 'Ajoutez vos chants : « Importer des fichiers » (MP3, M4A… depuis votre ordinateur ou téléphone) ou « Ajouter un lien » vers un fichier audio. Ils restent dans ce navigateur.'
              : 'Ajoutez vos chants : « Importer des fichiers » ouvre l’app Fichiers (iCloud Drive, AirDrop, téléchargements), ou « Ajouter un lien » vers un fichier audio. La lecture continue écran verrouillé.'
          }
        />
      ) : (
        <View>
          <H2>
            Ma liste · {tracks.length} piste{tracks.length > 1 ? 's' : ''}
          </H2>
          {tracks.map((tk, i) => (
            <Pressable key={tk.id} accessibilityRole="button" accessibilityLabel={L('Lire {x}', { x: tk.title })} onPress={() => void play(i)}>
              <Card style={cur === i ? { borderColor: t.primary } : undefined}>
                <Row gap={12}>
                  <Ionicons name={cur === i && st.playing ? 'volume-high' : tk.kind === 'url' ? 'link-outline' : 'musical-note'} size={22} color={cur === i ? t.primary : t.muted} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: t.text, fontWeight: '600' }} numberOfLines={1}>
                      {tk.title}
                    </Text>
                    <Muted style={{ fontSize: 12 }}>{tk.kind === 'url' ? 'Lien' : 'Fichier local'}</Muted>
                  </View>
                  <IconButton icon="trash-outline" color={t.muted} label={L('Retirer {x}', { x: tk.title })} onPress={() => remove(i)} />
                </Row>
              </Card>
            </Pressable>
          ))}
        </View>
      )}
      <Spacer />
      <Muted style={{ fontSize: 12 }}>Zikru ne fournit aucun enregistrement : ajoutez uniquement des fichiers que vous avez le droit d’écouter. Rien n’est envoyé sur internet.</Muted>
    </Screen>
  );
}
