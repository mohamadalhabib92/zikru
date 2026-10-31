import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { Text } from '@/ui/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AudioBar } from '@/components/quran/AudioBar';
import { useAyahFlow } from '@/components/quran/AyahFlow';
import { useUthmani } from '@/components/quran/data';
import { useReaderKeepAwake } from '@/components/quran/keep-awake';
import { readerPalette, type Pal } from '@/components/quran/palette';
import { ReaderSettings } from '@/components/quran/ReaderSettings';
import { QBtn } from '@/components/quran/Sheet';
import { dayKey } from '@/lib/dates';
import { khatmaStatus, markPage } from '@/lib/khatma';
import { arNum, fromIndex, gIndex, hizbOfIndex, juzOfIndex, juzRange, pageOf, pageRange, rubStartAt, TOTAL_PAGES } from '@/lib/quran-nav';
import { BASMALA_UTHMANI } from '@/lib/quran-reader-data';
import { keyOf, khatma as khatmaStore, logPageRead, marks, readerPrefs, recordRead, type Marks } from '@/lib/quran-store';
import { buildQueue } from '@/lib/recitation';
import { useShared } from '@/lib/shared-state';
import { SURAHS } from '@/lib/surahs';
import { useRecitation } from '@/lib/use-recitation';
import { Ionicons } from '@/ui/kit';
import { alpha, fonts } from '@/ui/theme';
import { NuraniText } from '@/components/quran/NuraniText';
import { L } from '@/lib/l10n';

const PAGES = Array.from({ length: TOTAL_PAGES }, (_, i) => i + 1);

type PageProps = { page: number; all: string[]; width: number; height: number; pal: Pal; size: number; lineH: number; nurani?: boolean; muqattaat?: boolean; hl: Marks['hl']; playing: string; onAyah: (s: number, a: number) => void };
const MushafPage = memo(function MushafPage({ page, all, width, height, pal, size, lineH, hl, playing, onAyah, nurani, muqattaat }: PageProps) {
  const [start, end] = pageRange(page);
  // segments : un bloc par sourate présente sur la page
  const blocks: { s: number; from: number; idx: number[] }[] = [];
  for (let i = start; i < end; i++) {
    const [s, a] = fromIndex(i);
    const last = blocks[blocks.length - 1];
    if (!last || last.s !== s) blocks.push({ s, from: a, idx: [i] });
    else last.idx.push(i);
  }
  const gi = start;
  return (
    <View style={{ width, height }}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 6, paddingBottom: 140, maxWidth: 760, width: '100%', alignSelf: 'center' }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
          <Text style={{ color: pal.muted, fontSize: 12, fontWeight: '700' }}>{L('Juz’ {j} · Hizb {h}', { j: juzOfIndex(gi), h: hizbOfIndex(gi) })}</Text>
          <Text style={{ color: pal.muted, fontSize: 12, fontWeight: '700' }}>{SURAHS[fromIndex(gi)[0] - 1][2]}</Text>
        </View>
        <View style={{ backgroundColor: pal.card, borderRadius: 18, borderWidth: 1, borderColor: alpha(pal.gold, 0.45), paddingHorizontal: 14, paddingVertical: 12 }}>
          {blocks.map((bk) => (
            <View key={`${bk.s}-${bk.from}`}>
              {bk.from === 1 ? (
                <View style={{ alignItems: 'center', marginTop: 4, marginBottom: 4 }}>
                  <View style={{ alignSelf: 'stretch', borderRadius: 12, borderWidth: 1, borderColor: alpha(pal.gold, 0.6), backgroundColor: alpha(pal.gold, 0.08), paddingVertical: 2, alignItems: 'center' }}>
                    <Text style={{ color: pal.gold, fontFamily: fonts.quran, fontSize: 22, lineHeight: 48 }}>{SURAHS[bk.s - 1][1]}</Text>
                  </View>
                  {bk.s !== 1 && bk.s !== 9 ? <Text style={{ color: pal.ink, fontFamily: fonts.quran, fontSize: size * 0.9, lineHeight: Math.round(size * 0.9 * 2.1) }}>{BASMALA_UTHMANI}</Text> : null}
                </View>
              ) : null}
              <Text style={{ color: pal.ink, fontFamily: fonts.quran, fontSize: size, lineHeight: Math.round(size * lineH), textAlign: 'justify', writingDirection: 'rtl' }}>
                {bk.idx.map((i) => {
                  const [s, a] = fromIndex(i);
                  const k = keyOf(s, a);
                  const h = hl[k];
                  const on = playing === k;
                  return (
                    <Text key={i} onPress={() => onAyah(s, a)} accessibilityRole="button" accessibilityLabel={L('Verset {s}:{a}', { s, a })} style={on ? { backgroundColor: alpha(pal.accent, 0.22), color: pal.ink } : h ? { backgroundColor: alpha(h, pal.dark ? 0.25 : 0.35) } : undefined}>
                      {rubStartAt(i) ? <Text style={{ color: pal.gold }}>{'۞ '}</Text> : null}
                      <NuraniText text={all[i]} surah={s} ayah={a} nurani={!!nurani} muqattaat={!!muqattaat} gold={pal.gold} ink={pal.ink} />
                      <Text style={{ color: pal.gold }}>{` \u06DD${arNum(a)} `}</Text>
                    </Text>
                  );
                })}
              </Text>
            </View>
          ))}
        </View>
        <Text style={{ color: pal.muted, textAlign: 'center', marginTop: 10, fontSize: 16, fontWeight: '700' }} accessibilityLabel={L('Page {p}', { p: page })}>
          {`${arNum(page)}`}
        </Text>
      </ScrollView>
    </View>
  );
});

