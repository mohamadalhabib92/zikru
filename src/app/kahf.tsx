import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import { Text } from '@/ui/Text';
import { enableBackgroundAudio, NowPlaying, PlayerBar } from '@/components/PlayerBar';
import { fridayKey, getKahfText, isKahfTime, KAHF_AUDIO, type Ayah } from '@/lib/kahf';
import { onQuranPreempted, quranMount, quranOwnsPlayback, quranRequestPlay, quranUnmount, quranUserPause, quranUserStop } from '@/lib/quran-playback';
import { readerPrefs } from '@/lib/quran-store';
import { useShared } from '@/lib/shared-state';
import { computeDay } from '@/lib/prayer';
import { useSettings } from '@/lib/settings';
import { usePersistentState } from '@/lib/storage';
import { Badge, Button, Card, Eyebrow, H1, H2, Muted, Notice, Screen, Segmented, Spacer, Toggle } from '@/ui/kit';
import { theme as t } from '@/ui/theme';
import { L, useUiLang } from '@/lib/l10n';

const KAHF_ID = 'kahf';

export default function Kahf() {
  const { s, t: tr } = useSettings();
  const [prefs] = useShared(readerPrefs);
  const player = useAudioPlayer({ uri: KAHF_AUDIO[0] }, { updateInterval: 500, keepAudioSessionActive: true });
  const st = useAudioPlayerStatus(player);
  const wantPlay = useRef(false);
  const [src, setSrc] = useState(0);
  const [ayahs, setAyahs] = useState<Ayah[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const ui = useUiLang();
  const [lang, setLang] = useState<'fr' | 'en' | 'none'>(ui === 'en' ? 'en' : ui === 'ar' ? 'none' : 'fr');
  const [resumeAt, setResumeAt] = useState(0);
  const [limit, setLimit] = useState(20);
  const [reminder, setReminder] = usePersistentState('kahf-reminder', true);
  const [readWeeks, setReadWeeks] = usePersistentState<string[]>('kahf-read', []);
  const now = new Date();
  const maghrib = useMemo(() => computeDay(now, s.place, s.method, s.madhab, s.prayer).find((x) => x.key === 'maghrib')?.time, [s.place, s.method, s.madhab, s.prayer]); // eslint-disable-line react-hooks/exhaustive-deps
  const week = fridayKey(now);
  const done = readWeeks.includes(week);

  useEffect(() => {
    void enableBackgroundAudio();
    quranMount(KAHF_ID);
    const off = onQuranPreempted(KAHF_ID, () => {
      wantPlay.current = false;
      try {
        player.pause();
      } catch {}
    });
    return () => {
      off();
      wantPlay.current = false;
      quranUnmount(KAHF_ID);
      try {
        player.pause();
      } catch {}
    };
  }, [player]);
  // Fin naturelle du fichier entier : libère la récitation. Un échec de chargement n’est pas une fin.
  useEffect(() => {
    if (!st.didJustFinish || st.playbackState === 'failed') return;
    if (!wantPlay.current && !quranOwnsPlayback(KAHF_ID)) return;
    wantPlay.current = false;
    quranUserStop(KAHF_ID);
  }, [st.didJustFinish, st.playbackState]);
  // Bascule vers la source de secours si le premier serveur échoue.
  // On ne lance pas la lecture tout seul : seulement si l’utilisateur l’avait demandée et qu’al-Kahf a encore la main.
  useEffect(() => {
    if (st.playbackState === 'failed' && src < KAHF_AUDIO.length - 1) {
      const n = src + 1;
      const keep = wantPlay.current && quranOwnsPlayback(KAHF_ID);
      const at = keep ? st.currentTime || 0 : 0;
      setSrc(n); // eslint-disable-line react-hooks/set-state-in-effect
      setResumeAt(at);
      try {
        player.replace({ uri: KAHF_AUDIO[n] });
        if (keep) player.play();
      } catch {}
    }
  }, [st.playbackState, src, player]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (resumeAt > 0 && st.isLoaded && st.duration > 0) {
      try {
        player.seekTo(resumeAt);
      } catch {}
      setResumeAt(0); // eslint-disable-line react-hooks/set-state-in-effect
    }
  }, [resumeAt, st.isLoaded, st.duration, player]);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    try {
      if (st.playing) player.setActiveForLockScreen(true, { title: L('Sourate al-Kahf'), artist: 'Mishary Rashid Alafasy' });
    } catch {}
  }, [st.playing, player]);

  const load = (force = false) => {
    setErr(null);
    getKahfText(force)
      .then((r) => setAyahs(r.ayahs))
      .catch(() => setErr(L('Texte indisponible : vérifiez la connexion internet (il sera ensuite gardé hors ligne).')));
  };
  useEffect(() => load(), []);

  return (
    <Screen>
      <Eyebrow>{L('Sourate 18 · 110 versets')}</Eyebrow>
      <H1>{tr.kahf}</H1>
      <Text style={{ color: t.primary, fontSize: 28, marginTop: 4 }}>سُورَةُ الكَهْف</Text>
      <Spacer />
      {reminder && isKahfTime(now, maghrib) && !done ? <Notice tone="success" icon="notifications-outline" title={L("C’est le moment de lire al-Kahf")} text={L("Du coucher du soleil jeudi jusqu’au coucher du soleil vendredi.")} /> : null}
      <Card>
        <NowPlaying title={L("Sourate al-Kahf")} sub={L("Récitation : Mishary Rashid Alafasy (streaming)")} />
        <PlayerBar
          player={player}
          st={st}
          onPlay={() => {
            wantPlay.current = true;
            quranRequestPlay(KAHF_ID);
          }}
          onPause={() => {
            wantPlay.current = false;
            quranUserPause(KAHF_ID);
          }}
        />
        {prefs.readingMode === 'meditative' ? <Muted style={{ fontSize: 12, marginTop: 8 }}>{L('Lecture méditative indisponible : audio en un seul fichier, sans séparation des versets.')}</Muted> : null}
        {st.playbackState === 'failed' && src === KAHF_AUDIO.length - 1 ? <Muted style={{ marginTop: 6, color: t.danger }}>{L('Lecture impossible : connexion requise (audio en streaming, non stocké dans l’app).')}</Muted> : null}
        <Muted style={{ fontSize: 11, marginTop: 8 }}>{L('Audio diffusé depuis {s} — rien n’est téléchargé ni inclus dans l’app.', { s: src === 0 ? 'mp3quran.net' : 'cdn.islamic.network' })}</Muted>
      </Card>
      <Card>
        <Toggle label={L("Rappel du vendredi")} hint={L("Affiche un rappel dans l’app (accueil et ici) de jeudi soir à vendredi soir.")} value={reminder} onChange={setReminder} />
        <Button
          title={done ? L('Lue cette semaine ✓') : L('Marquer comme lue cette semaine')}
          variant={done ? 'secondary' : 'primary'}
          icon="checkmark-done-outline"
          onPress={() => setReadWeeks(done ? readWeeks.filter((w) => w !== week) : [...readWeeks.slice(-51), week])}
        />
      </Card>
      <Card>
        <H2>{L('Mérites (références)')}</H2>
        <Text style={{ color: t.text, marginTop: 6, lineHeight: 22 }}>« Celui qui mémorise dix versets du début de la sourate al-Kahf sera protégé du Dajjal. »</Text>
        <Text style={{ color: t.primary, fontWeight: '700', marginTop: 4 }}>Sahih Muslim 809</Text>
        <Text style={{ color: t.text, marginTop: 10, lineHeight: 22 }}>« Celui qui lit la sourate al-Kahf le vendredi, une lumière l’éclairera entre les deux vendredis. »</Text>
        <Text style={{ color: t.primary, fontWeight: '700', marginTop: 4 }}>Rapporté par al-Hakim et al-Bayhaqi ; jugé authentique par al-Albani (Sahih al-Jami‘ 6470)</Text>
      </Card>
      <Spacer />
      <H2>Texte</H2>
      <Segmented options={[{ label: 'Français', value: 'fr' }, { label: 'English', value: 'en' }, { label: L('Arabe seul'), value: 'none' }]} value={lang} onChange={setLang} />
      {err ? <Notice tone="warning" title={err} /> : null}
      {err ? <Button title={L("Réessayer")} variant="secondary" icon="refresh" onPress={() => load(true)} /> : null}
      {!ayahs && !err ? <Muted>{L('Chargement du texte…')}</Muted> : null}
      {ayahs ? (
        <View>
          {ayahs.slice(0, limit).map((a) => (
            <Card key={a.n}>
              <Badge label={String(a.n)} tone="neutral" />
              <Text style={{ color: t.text, fontSize: 22, lineHeight: 42, textAlign: 'right', writingDirection: 'rtl', marginTop: 6 }}>{a.ar}</Text>
              {lang !== 'none' ? <Text style={{ color: t.muted, marginTop: 6, lineHeight: 21, writingDirection: 'ltr', textAlign: 'left' }}>{lang === 'fr' ? a.fr : a.en}</Text> : null}
            </Card>
          ))}
          {limit < ayahs.length ? <Button title={L('Afficher la suite ({n} versets)', { n: ayahs.length - limit })} variant="secondary" onPress={() => setLimit(ayahs.length)} /> : null}
          <Muted style={{ fontSize: 11, marginTop: 8 }}>{L('Texte : api.alquran.cloud (Uthmani ; trad. Hamidullah / Pickthall, domaine public), mis en cache sur l’appareil.')}</Muted>
        </View>
      ) : null}
    </Screen>
  );
}
