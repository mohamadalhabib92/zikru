import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { TvBack, TvFocusable, TvMuted, TvPremiumGate, TvRow, TvScroll, TvTitle, useTvFrame } from '@/components/tv/ui';
import { AQIDA_SCHOLAR_FLAG, AQIDA_SECTIONS, aqidaVerse, sectionAttributes } from '@/lib/aqida-murshid';
import { CONTENT_LOCALES, resolveSlot, type ContentLocale } from '@/lib/religious-locale';
import { TV_ARABIC_MIN } from '@/lib/tv';
import { TV_BADGE_ON_CARD, TV_ON_CARD } from '@/lib/tv-surface';
import { L, useUiLang } from '@/lib/l10n';
import { Text } from '@/ui/Text';
import { fonts } from '@/ui/theme';
import { fontsAreReady } from '@/ui/fonts-ready';

const asLocale = (l: string): ContentLocale => ((CONTENT_LOCALES as readonly string[]).includes(l) ? (l as ContentLocale) : 'fr');

/** Lecture salon du matn et de sa traduction déjà dans l’app. Le bouton « Expliquer » de l’iPhone reste Premium et n’est pas repris ici. */
export default function TvAqidaSection() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const locale = asLocale(useUiLang());
  const section = AQIDA_SECTIONS.find((s) => s.id === id) ?? AQIDA_SECTIONS[0];
  const font = fontsAreReady() ? fonts.quran : undefined;
  const attrs = sectionAttributes(section.id);
  const frame = useTvFrame();
  return (
    <TvPremiumGate feature="aqida">
      <View style={{ flex: 1, width: frame.width, height: frame.height }}>
      <TvScroll>
        <TvTitle>{L(section.title)}</TvTitle>
        <TvMuted>{L('Aqida (Ibn ʿĀshir)')}</TvMuted>
        <TvMuted>{L(AQIDA_SCHOLAR_FLAG)}</TvMuted>
        {section.sanusi ? <TvMuted>{L('Bloc distinct : structure d’Umm al-Barāhīn. Ce n’est pas un vers d’Ibn ʿĀshir.')}</TvMuted> : null}
        {section.verses.map((n) => {
          const verse = aqidaVerse(n);
          const shown = resolveSlot(verse.translation, locale);
          return (
            <View key={n} style={{ marginTop: 28 }}>
              <TvFocusable block minHeight={180} label={L('Vers {n}', { n })}>
                {() => (
                  <View style={{ gap: 12 }}>
                    <Text allowFontScaling={false} style={{ color: TV_ON_CARD, fontSize: 28, fontWeight: '800' }}>{L('Vers {n}', { n })}</Text>
                    <Text allowFontScaling={false} style={{ color: TV_ON_CARD, fontFamily: font, fontSize: Math.max(48, TV_ARABIC_MIN), lineHeight: 86, textAlign: 'right' }}>{verse.arabic}</Text>
                    {locale !== 'ar' ? <Text allowFontScaling={false} style={{ color: TV_ON_CARD, fontSize: 32, lineHeight: 44 }}>{shown.text}</Text> : null}
                    <Text allowFontScaling={false} style={{ color: TV_BADGE_ON_CARD, fontSize: 28, fontWeight: '800' }}>{L(shown.flag)}</Text>
                  </View>
                )}
              </TvFocusable>
            </View>
          );
        })}
        {attrs.map((a) => (
          <View key={a.id} style={{ marginTop: 28 }}>
            <TvFocusable block minHeight={160} label={a.transliteration}>
              {() => (
                <View style={{ gap: 10 }}>
                  <Text allowFontScaling={false} style={{ color: TV_ON_CARD, fontFamily: font, fontSize: Math.max(48, TV_ARABIC_MIN), lineHeight: 80, textAlign: 'right' }}>{a.arabic}</Text>
                  <Text allowFontScaling={false} style={{ color: TV_ON_CARD, fontSize: 28 }}>{a.transliteration}</Text>
                  <Text allowFontScaling={false} style={{ color: TV_ON_CARD, fontFamily: font, fontSize: 36, lineHeight: 64, textAlign: 'right' }}>{a.opposite.arabic}</Text>
                  <Text allowFontScaling={false} style={{ color: TV_BADGE_ON_CARD, fontSize: 28, fontWeight: '800' }}>{L(a.scholarFlag)}</Text>
                </View>
              )}
            </TvFocusable>
          </View>
        ))}
        <TvRow>
          <TvBack />
        </TvRow>
      </TvScroll>
      </View>
    </TvPremiumGate>
  );
}
