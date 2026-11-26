import { Redirect, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef } from 'react';
import { FlatList, Platform, ScrollView, View } from 'react-native';
import { TVPressable as Pressable } from '@/ui/tv-pressable';
import { Text } from '@/ui/Text';
import { QBtn, QChoice, QLabel, QStepper } from '@/components/quran/Sheet';
import { useSurahUthmani } from '@/components/quran/data';
import { useReaderKeepAwake } from '@/components/quran/keep-awake';
import { readerPalette } from '@/components/quran/palette';
import { REPEAT_RATES, VERSE_REPEAT_CHOICES, RANGE_REPEAT_CHOICES, repeatProgressLabel } from '@/lib/hifz-repeat';
import { readerPrefs } from '@/lib/quran-store';
import { useRepeatSession } from '@/lib/use-hifz-repeat';
import { useShared } from '@/lib/shared-state';
import { SURAHS } from '@/lib/surahs';
import { CONTENT_MAX } from '@/lib/mac';
import { useLayout } from '@/ui/ds';
import { alpha, fonts } from '@/ui/theme';
import { L } from '@/lib/l10n';
import { arLang } from '@/ui/ar-lang';
import { fontsAreReady } from '@/ui/fonts-ready';

/** Répétition audio : un verset, une plage, ou la sourate. Gratuite, comme le reste de la mémorisation. */
export default function HifzRepeatRoute() {
  const params = useLocalSearchParams<{ s?: string; scope?: string; a?: string; from?: string; to?: string }>();
  if (Platform.isTV) return <Redirect href={{ pathname: '/tv/hifz/repeat', params }} />;
  return <HifzRepeat />;
}

