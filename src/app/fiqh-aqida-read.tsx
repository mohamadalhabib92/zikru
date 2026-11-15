import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as Speech from 'expo-speech';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Text } from '@/ui/Text';
import { AQIDA_ATTRIBUTES, AQIDA_SCHOLAR_FLAG, AQIDA_SECTIONS, aqidaVerse, sectionAttributes } from '@/lib/aqida-murshid';
import { CONTENT_LOCALES, resolveSlot, spokenOf, type ContentLocale, type LocaleMap } from '@/lib/religious-locale';
import { usePremium } from '@/lib/premium';
import { Ionicons } from '@/ui/kit';
import { Arabic } from '@/ui/light';
import { brand as b } from '@/ui/theme';
import { L, useUiLang } from '@/lib/l10n';

const asLocale = (l: string): ContentLocale => ((CONTENT_LOCALES as readonly string[]).includes(l) ? (l as ContentLocale) : 'fr');

function Flag({ text }: { text: string }) {
  return (
    <Text style={{ alignSelf: 'flex-start', fontSize: 12, fontWeight: '800', color: b.brown, backgroundColor: b.goldSoft, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 }}>
      {L(text)}
    </Text>
  );
}

function Block({
  role,
  map,
  locale,
  showArabic,
}: {
  role: 'matn' | 'translation' | 'commentary';
  map: LocaleMap;
  locale: ContentLocale;
  showArabic?: string;
}) {
  const slot = resolveSlot(map, locale);
  const label = role === 'matn' ? L('Matn') : role === 'translation' ? L('Traduction du matn') : L('Commentaire — ce n’est pas le matn');
  return (
    <View style={{ gap: 6, marginTop: 8 }}>
      <Text style={{ color: b.brown, fontWeight: '800' }}>{label}</Text>
      {showArabic ? <Arabic size={22}>{showArabic}</Arabic> : null}
      {role !== 'matn' || locale !== 'ar' ? <Text style={{ color: b.ink, lineHeight: 24 }}>{slot.text}</Text> : null}
      <Flag text={slot.flag} />
      <Text style={{ color: b.inkMuted, fontSize: 12 }}>{slot.source}</Text>
    </View>
  );
}