/** Mode page : les 604 pages du Mushaf de Médine (pagination Tanzil), feuilletées de droite à gauche. */
export default function Mushaf() {
  const { p: raw } = useLocalSearchParams<{ p?: string }>();
  const p0 = Math.min(TOTAL_PAGES, Math.max(1, parseInt(raw ?? '1', 10) || 1));
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [pr] = useShared(readerPrefs);
  const pal = readerPalette(pr.theme);
  const [m] = useShared(marks);
  const [k, setK] = useShared(khatmaStore);
  const all = useUthmani();
  const [page, setPage] = useState(p0);
  const [h, setH] = useState(0);
  const [settings, setSettings] = useState(false);
  const list = useRef<FlatList<number>>(null);
  useReaderKeepAwake(pr.keepAwake);
  const rec = useRecitation({ reciter: pr.reciter, rate: pr.rate, gap: 0 });
  const playing = rec.step ? keyOf(rec.step.s, rec.step.a) : '';
  const flow = useAyahFlow(pal, (t) => playFrom(gIndex(t.s, t.a)));
  const today = dayKey();
  const kst = k && !k.finished ? khatmaStatus(k, today) : null;

  // lecture : de ce verset jusqu’à la fin du juz’ (la page suit)
  const playFrom = (i: number) => {
    const end = juzRange(juzOfIndex(i))[1];
    const v: [number, number][] = [];
    for (let x = i; x < end; x++) v.push(fromIndex(x));
    rec.start(buildQueue(v), 0);
  };
  const goPage = useCallback(
    (q: number, animated = true) => {
      const t = Math.min(TOTAL_PAGES, Math.max(1, q));
      try {
        list.current?.scrollToIndex({ index: t - 1, animated });
      } catch {}
      setPage(t);
    },
    [],
  );
  // suivi de la récitation d’une page à l’autre
  useEffect(() => {
    if (!rec.step || !pr.follow) return;
    const q = pageOf(rec.step.s, rec.step.a);
    if (q !== page) goPage(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rec.step?.s, rec.step?.a]);
  // dernière lecture + progression : arriver sur la page p = pages < p lues
  useEffect(() => {
    const t = setTimeout(() => {
      const [s, a] = fromIndex(pageRange(page)[0]);
      recordRead(s, a, 'page', { page, pageDone: page - 1 });
    }, 900);
    return () => clearTimeout(t);
  }, [page]);

  const onViewable = useRef(({ viewableItems }: { viewableItems: { item: unknown; isViewable: boolean }[] }) => {
    const v = viewableItems.find((x) => x.isViewable);
    if (v && typeof v.item === 'number') setPage(v.item);
  }).current;

  const size = Math.max(20, Math.round(pr.arSize * (width >= 700 ? 1 : 0.86)));
  const [s0] = fromIndex(pageRange(page)[0]);
  const pageDoneInKhatma = kst ? page - k!.from + 1 <= k!.done : false;
  const renderItem = useCallback(
    ({ item }: { item: number }) => (all ? <MushafPage page={item} all={all} width={width} height={h} pal={pal} size={size} lineH={pr.lineH} nurani={pr.nurani} muqattaat={pr.muqattaat} hl={m.hl} playing={playing} onAyah={(s, a) => flow.open({ s, a, ar: all[gIndex(s, a)] })} /> : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [all, width, h, pal.bg, size, pr.lineH, pr.nurani, pr.muqattaat, m.hl, playing],
  );

  return (
    <View style={{ flex: 1, backgroundColor: pal.bg }}>
      <Stack.Screen
        options={{
          title: L('{s} · p. {p}', { s: SURAHS[s0 - 1][2], p: page }),
          headerStyle: { backgroundColor: pal.bg },
          headerTintColor: pal.ink,
          headerRight: () => (
            <View style={{ flexDirection: 'row', gap: 4 }}>
              <Pressable accessibilityRole="button" accessibilityLabel={L("Mode verset par verset")} hitSlop={8} onPress={() => router.push({ pathname: '/quran/[n]', params: { n: String(s0), a: String(fromIndex(pageRange(page)[0])[1]) } })} style={{ padding: 8 }}>
                <Ionicons name="list-outline" size={22} color={pal.ink} />
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={L("Réglages d’affichage")} hitSlop={8} onPress={() => setSettings(true)} style={{ padding: 8 }}>
                <Ionicons name="text-outline" size={22} color={pal.ink} />
              </Pressable>
            </View>
          ),
        }}
      />
      <View style={{ flex: 1 }} onLayout={(e) => setH(e.nativeEvent.layout.height)}>
      {!all || !h ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={pal.accent} />
        </View>
      ) : (
        <FlatList
          ref={list}
          data={PAGES}
          horizontal
          inverted
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(x) => String(x)}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          initialScrollIndex={p0 - 1}
          initialNumToRender={1}
          maxToRenderPerBatch={2}
          windowSize={3}
          viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
          onViewableItemsChanged={onViewable}
          renderItem={renderItem}
          extraData={renderItem}
        />
      )}
      </View>
      {rec.pos < 0 ? (
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: Math.max(insets.bottom, 10), alignItems: 'center' }} pointerEvents="box-none">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: pal.card, borderRadius: 24, borderWidth: 1, borderColor: pal.line, padding: 6 }}>
            <QBtn icon="chevron-back" a11y="Page suivante" onPress={() => goPage(page + 1)} pal={pal} disabled={page >= TOTAL_PAGES} />
            <QBtn solid icon="play" label="Écouter la page" onPress={() => playFrom(pageRange(page)[0])} pal={pal} />
            {kst ? (
              <QBtn
                icon={pageDoneInKhatma ? 'checkmark-done' : 'checkmark'}
                label={pageDoneInKhatma ? 'Lue' : 'Page lue'}
                active={pageDoneInKhatma}
                onPress={() => {
                  if (!k) return;
                  setK(markPage(k, page, today));
                  logPageRead(page);
                }}
                pal={pal}
              />
            ) : null}
            <QBtn icon="chevron-forward" a11y="Page précédente" onPress={() => goPage(page - 1)} pal={pal} disabled={page <= 1} />
          </View>
          {kst?.today ? <Text style={{ color: pal.muted, fontSize: 11, marginTop: 6, backgroundColor: alpha(pal.bg, 0.8), paddingHorizontal: 8, borderRadius: 8 }}>{L('Wird du jour : p. {a}–{b} · khatma {p} %', { a: kst.today.from, b: kst.today.to, p: Math.round(kst.progress * 100) })}</Text> : null}
        </View>
      ) : null}
      <AudioBar rec={rec} pal={pal} extra={L('Page {p}', { p: page })} />
      <ReaderSettings visible={settings} onClose={() => setSettings(false)} pal={pal} />
      {flow.sheets}
    </View>
  );
}
