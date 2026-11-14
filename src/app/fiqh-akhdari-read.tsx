import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as Speech from 'expo-speech';
import { memo, useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { Text } from '@/ui/Text';
import raw from '../../assets/fiqh/akhdari.json';
import { AiConsentSheet } from '@/components/AiConsentSheet';
import { askBilal, bilalErrorFr } from '@/lib/bilal';
import { akhdariChapters, chapterParagraphs, splitSentences, type AkhdariItem } from '@/lib/akhdari-view';
import { useConsent } from '@/lib/consent';
import { layoutAyahs } from '@/lib/quran-layout';
import { readerPrefs } from '@/lib/quran-store';
import { useShared } from '@/lib/shared-state';
import { canSendToAI } from '@/lib/privacy';
import { usePremium } from '@/lib/premium';
import { useSettings } from '@/lib/settings';
import { fontsAreReady, subscribeFonts } from '@/ui/fonts-ready';
import { Ionicons } from '@/ui/kit';
import { brand as b, fonts } from '@/ui/theme';
import { L } from '@/lib/l10n';

const ITEMS = raw as AkhdariItem[];
const CHAPTERS = akhdariChapters(ITEMS);

const Row = memo(function Row({
  item,
  showSub,
  selected,
  spoken,
  size,
  font,
  onSelect,
}: {
  item: AkhdariItem;
  showSub: boolean;
  selected: boolean;
  spoken: number;
  size: number;
  font?: string;
  onSelect: (id: string) => void;
}) {
  const parts = splitSentences(item.text);
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => onSelect(item.id)}
      style={{ borderRadius: 16, padding: 14, marginBottom: 10, backgroundColor: selected ? b.goldSoft : b.paper, borderWidth: 1, borderColor: selected ? b.gold : b.line }}
    >
      {showSub ? <Text style={{ color: b.brown, fontFamily: font, fontSize: 18, lineHeight: 34, textAlign: 'right', writingDirection: 'rtl', marginBottom: 6 }}>{item.subheading}</Text> : null}
      <Text style={{ color: b.ink, fontFamily: font, fontSize: size, lineHeight: Math.round(size * 1.9), textAlign: 'right', writingDirection: 'rtl' }}>
        {parts.map((part, i) => (
          <Text key={i} style={selected && spoken === i ? { backgroundColor: b.gold } : undefined}>
            {part}
            {i < parts.length - 1 ? ' ' : ''}
          </Text>
        ))}
      </Text>
    </Pressable>
  );
});