export default function AqidaRead() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const section = AQIDA_SECTIONS.find((s) => s.id === id) ?? AQIDA_SECTIONS[0];
  const locale = asLocale(useUiLang());
  const premium = usePremium();
  const [showAr, setShowAr] = useState(true);
  const [openNote, setOpenNote] = useState<number | string | null>(null);
  const attrs = sectionAttributes(section.id);

  useEffect(() => () => void Speech.stop(), []);

  const premiumOk = () => {
    if (!premium.ready) return false;
    if (!premium.canCreate) {
      router.push('/premium');
      return false;
    }
    return true;
  };

  const read = (map: LocaleMap) => {
    if (!premiumOk()) return;
    const spoken = spokenOf(map, locale);
    void Speech.stop();
    Speech.speak(spoken.text, { language: spoken.speech, rate: 0.9 });
  };

  return (
    <View style={{ flex: 1, backgroundColor: b.cream }}>
      <Stack.Screen options={{ title: L(section.title), headerStyle: { backgroundColor: b.cream }, headerTintColor: b.ink }} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48, maxWidth: 760, width: '100%', alignSelf: 'center', gap: 12 }}>
        <Flag text={AQIDA_SCHOLAR_FLAG} />
        {section.sanusi ? <Text style={{ color: b.brown, fontWeight: '800' }}>{L('Bloc distinct : structure d’Umm al-Barāhīn. Ce n’est pas un vers d’Ibn ʿĀshir.')}</Text> : null}
        <Pressable accessibilityRole="button" onPress={() => setShowAr((v) => !v)}>
          <Text style={{ color: b.green, fontWeight: '800' }}>{showAr ? L('Masquer l’arabe') : L('Afficher l’arabe')}</Text>
        </Pressable>
        {section.verses.map((n) => {
          const verse = aqidaVerse(n);
          const noteOpen = openNote === n;
          return (
            <View key={n} style={{ backgroundColor: b.paper, borderRadius: 16, borderWidth: 1, borderColor: b.line, padding: 14 }}>
              <Text style={{ color: b.brown, fontWeight: '800' }}>{L('Vers {n}', { n })}</Text>
              <Block role="matn" map={verse.translation} locale="ar" showArabic={showAr ? verse.arabic : undefined} />
              {locale !== 'ar' ? <Block role="translation" map={verse.translation} locale={locale} /> : null}
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <Pressable accessibilityRole="button" onPress={() => read(verse.translation)} style={{ flex: 1, backgroundColor: b.green, borderRadius: 10, padding: 10, alignItems: 'center' }}>
                  <Text style={{ color: '#fff', fontWeight: '800' }}>{L('Lire à voix haute')}</Text>
                </Pressable>
                <Pressable accessibilityRole="button" onPress={() => premiumOk() && setOpenNote(noteOpen ? null : n)} style={{ flex: 1, backgroundColor: b.brown, borderRadius: 10, padding: 10, alignItems: 'center' }}>
                  <Text style={{ color: '#fff', fontWeight: '800' }}>{L('Expliquer ce passage')}</Text>
                </Pressable>
              </View>
              {noteOpen ? <Block role="commentary" map={section.commentary} locale={locale} /> : null}
            </View>
          );
        })}
        {attrs.map((a) => (
          <View key={a.id} style={{ backgroundColor: b.paper, borderRadius: 16, borderWidth: 1, borderColor: section.sanusi ? b.gold : b.line, padding: 14, gap: 6 }}>
            <Flag text={a.scholarFlag} />
            {section.sanusi ? <Text style={{ color: b.brown, fontWeight: '800' }}>{L('Bloc distinct : structure d’Umm al-Barāhīn. Ce n’est pas un vers d’Ibn ʿĀshir.')}</Text> : null}
            <Text style={{ color: b.brown, fontWeight: '800' }}>{L('Matn')}</Text>
            {showAr ? <Arabic size={22}>{a.arabic}</Arabic> : null}
            <Text style={{ color: b.inkMuted, fontSize: 12 }}>{a.sourceRef}</Text>
            <Text style={{ color: b.ink, fontWeight: '800' }}>{a.opposite.arabic}</Text>
            <Text style={{ color: b.inkMuted, fontSize: 12 }}>{a.opposite.sourceRef}</Text>
            <Flag text={a.opposite.scholarFlag} />
            <Pressable accessibilityRole="button" onPress={() => premiumOk() && setOpenNote(openNote === a.id ? null : a.id)} style={{ backgroundColor: b.brown, borderRadius: 10, padding: 10, alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontWeight: '800' }}>{L('Expliquer ce passage')}</Text>
            </Pressable>
            {openNote === a.id ? (
              <View>
                <Text style={{ color: b.brown, fontWeight: '800' }}>{L('Commentaire — ce n’est pas le matn')}</Text>
                <Text style={{ color: b.ink, lineHeight: 24 }}>{resolveSlot(a.gloss, locale).text}</Text>
                <Flag text={resolveSlot(a.gloss, locale).flag} />
                <Pressable accessibilityRole="button" onPress={() => read(a.gloss)}>
                  <Text style={{ color: b.green, fontWeight: '800' }}>{L('Lire à voix haute')}</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        ))}
        {section.id === 'addad' ? (
          <Text style={{ color: b.inkMuted, fontSize: 12 }}>
            {AQIDA_ATTRIBUTES.filter((a) => a.block === 'murshid').map((a) => a.opposite.arabic).join(' · ')}
          </Text>
        ) : null}
      </ScrollView>
      <Pressable accessibilityRole="button" onPress={() => void Speech.stop()} style={{ position: 'absolute', right: 16, bottom: 16, backgroundColor: b.paper, borderRadius: 20, padding: 10, borderWidth: 1, borderColor: b.line }}>
        <Ionicons name="stop" size={22} color={b.ink} />
      </Pressable>
    </View>
  );
}
