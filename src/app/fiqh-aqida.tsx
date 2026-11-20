import { useRouter } from 'expo-router';
import { FlatList, Pressable, View } from 'react-native';
import { Text } from '@/ui/Text';
import { AQIDA_EDITION, AQIDA_INTRO, AQIDA_SCHOLAR_FLAG, AQIDA_SECTIONS } from '@/lib/aqida-murshid';
import { CONTENT_LOCALES, resolveSlot, type ContentLocale } from '@/lib/religious-locale';
import { Screen } from '@/ui/kit';
import { brand as b } from '@/ui/theme';
import { L, useUiLang } from '@/lib/l10n';

const asLocale = (l: string): ContentLocale => ((CONTENT_LOCALES as readonly string[]).includes(l) ? (l as ContentLocale) : 'fr');

export default function AqidaIndex() {
  const router = useRouter();
  const locale = asLocale(useUiLang());
  const intro = resolveSlot(AQIDA_INTRO, locale);
  return (
    <Screen padded={false} bg={b.cream}>
      <FlatList
        data={AQIDA_SECTIONS}
        keyExtractor={(s) => s.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 40, maxWidth: 760, width: '100%', alignSelf: 'center' }}
        ListHeaderComponent={
          <View style={{ marginBottom: 14, gap: 8 }}>
            <Text style={{ color: b.ink, fontSize: 22, fontWeight: '900' }}>{L('Ce que l’on doit croire d’Allah')}</Text>
            <Text style={{ color: b.brown, fontWeight: '800' }}>{L('ʿAbd al-Wāḥid ibn ʿĀshir')}</Text>
            <Text style={{ color: b.inkMuted }}>{L('ʿAqīda ashʿarite, selon le matn d’Ibn ʿĀshir')}</Text>
            <Text style={{ alignSelf: 'flex-start', fontSize: 12, fontWeight: '800', color: b.brown, backgroundColor: b.goldSoft, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 }}>
              {L(AQIDA_SCHOLAR_FLAG)}
            </Text>
            <Text style={{ color: b.inkMuted, fontSize: 13, lineHeight: 19 }}>{AQIDA_EDITION}</Text>
            <Text style={{ color: b.brown, fontWeight: '800', marginTop: 4 }}>{L('Commentaire — ce n’est pas le matn')}</Text>
            <Text style={{ color: b.ink, lineHeight: 22 }}>{intro.text}</Text>
            <Text style={{ alignSelf: 'flex-start', fontSize: 12, fontWeight: '800', color: b.brown, backgroundColor: b.goldSoft, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 }}>
              {L(intro.flag)}
            </Text>
            <Text style={{ color: b.inkMuted, fontSize: 12 }}>{intro.source}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/fiqh-aqida-read', params: { id: item.id } })}
            style={{ backgroundColor: b.paper, borderRadius: 16, borderWidth: 1, borderColor: b.line, padding: 14, marginBottom: 10 }}
          >
            <Text style={{ color: b.ink, fontWeight: '800', fontSize: 16 }}>{L(item.title)}</Text>
            {item.sanusi ? <Text style={{ color: b.brown, marginTop: 4 }}>{L('Bloc distinct : structure d’Umm al-Barāhīn. Ce n’est pas un vers d’Ibn ʿĀshir.')}</Text> : null}
          </Pressable>
        )}
      />
    </Screen>
  );
}
