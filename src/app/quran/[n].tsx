import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, FlatList, Pressable, View } from 'react-native';
import { Text } from '@/ui/Text';
import { ABSheet } from '@/components/quran/ABSheet';
import { AudioBar } from '@/components/quran/AudioBar';
import { useAyahFlow } from '@/components/quran/AyahFlow';
import { NuraniText } from '@/components/quran/NuraniText';
import { useEdition, useSurahUthmani, useTranslationId } from '@/components/quran/data';
import { useReaderKeepAwake } from '@/components/quran/keep-awake';
import { readerPalette } from '@/components/quran/palette';
import { ReaderSettings } from '@/components/quran/ReaderSettings';
import { QBtn } from '@/components/quran/Sheet';
import { arNum, gIndex, hizbOfIndex, juzOfIndex, pageOf, pageOfIndex, rubLabel, rubStartAt, sajdaAt } from '@/lib/quran-nav';
import { BASMALA_UTHMANI, surahEdition } from '@/lib/quran-reader-data';
import { preferSurah } from '@/lib/audio-dl';
import { keyOf, marks, readerPrefs, recordRead } from '@/lib/quran-store';
import { buildQueue } from '@/lib/recitation';
import { useShared } from '@/lib/shared-state';
import { SURAHS } from '@/lib/surahs';
import { useGlobalRecitation } from '@/lib/recitation-context';
import { Ionicons } from '@/ui/kit';
import { alpha, fonts } from '@/ui/theme';
import { fontsAreReady, subscribeFonts } from '@/ui/fonts-ready';
import { L } from '@/lib/l10n';
import { arLang } from '@/ui/ar-lang';
import type { Pal } from '@/components/quran/palette';

