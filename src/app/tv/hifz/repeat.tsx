import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { useSurahUthmani } from '@/components/quran/data';
import { TvBack, TvButton, TvMuted, TvPremiumGate, TvRow, useTvFrame } from '@/components/tv/ui';
import { RANGE_REPEAT_CHOICES, REPEAT_RATES, VERSE_REPEAT_CHOICES, repeatProgressLabel, type RepeatScope } from '@/lib/hifz-repeat';
import { useRepeatSession } from '@/lib/use-hifz-repeat';
import { L } from '@/lib/l10n';
import { SURAHS } from '@/lib/surahs';
import { TV_ON_CARD } from '@/lib/tv-surface';
import { Text } from '@/ui/Text';
import { fonts } from '@/ui/theme';
import { fontsAreReady } from '@/ui/fonts-ready';

const SCOPES: RepeatScope[] = ['verse', 'range', 'sura'];
const SCOPE_LABEL: Record<RepeatScope, string> = { verse: 'Un verset', range: 'Une plage de versets', sura: 'Toute la sourate' };

function cycle<T>(list: readonly T[], cur: T, dir: 1 | -1): T {
  const i = Math.max(0, list.indexOf(cur));
  return list[(i + dir + list.length) % list.length];
}

const mark = (n: number) => (n === 0 ? '∞' : `×${n}`);

/** Même répétition que l’iPhone, en boutons larges pour la télécommande. Gratuite. */
export default function TvHifzRepeat() {
  return (
    <TvPremiumGate feature="hifz">
      <Body />
    </TvPremiumGate>
  );
}

function Body() {
  const params = useLocalSearchParams<{ s?: string; scope?: string; a?: string; from?: string; to?: string }>();
  const frame = useTvFrame();
  const session = useRepeatSession(params);
  const lines = useSurahUthmani(session.surah);
  const meta = SURAHS[session.surah - 1];
  const { rec, playAt, jump, progress, verses, rateOn } = session.player;
  const label = progress ? repeatProgressLabel(progress) : null;
  const ayah = rec.step?.s === session.surah ? rec.step.a : session.spanFrom;
  const text = lines?.[ayah - 1] ?? '';
  const verseWidth = Math.max(640, frame.width - 180);

  return (
    <View style={{ flex: 1, width: frame.width, height: frame.height, backgroundColor: '#10211C', paddingHorizontal: 72, paddingTop: 28 }}>
      <Text style={{ color: TV_ON_CARD, fontSize: 40, fontWeight: '800', height: 52 }}>{L('Répéter la récitation')}</Text>
      <Text style={{ color: TV_ON_CARD, fontSize: 28, marginTop: 4 }}>{`${meta[2]} · ${session.reciterName}`}</Text>
      <View style={{ flex: 1, width: verseWidth, justifyContent: 'center' }}>
        <Text accessibilityLiveRegion="polite" style={{ color: TV_ON_CARD, fontSize: 28, fontWeight: '800', textAlign: 'center', marginBottom: 12 }}>
          {label ? L(label.key, label.vars) : `${ayah}`}
        </Text>
        <Text style={{ color: TV_ON_CARD, fontSize: 52, lineHeight: 92, textAlign: 'center', width: verseWidth, fontFamily: fontsAreReady() ? fonts.quran : undefined }}>{text || '…'}</Text>
      </View>
      {rec.error ? <TvMuted>{rec.error}</TvMuted> : null}
      <TvMuted>{L('Sans connexion, seuls les versets déjà téléchargés sont lus.')}</TvMuted>
      <TvRow>
        <TvButton label={L(SCOPE_LABEL[session.scope])} onPress={() => session.chooseScope(cycle(SCOPES, session.scope, 1))} />
        <TvButton label={L('Répéter chaque verset')} hint={mark(session.each)} onPress={() => session.setEach(cycle(VERSE_REPEAT_CHOICES, session.each, 1))} />
        <TvButton label={L('Répéter toute la plage')} hint={mark(session.times)} onPress={() => session.setTimes(cycle(RANGE_REPEAT_CHOICES, session.times, 1))} />
        <TvButton label={L('Pause')} hint={L('{n} s', { n: session.pauseSec })} onPress={() => session.setPause(session.pauseSec >= 10 ? 0 : session.pauseSec + 1)} />
        {rateOn ? <TvButton label={L('Vitesse')} hint={`×${session.rate}`} onPress={() => session.setRate(cycle(REPEAT_RATES, session.rate, 1))} /> : null}
      </TvRow>
      {session.scope === 'range' ? (
        <TvRow>
          <TvButton label={L('Du verset')} hint={String(session.from)} onPress={() => session.setFrom(session.from >= session.max ? 1 : session.from + 1)} />
          <TvButton label={L('Au verset')} hint={String(session.to)} onPress={() => session.setTo(session.to >= session.max ? session.from : session.to + 1)} />
        </TvRow>
      ) : null}
      {session.scope === 'verse' ? (
        <TvRow>
          <TvButton label={L('Un verset')} hint={String(session.ayah)} onPress={() => session.setAyah(session.ayah >= session.max ? 1 : session.ayah + 1)} />
        </TvRow>
      ) : null}
      <TvRow>
        <TvButton label={L('Verset précédent')} onPress={() => jump(-1)} />
        <TvButton
          preferred
          label={rec.playing ? L('Pause') : rec.error ? L('Réessayer') : L('Écouter et répéter')}
          onPress={() => (rec.playing ? rec.pause() : rec.pos >= 0 && !rec.error ? rec.resume() : playAt(Math.max(0, verses.findIndex((v) => v.a === ayah))))}
        />
        <TvButton label={L('Verset suivant')} onPress={() => jump(1)} />
        <TvButton label={L('Arrêter')} onPress={() => rec.stop()} />
        <TvBack />
      </TvRow>
    </View>
  );
}
