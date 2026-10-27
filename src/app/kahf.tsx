import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useEffect, useMemo, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { enableBackgroundAudio, NowPlaying, PlayerBar } from '@/components/PlayerBar';
import { fridayKey, getKahfText, isKahfTime, KAHF_AUDIO, type Ayah } from '@/lib/kahf';
import { computeDay } from '@/lib/prayer';
import { useSettings } from '@/lib/settings';
import { usePersistentState } from '@/lib/storage';
import { Badge, Button, Card, Eyebrow, H1, H2, Muted, Notice, Screen, Segmented, Spacer, Toggle } from '@/ui/kit';
import { theme as t } from '@/ui/theme';

export default function Kahf() {
  const { s, t: tr } = useSettings();
  const player = useAudioPlayer({ uri: KAHF_AUDIO[0] }, { updateInterval: 500 });
  const st = useAudioPlayerStatus(player);
  const [src, setSrc] = useState(0);
  const [ayahs, setAyahs] = useState<Ayah[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [lang, setLang] = useState<'fr' | 'en' | 'none'>('fr');
  const [limit, setLimit] = useState(20);
  const [reminder, setReminder] = usePersistentState('kahf-reminder', true);
  const [readWeeks, setReadWeeks] = usePersistentState<string[]>('kahf-read', []);
  const now = new Date();
  const maghrib = useMemo(() => computeDay(now, s.place, s.method, s.madhab).find((x) => x.key === 'maghrib')?.time, [s.place, s.method, s.madhab]); // eslint-disable-line react-hooks/exhaustive-deps
  const week = fridayKey(now);
  const done = readWeeks.includes(week);

  useEffect(() => {
    void enableBackgroundAudio();
  }, []);
  // Bascule automatique vers la source de secours si le premier serveur échoue.
  useEffect(() => {
    if (st.playbackState === 'failed' && src < KAHF_AUDIO.length - 1) {
      const n = src + 1;
      setSrc(n);
      try {
        player.replace({ uri: KAHF_AUDIO[n] });
      } catch {}
    }
  }, [st.playbackState, src, player]);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    try {
      if (st.playing) player.setActiveForLockScreen(true, { title: 'Sourate al-Kahf', artist: 'Mishary Rashid Alafasy' });
    } catch {}
  }, [st.playing, player]);

  const load = (force = false) => {
    setErr(null);
    getKahfText(force)
      .then((r) => setAyahs(r.ayahs))
      .catch(() => setErr('Texte indisponible : vérifiez la connexion internet (il sera ensuite gardé hors ligne).'));
  };
  useEffect(() => load(), []);

  return (
    <Screen>
      <Eyebrow>Sourate 18 · 110 versets</Eyebrow>
      <H1>{tr.kahf}</H1>
      <Text style={{ color: t.primary, fontSize: 28, marginTop: 4 }}>سُورَةُ الكَهْف</Text>
      <Spacer />
      {reminder && isKahfTime(now, maghrib) && !done ? <Notice tone="success" icon="notifications-outline" title="C’est le moment de lire al-Kahf" text="Du coucher du soleil jeudi jusqu’au coucher du soleil vendredi." /> : null}
      <Card>
        <NowPlaying title="Sourate al-Kahf" sub="Récitation : Mishary Rashid Alafasy (streaming)" />
        <PlayerBar player={player} st={st} />
        {st.playbackState === 'failed' && src === KAHF_AUDIO.length - 1 ? <Muted style={{ marginTop: 6, color: t.danger }}>Lecture impossible : connexion requise (audio en streaming, non stocké dans l’app).</Muted> : null}
        <Muted style={{ fontSize: 11, marginTop: 8 }}>Audio diffusé depuis {src === 0 ? 'mp3quran.net' : 'cdn.islamic.network'} — rien n’est téléchargé ni inclus dans l’app.</Muted>
      </Card>
      <Card>
        <Toggle label="Rappel du vendredi" hint="Affiche un rappel dans l’app (accueil et ici) de jeudi soir à vendredi soir." value={reminder} onChange={setReminder} />
        <Button
          title={done ? 'Lue cette semaine ✓' : 'Marquer comme lue cette semaine'}
          variant={done ? 'secondary' : 'primary'}
          icon="checkmark-done-outline"
          onPress={() => setReadWeeks(done ? readWeeks.filter((w) => w !== week) : [...readWeeks.slice(-51), week])}
        />
      </Card>
      <Card>
        <H2>Mérites (références)</H2>
        <Text style={{ color: t.text, marginTop: 6, lineHeight: 22 }}>« Celui qui mémorise dix versets du début de la sourate al-Kahf sera protégé du Dajjal. »</Text>
        <Text style={{ color: t.primary, fontWeight: '700', marginTop: 4 }}>Sahih Muslim 809</Text>
        <Text style={{ color: t.text, marginTop: 10, lineHeight: 22 }}>« Celui qui lit la sourate al-Kahf le vendredi, une lumière l’éclairera entre les deux vendredis. »</Text>
        <Text style={{ color: t.primary, fontWeight: '700', marginTop: 4 }}>Rapporté par al-Hakim et al-Bayhaqi ; jugé authentique par al-Albani</Text>
      </Card>
      <Spacer />
      <H2>Texte</H2>
      <Segmented options={[{ label: 'Français', value: 'fr' }, { label: 'English', value: 'en' }, { label: 'Arabe seul', value: 'none' }]} value={lang} onChange={setLang} />
      {err ? <Notice tone="warning" title={err} /> : null}
      {err ? <Button title="Réessayer" variant="secondary" icon="refresh" onPress={() => load(true)} /> : null}
      {!ayahs && !err ? <Muted>Chargement du texte…</Muted> : null}
      {ayahs ? (
        <View>
          {ayahs.slice(0, limit).map((a) => (
            <Card key={a.n}>
              <Badge label={String(a.n)} tone="neutral" />
              <Text style={{ color: t.text, fontSize: 22, lineHeight: 42, textAlign: 'right', writingDirection: 'rtl', marginTop: 6 }}>{a.ar}</Text>
              {lang !== 'none' ? <Text style={{ color: t.muted, marginTop: 6, lineHeight: 21 }}>{lang === 'fr' ? a.fr : a.en}</Text> : null}
            </Card>
          ))}
          {limit < ayahs.length ? <Button title={`Afficher la suite (${ayahs.length - limit} versets)`} variant="secondary" onPress={() => setLimit(ayahs.length)} /> : null}
          <Muted style={{ fontSize: 11, marginTop: 8 }}>Texte : api.alquran.cloud (Uthmani ; trad. Hamidullah / Sahih International), mis en cache sur l’appareil.</Muted>
        </View>
      ) : null}
    </Screen>
  );
}