function HifzRepeat() {
  const params = useLocalSearchParams<{ s?: string; scope?: string; a?: string; from?: string; to?: string }>();
  const session = useRepeatSession(params);
  const [rp] = useShared(readerPrefs);
  const pal = readerPalette(rp.theme);
  useReaderKeepAwake(rp.keepAwake, 'hifz-repeat');
  const { wide } = useLayout();
  const lines = useSurahUthmani(session.surah);
  const meta = SURAHS[session.surah - 1];
  const { rec, verses, playAt, jump, progress, rateOn } = session.player;
  const list = useRef<FlatList<(typeof verses)[number]>>(null);
  const label = progress ? repeatProgressLabel(progress) : null;
  const playingA = rec.step?.s === session.surah ? rec.step.a : 0;

  useEffect(() => {
    if (!progress) return;
    const index = progress.i - 1;
    const go = () => list.current?.scrollToIndex({ index, viewPosition: 0.35, animated: true });
    try {
      go();
    } catch {
      setTimeout(go, 80);
    }
  }, [progress?.i, progress?.r]);

  const counts = (choices: readonly number[], value: number, onChange: (n: number) => void) => (
    <QChoice
      options={choices.map((v) => ({ label: v === 0 ? '∞' : `×${v}`, value: v, a11y: v === 0 ? L('En boucle') : L('{n} fois', { n: v }) }))}
      value={value}
      onChange={onChange}
      pal={pal}
    />
  );

  const controls = (
    <View style={{ gap: 4 }}>
      <Text style={{ color: pal.ink, fontWeight: '900', fontSize: 20 }}>{meta[2]}</Text>
      <Text style={{ color: pal.muted, fontSize: 13 }}>{session.reciterName}</Text>
      <QLabel pal={pal}>{L('Portée de la répétition')}</QLabel>
      <QChoice
        options={[
          { label: L('Un verset'), value: 'verse' as const },
          { label: L('Une plage de versets'), value: 'range' as const },
          { label: L('Toute la sourate'), value: 'sura' as const },
        ]}
        value={session.scope}
        onChange={session.chooseScope}
        pal={pal}
      />
      {session.scope === 'verse' ? (
        <>
          <QLabel pal={pal}>{L('Un verset')}</QLabel>
          <QStepper label="Du verset" value={session.ayah} min={1} max={meta[4]} onChange={session.setAyah} pal={pal} />
        </>
      ) : null}
      {session.scope === 'range' ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
          <View>
            <QLabel pal={pal}>{L('Du verset')}</QLabel>
            <QStepper label="Du verset" value={session.from} min={1} max={meta[4]} onChange={session.setFrom} pal={pal} />
          </View>
          <View>
            <QLabel pal={pal}>{L('Au verset')}</QLabel>
            <QStepper label="Au verset" value={session.to} min={1} max={meta[4]} onChange={session.setTo} pal={pal} />
          </View>
        </View>
      ) : null}
      {session.scope === 'sura' ? <Text style={{ color: pal.muted, marginTop: 8 }}>{L('{n} versets', { n: meta[4] })}</Text> : null}
      <QLabel pal={pal}>{L('Répéter chaque verset')}</QLabel>
      {counts(VERSE_REPEAT_CHOICES, session.each, session.setEach)}
      <QLabel pal={pal}>{L('Répéter toute la plage')}</QLabel>
      {counts(RANGE_REPEAT_CHOICES, session.times, session.setTimes)}
      <QLabel pal={pal}>{L('Pause entre les répétitions (pour répéter soi-même)')}</QLabel>
      <QStepper label="Pause" value={session.pauseSec} min={0} max={10} onChange={session.setPause} pal={pal} format={(v) => L('{n} s', { n: v })} />
      {rateOn ? (
        <>
          <QLabel pal={pal}>{L('Vitesse')}</QLabel>
          <QChoice options={REPEAT_RATES.map((v) => ({ label: `×${v}`, value: v }))} value={session.rate} onChange={session.setRate} pal={pal} />
        </>
      ) : null}
      <Text style={{ color: pal.muted, fontSize: 12, marginTop: 8 }}>{L('Sans connexion, seuls les versets déjà téléchargés sont lus.')}</Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: pal.bg }}>
      <Stack.Screen options={{ title: L('Répéter la récitation'), headerStyle: { backgroundColor: pal.bg }, headerTintColor: pal.ink, headerTitleStyle: { color: pal.ink } }} />
      <View style={{ flex: 1, width: '100%', maxWidth: CONTENT_MAX, alignSelf: 'center', flexDirection: wide ? 'row' : 'column' }}>
        <ScrollView style={{ flex: wide ? 1 : undefined, maxHeight: wide ? undefined : 420, minWidth: wide ? 340 : undefined }} contentContainerStyle={{ padding: 16, paddingBottom: 8 }}>
          {controls}
        </ScrollView>
        <FlatList
          ref={list}
          style={{ flex: 1 }}
          data={verses}
          keyExtractor={(v) => `${v.s}:${v.a}`}
          contentContainerStyle={{ padding: 16, paddingBottom: 120, gap: 8 }}
          onScrollToIndexFailed={({ index }) => {
            setTimeout(() => list.current?.scrollToIndex({ index, viewPosition: 0.35, animated: false }), 60);
          }}
          renderItem={({ item, index }) => {
            const on = playingA === item.a;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={L('Verset {a}. Toucher pour écouter à partir d’ici', { a: item.a })}
                onPress={() => playAt(index)}
                style={{ backgroundColor: on ? alpha(pal.accent, 0.12) : pal.card, borderRadius: 16, borderWidth: on ? 2 : 1, borderColor: on ? pal.accent : pal.line, padding: 12, gap: 6 }}
              >
                <Text style={{ color: on ? pal.accent : pal.muted, fontWeight: '900' }}>{`${item.s}:${item.a}`}</Text>
                <Text {...arLang} style={{ color: pal.ink, fontFamily: fontsAreReady() ? fonts.quran : undefined, fontSize: rp.arSize, lineHeight: rp.arSize * rp.lineH, textAlign: 'right' }}>
                  {lines?.[item.a - 1] ?? '…'}
                </Text>
              </Pressable>
            );
          }}
        />
      </View>
      <View style={{ borderTopWidth: 1, borderTopColor: pal.line, backgroundColor: pal.card, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 12, gap: 6 }}>
        <Text accessibilityLiveRegion="polite" style={{ color: pal.ink, fontWeight: '800', textAlign: 'center' }}>
          {label ? L(label.key, label.vars) : L('Répéter la récitation')}
        </Text>
        {rec.error ? <Text style={{ color: '#C24D5C', textAlign: 'center', fontSize: 13 }}>{rec.error}</Text> : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>
          <QBtn icon="play-skip-back" a11y="Verset précédent" onPress={() => jump(-1)} pal={pal} />
          {rec.playing ? (
            <QBtn icon="pause" label="Pause" onPress={rec.pause} pal={pal} solid />
          ) : (
            <QBtn icon="play" label={rec.pos >= 0 ? 'Reprendre' : 'Écouter et répéter'} onPress={() => (rec.pos >= 0 ? rec.resume() : playAt(0))} pal={pal} solid />
          )}
          <QBtn icon="play-skip-forward" a11y="Verset suivant" onPress={() => jump(1)} pal={pal} />
          <QBtn icon="stop" a11y="Arrêter la récitation" onPress={rec.stop} pal={pal} />
          {rec.error ? <QBtn icon="refresh" label="Réessayer" onPress={() => playAt(0)} pal={pal} /> : null}
        </View>
      </View>
    </View>
  );
}