export default function AkhdariRead() {
  const { i } = useLocalSearchParams<{ i?: string }>();
  const router = useRouter();
  const chapter = CHAPTERS[Math.max(0, parseInt(i ?? '0', 10) || 0)] ?? CHAPTERS[0];
  const rows = useMemo(() => (chapter ? chapterParagraphs(ITEMS, chapter.title) : []), [chapter]);
  const [prefs] = useShared(readerPrefs);
  const fontReady = useSyncExternalStore(subscribeFonts, fontsAreReady, () => false);
  const font = fontReady ? fonts.quran : undefined;
  const [selected, setSelected] = useState<string | null>(rows[0]?.id ?? null);
  const [spoken, setSpoken] = useState(-1);
  const [explain, setExplain] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [askConsent, setAskConsent] = useState(false);
  const premium = usePremium();
  const { s } = useSettings();
  const [consent, choose, consentReady] = useConsent();
  const current = rows.find((r) => r.id === selected) ?? null;
  const layout = useMemo(
    () => layoutAyahs(rows.map((r) => r.text), { arSize: prefs.arSize, lineH: prefs.lineH, trSize: 0, showTr: false, showTl: false }),
    [rows, prefs.arSize, prefs.lineH],
  );
  const getItemLayout = useCallback(
    (_: ArrayLike<AkhdariItem> | null | undefined, index: number) => ({
      length: layout.heights[index] ?? 120,
      offset: layout.offsets[index] ?? 0,
      index,
    }),
    [layout],
  );

  useEffect(() => () => void Speech.stop(), []);

  const premiumOk = () => {
    if (!premium.ready) return false;
    if (!premium.canCreate) {
      router.push('/premium');
      return false;
    }
    return true;
  };

  const read = () => {
    if (!current || !premiumOk()) return;
    setErr(null);
    const parts = splitSentences(current.text);
    void Speech.stop();
    setSpoken(0);
    parts.forEach((part, index) => {
      Speech.speak(part, {
        language: 'ar',
        rate: 0.9,
        onStart: () => setSpoken(index),
        onDone: () => {
          if (index === parts.length - 1) setSpoken(-1);
        },
        onError: () => setSpoken(-1),
      });
    });
  };

  const explainPassage = async () => {
    if (!current || !premiumOk()) return;
    if (!consentReady || !canSendToAI(consent, consentReady)) {
      setAskConsent(true);
      return;
    }
    setErr(null);
    setBusy(true);
    try {
      const text = await askBilal({ mode: 'fiqh', passage: current.text, lang: s.lang });
      setExplain(text);
    } catch (e) {
      setErr(bilalErrorFr(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: b.cream }}>
      <Stack.Screen options={{ title: L('Matn d’al-Akhdarī'), headerStyle: { backgroundColor: b.cream }, headerTintColor: b.ink }} />
      <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
        <Text style={{ alignSelf: 'flex-start', fontSize: 12, fontWeight: '800', color: b.brown, backgroundColor: b.goldSoft, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 }}>
          {L('à vérifier — relecture par un savant requise avant publication')}
        </Text>
        <Text style={{ color: b.ink, fontFamily: font, fontSize: 22, lineHeight: 40, textAlign: 'right', writingDirection: 'rtl', marginTop: 8 }}>{chapter?.title}</Text>
      </View>
      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        getItemLayout={getItemLayout}
        initialNumToRender={6}
        maxToRenderPerBatch={8}
        windowSize={5}
        removeClippedSubviews
        contentContainerStyle={{ padding: 16, paddingBottom: 150, maxWidth: 760, width: '100%', alignSelf: 'center' }}
        renderItem={({ item, index }) => (
          <Row
            item={item}
            showSub={!!item.subheading && item.subheading !== rows[index - 1]?.subheading}
            selected={item.id === selected}
            spoken={item.id === selected ? spoken : -1}
            size={Math.max(22, prefs.arSize)}
            font={font}
            onSelect={setSelected}
          />
        )}
        extraData={`${selected}:${spoken}`}
      />
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 12, backgroundColor: b.paper, borderTopWidth: 1, borderTopColor: b.line, gap: 8 }}>
        {err ? <Text style={{ color: b.rust }}>{err}</Text> : null}
        {explain ? (
          <View>
            <Text style={{ color: b.brown, fontWeight: '800', marginBottom: 4 }}>{L('Explication générée par une IA. À faire vérifier par un savant qualifié.')}</Text>
            <Text style={{ color: b.ink, lineHeight: 21 }}>{explain}</Text>
          </View>
        ) : null}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable accessibilityRole="button" onPress={read} style={{ flex: 1, backgroundColor: b.green, borderRadius: 12, padding: 12, alignItems: 'center' }}>
            <Text style={{ color: '#fff', fontWeight: '800' }}>{L('Lire à voix haute')}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => void Speech.stop()} style={{ padding: 12 }}>
            <Ionicons name="stop" size={22} color={b.ink} />
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => void explainPassage()} style={{ flex: 1, backgroundColor: b.brown, borderRadius: 12, padding: 12, alignItems: 'center', opacity: busy ? 0.6 : 1 }}>
            <Text style={{ color: '#fff', fontWeight: '800' }}>{L('Expliquer ce passage')}</Text>
          </Pressable>
        </View>
      </View>
      {askConsent ? (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
          <AiConsentSheet
            onAccept={() => {
              choose('ai', true);
              setAskConsent(false);
            }}
            onDecline={() => setAskConsent(false)}
          />
        </View>
      ) : null}
    </View>
  );
}