const AyahRow = memo(function AyahRow({
  n,
  a,
  text,
  trLine,
  tlLine,
  showTr,
  showTl,
  trFailed,
  onRetry,
  pal,
  arSize,
  lineH,
  trSize,
  nurani,
  muqattaat,
  hl,
  note,
  bookmark,
  playing,
  playingNow,
  onOpen,
  onPlay,
}: {
  n: number;
  a: number;
  text: string;
  trLine?: string;
  tlLine?: string;
  showTr: boolean;
  showTl: boolean;
  trFailed: boolean;
  onRetry: () => void;
  pal: Pal;
  arSize: number;
  lineH: number;
  trSize: number;
  nurani: boolean;
  muqattaat: boolean;
  hl?: string;
  note?: string;
  bookmark?: { name: string; color: string };
  playing: boolean;
  playingNow: boolean;
  onOpen: (a: number) => void;
  onPlay: (a: number) => void;
}) {
  const fontReady = useSyncExternalStore(subscribeFonts, fontsAreReady, () => false);
  return (
    <Pressable
      accessible={false}
      focusable={false}
      onPress={() => onOpen(a)}
      style={({ pressed }) => ({
        borderRadius: 18,
        padding: 14,
        marginBottom: 10,
        backgroundColor: playing ? alpha(pal.accent, 0.1) : hl ? alpha(hl, pal.dark ? 0.16 : 0.22) : pal.card,
        borderWidth: playing ? 2 : 1,
        borderColor: playing ? pal.accent : pal.line,
        opacity: pressed ? 0.9 : 1,
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={L('Verset {n}. Actions', { n: a })}
          hitSlop={10}
          onPress={() => onOpen(a)}
          style={{ backgroundColor: alpha(pal.accent, 0.12), borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 }}
        >
          <Text style={{ color: pal.accent, fontWeight: '800', fontSize: 12 }}>{`${n}:${a}`}</Text>
        </Pressable>
        {rubStartAt(gIndex(n, a)) ? (
          <View style={{ backgroundColor: alpha(pal.gold, 0.14), borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 }}>
            <Text style={{ color: pal.gold, fontWeight: '800', fontSize: 12 }}>{`۞ ${rubLabel(rubStartAt(gIndex(n, a)))}`}</Text>
          </View>
        ) : null}
        {sajdaAt(gIndex(n, a)) >= 0 ? (
          <View style={{ backgroundColor: alpha(pal.gold, 0.14), borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 }}>
            <Text style={{ color: pal.gold, fontWeight: '800', fontSize: 12 }}>{`۩ Sajda ${sajdaAt(gIndex(n, a)) === 1 ? 'obligatoire' : 'recommandée'}`}</Text>
          </View>
        ) : null}
        <View style={{ flex: 1 }} />
        {note ? <Ionicons name="document-text" size={16} color={pal.muted} accessibilityLabel={L("Note")} /> : null}
        {bookmark ? <Ionicons name="bookmark" size={16} color={bookmark.color} accessibilityLabel={`Marque-page ${bookmark.name}`} /> : null}
        <Pressable accessibilityRole="button" accessibilityLabel={playingNow ? L('Pause') : L('Écouter le verset {n}', { n: a })} hitSlop={8} onPress={() => onPlay(a)} style={{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: alpha(pal.accent, 0.1) }}>
          <Ionicons name={playingNow ? 'pause' : 'play'} size={16} color={pal.accent} />
        </Pressable>
      </View>
      <Text {...arLang} style={{ color: pal.ink, fontFamily: fontReady ? fonts.quran : undefined, fontSize: arSize, lineHeight: Math.round(arSize * lineH), textAlign: 'right', writingDirection: 'rtl', marginTop: 6 }}>
        <NuraniText text={text} surah={n} ayah={a} nurani={nurani} muqattaat={muqattaat} gold={pal.gold} ink={pal.ink} />
        <Text style={{ color: pal.gold }}>{` \u06DD${arNum(a)}`}</Text>
      </Text>
      {showTl && tlLine ? <Text style={{ color: pal.muted, fontStyle: 'italic', fontSize: trSize - 1, lineHeight: Math.round((trSize - 1) * 1.5), marginTop: 4 }}>{tlLine}</Text> : null}
      {showTr ? (
        trLine ? (
          <Text style={{ color: pal.ink, opacity: 0.88, fontSize: trSize, lineHeight: Math.round(trSize * 1.55), marginTop: 6 }}>{trLine}</Text>
        ) : a === 1 && trFailed ? (
          <Pressable onPress={onRetry} accessibilityRole="button">
            <Text style={{ color: pal.muted, fontSize: 13, marginTop: 6 }}>Traduction indisponible hors connexion · Réessayer</Text>
          </Pressable>
        ) : null
      ) : null}
      {note ? <Text style={{ color: pal.muted, fontSize: 13, marginTop: 8, fontStyle: 'italic' }} numberOfLines={2}>{`✎ ${note}`}</Text> : null}
    </Pressable>
  );
});

/** Lecteur verset par verset : texte uthmani, traduction et translittération optionnelles, récitation suivie. */
export default function SurahReader() {
  const { n: raw, a: rawA } = useLocalSearchParams<{ n: string; a?: string }>();
  const n = Math.min(114, Math.max(1, parseInt(raw ?? '1', 10) || 1));
  const meta = SURAHS[n - 1];
  const startA = Math.min(meta[4], Math.max(1, parseInt(rawA ?? '1', 10) || 1));
  const router = useRouter();
  const [p] = useShared(readerPrefs);
  const [m] = useShared(marks);
  const trId = useTranslationId();
  const ar = useSurahUthmani(n);
  const pal = useMemo(() => readerPalette(p.theme), [p.theme]);
  const quranFont = useSyncExternalStore(subscribeFonts, fontsAreReady, () => false) ? fonts.quran : undefined;
  const tr = useEdition(n, trId.id, p.showTr);
  const tl = useEdition(n, 'en.transliteration', p.showTl);
  const [settings, setSettings] = useState(false);
  const [top, setTop] = useState(startA);
  useReaderKeepAwake(p.keepAwake);
  const rec = useGlobalRecitation();
  const [ab, setAb] = useState<number | null>(null);
  const playingA = rec.step && rec.step.s === n ? rec.step.a : 0;
  const list = useRef<FlatList<number>>(null);
  // lecture continue : quand la récitation passe à la sourate suivante, le lecteur la suit (si « Suivre la récitation »)
  const lastS = useRef(rec.step?.s ?? 0);
  useEffect(() => {
    const cur = rec.step?.s ?? 0;
    if (cur && lastS.current === n && cur === n + 1 && rec.playing && p.follow) router.replace(`/quran/${cur}`);
    lastS.current = cur;
  }, [rec.step?.s, rec.playing, n, p.follow, router]);
  const data = useMemo(() => Array.from({ length: meta[4] }, (_, i) => i + 1), [meta]);
  // lecture jusqu’à la fin de la sourate, puis sourate suivante si « Lecture continue » est activée
  const play = (from: number) => rec.start(buildQueue(data.slice(from - 1).map((a) => [n, a] as [number, number])), 0, false, { next: 'surah' });
  const nRef = useRef(n);
  const playRef = useRef(play);
  const playingRef = useRef(playingA);
  const recRef = useRef(rec);
  const arRef = useRef(ar);
  const trLinesRef = useRef(tr.lines);
  const trIdRef = useRef(trId.id);
  const onPlay = useCallback((a: number) => {
    const active = playingRef.current;
    if (active === a && recRef.current.playing) recRef.current.pause();
    else if (active === a) recRef.current.resume();
    else playRef.current(a);
  }, []);
  const flow = useAyahFlow(pal, (t) => play(t.a), (t) => setAb(t.a));
  const openRef = useRef(flow.open);
  useLayoutEffect(() => {
    nRef.current = n;
    playRef.current = play;
    openRef.current = flow.open;
    arRef.current = ar;
    trLinesRef.current = tr.lines;
    trIdRef.current = trId.id;
    playingRef.current = playingA;
    recRef.current = rec;
  });
  const onOpen = useCallback((a: number) => {
    openRef.current({ s: nRef.current, a, ar: arRef.current?.[a - 1] ?? '', tr: trLinesRef.current?.[a - 1], trId: trIdRef.current });
  }, []);
  useEffect(() => {
    if (n < 114 && p.showTr) void surahEdition(n + 1, trId.id);
    if (n < 114 && p.showTl) void surahEdition(n + 1, 'en.transliteration');
  }, [n, p.showTr, p.showTl, trId.id]);
  useEffect(() => {
    preferSurah(p.reciter, n);
  }, [p.reciter, n]);

  const scrollTo = useCallback((a: number, animated = true) => {
    try {
      list.current?.scrollToIndex({ index: a - 1, viewPosition: 0.15, animated });
    } catch {}
  }, []);
  // arrivée sur un verset précis
  useEffect(() => {
    if (!ar || startA <= 1) return;
    const t = setTimeout(() => scrollTo(startA, false), 120);
    return () => clearTimeout(t);
  }, [ar, startA, scrollTo]);
  // suivi de la récitation
  useEffect(() => {
    if (playingA && p.follow) scrollTo(playingA);
  }, [playingA, p.follow, scrollTo]);

  // dernière lecture + progression khatma (débouncé)
  const saveT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onViewable = useCallback(({ viewableItems }: { viewableItems: { item: unknown; isViewable: boolean }[] }) => {
    const surah = nRef.current;
    const vis = viewableItems.filter((v) => v.isViewable && typeof v.item === 'number').map((v) => v.item as number);
    if (!vis.length) return;
    const first = Math.min(...vis), last = Math.max(...vis);
    setTop(first);
    if (saveT.current) clearTimeout(saveT.current);
    saveT.current = setTimeout(() => {
      const li = gIndex(surah, last);
      const lp = pageOfIndex(li);
      const endsPage = li + 1 >= 6236 || pageOfIndex(li + 1) !== lp;
      recordRead(surah, first, 'verse', { page: pageOf(surah, first), pageDone: endsPage ? lp : lp - 1 });
    }, 1200);
  }, []);
  useEffect(() => () => void (saveT.current && clearTimeout(saveT.current)), []);

  const rowH = Math.round(p.arSize * p.lineH + 52 + (p.showTr ? p.trSize * 1.55 + 16 : 0) + (p.showTl ? 28 : 0));
  const gi0 = gIndex(n, top);
  const header = (
    <View style={{ alignItems: 'center', paddingTop: 8, paddingBottom: 14 }}>
      <View style={{ alignSelf: 'stretch', borderRadius: 20, borderWidth: 1, borderColor: alpha(pal.gold, 0.5), backgroundColor: pal.card, paddingVertical: 16, paddingHorizontal: 14, alignItems: 'center' }}>
        <Text style={{ color: pal.gold, fontSize: 12, fontWeight: '800', letterSpacing: 1.4 }}>{L('SOURATE {n} · {k} · {v} VERSETS', { n, k: L(meta[5] === 'M' ? 'MECQUOISE' : 'MÉDINOISE'), v: meta[4] })}</Text>
        <Text {...arLang} style={{ color: pal.ink, fontFamily: quranFont, fontSize: 30, lineHeight: 64 }}>{meta[1]}</Text>
        <Text style={{ color: pal.muted, fontSize: 14, fontWeight: '600' }}>{`${meta[2]} — ${meta[3]}`}</Text>
        {n !== 1 && n !== 9 ? <Text {...arLang} style={{ color: pal.ink, fontFamily: quranFont, fontSize: 24, lineHeight: 54, marginTop: 6 }}>{BASMALA_UTHMANI}</Text> : null}
        {n === 9 ? <Text style={{ color: pal.muted, fontSize: 12, marginTop: 6 }}>Sourate sans basmala d’ouverture</Text> : null}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12, justifyContent: 'center' }}>
        <QBtn solid icon="play" label="Écouter" onPress={() => play(1)} pal={pal} />
        <QBtn icon="school-outline" label="Mémoriser" onPress={() => router.push({ pathname: '/quran/hifz-session', params: { s: String(n), from: '1', to: String(Math.min(meta[4], 5)) } })} pal={pal} />
        <QBtn icon="book-outline" label="Mode page" onPress={() => router.push({ pathname: '/quran/mushaf', params: { p: String(pageOf(n, top)) } })} pal={pal} />
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: pal.bg }}>
      <Stack.Screen
        options={{
          title: `${n}. ${meta[2]}`,
          headerStyle: { backgroundColor: pal.bg },
          headerTintColor: pal.ink,
          headerRight: () => (
            <View style={{ flexDirection: 'row', gap: 4 }}>
              <Pressable accessibilityRole="button" accessibilityLabel={L("Mode page (mushaf)")} hitSlop={8} onPress={() => router.push({ pathname: '/quran/mushaf', params: { p: String(pageOf(n, top)) } })} style={{ padding: 8 }}>
                <Ionicons name="book-outline" size={22} color={pal.ink} />
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={L("Réglages d’affichage")} hitSlop={8} onPress={() => setSettings(true)} style={{ padding: 8 }}>
                <Ionicons name="text-outline" size={22} color={pal.ink} />
              </Pressable>
            </View>
          ),
        }}
      />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: pal.line }} accessibilityRole="summary">
        <Text style={{ color: pal.muted, fontSize: 12, fontWeight: '700' }}>{L('Juz’ {n}', { n: juzOfIndex(gi0) })}</Text>
        <Text style={{ color: pal.muted, fontSize: 12, fontWeight: '700' }}>{L('Hizb {n}', { n: hizbOfIndex(gi0) })}</Text>
        <Text style={{ color: pal.muted, fontSize: 12, fontWeight: '700' }}>{L('Page {n}', { n: pageOfIndex(gi0) })}</Text>
        <Text style={{ color: pal.muted, fontSize: 12, fontWeight: '700' }}>{`${top}/${meta[4]}`}</Text>
      </View>
      {!ar ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={pal.accent} />
        </View>
      ) : (
        <FlatList
          ref={list}
          data={data}
          keyExtractor={(a) => String(n) + '-' + String(a)}
          initialScrollIndex={startA > 1 ? startA - 1 : undefined}
          getItemLayout={(_, index) => ({ length: rowH, offset: rowH * index, index })}
          initialNumToRender={8}
          maxToRenderPerBatch={6}
          windowSize={7}
          viewabilityConfig={{ itemVisiblePercentThreshold: 40 }}
          onViewableItemsChanged={onViewable}
          onScrollToIndexFailed={(e) => {
            list.current?.scrollToOffset({ offset: e.averageItemLength * e.index, animated: false });
            setTimeout(() => {
              try {
                list.current?.scrollToIndex({ index: e.index, viewPosition: 0.15, animated: false });
              } catch {}
            }, 250);
          }}
          contentContainerStyle={{ maxWidth: 820, width: '100%', alignSelf: 'center', paddingHorizontal: 14, paddingBottom: rec.pos >= 0 ? 180 : 40 }}
          ListHeaderComponent={header}
          renderItem={({ item: a }) => {
            const k = keyOf(n, a);
            const bm = m.bookmarks.find((x) => x.s === n && x.a === a);
            return (
              <AyahRow
                n={n}
                a={a}
                text={ar[a - 1]}
                trLine={tr.lines?.[a - 1]}
                tlLine={tl.lines?.[a - 1]}
                showTr={p.showTr}
                showTl={p.showTl}
                trFailed={tr.failed}
                onRetry={tr.retry}
                pal={pal}
                arSize={p.arSize}
                lineH={p.lineH}
                trSize={p.trSize}
                nurani={p.nurani}
                muqattaat={p.muqattaat}
                hl={m.hl[k]}
                note={m.notes[k]?.text}
                bookmark={bm ? { name: bm.name, color: bm.color } : undefined}
                playing={playingA === a}
                playingNow={playingA === a && rec.playing}
                onOpen={onOpen}
                onPlay={onPlay}
              />
            );
          }}
          ListFooterComponent={
            <View style={{ gap: 12, marginTop: 6 }}>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {n > 1 ? <QBtn icon="chevron-back" label={SURAHS[n - 2][2]} onPress={() => router.replace(`/quran/${n - 1}`)} pal={pal} /> : null}
                <View style={{ flex: 1 }} />
                {n < 114 ? <QBtn label={`${SURAHS[n][2]} →`} onPress={() => router.replace(`/quran/${n + 1}`)} pal={pal} /> : null}
              </View>
              <Text style={{ color: pal.muted, fontSize: 11, textAlign: 'center' }}>
                {`${L('Texte : Tanzil (uthmani, CC BY 3.0) · Traduction : {t} via alquran.cloud', { t: trId.label })}${p.showTl ? L(' · Translittération : alquran.cloud') : ''} · ${L('Touchez un verset pour ses actions')}`}
              </Text>
            </View>
          }
        />
      )}
      <AudioBar rec={rec} pal={pal} onAB={() => setAb(rec.step && rec.step.s === n ? rec.step.a : 1)} />
      {ab != null ? <ABSheet visible onClose={() => setAb(null)} s={n} a={ab ?? 1} pal={pal} start={(q, pos, loop) => rec.start(q, pos, loop)} /> : null}
      <ReaderSettings visible={settings} onClose={() => setSettings(false)} pal={pal} />
      {flow.sheets}
    </View>
  );
}
