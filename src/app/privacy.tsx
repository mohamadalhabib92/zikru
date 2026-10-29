import { Stack } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/ui/Text';
import { policyLang, type PolicyLang } from '@/lib/privacy';
import { POLICY } from '@/lib/privacy-policy';
import { useSettings } from '@/lib/settings';
import { Screen } from '@/ui/kit';
import { brand as b } from '@/ui/theme';

const LABELS: Record<PolicyLang, string> = { fr: 'Français', en: 'English', ar: 'العربية' };

/** Politique de confidentialité dans l'app (même source que la page publique). */
export default function PrivacyScreen() {
  const { s } = useSettings();
  const [lang, setLang] = useState<PolicyLang>(policyLang(s.lang));
  const pol = POLICY[lang];
  const rtl = lang === 'ar';
  const dir = { textAlign: rtl ? ('right' as const) : ('left' as const), writingDirection: rtl ? ('rtl' as const) : ('ltr' as const) };
  return (
    <Screen>
      <Stack.Screen options={{ title: pol.title }} />
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {(Object.keys(LABELS) as PolicyLang[]).map((l) => (
          <Pressable key={l} accessibilityRole="button" accessibilityState={{ selected: l === lang }} onPress={() => setLang(l)} style={{ paddingHorizontal: 12, minHeight: 36, justifyContent: 'center', borderRadius: 18, borderWidth: 1, borderColor: l === lang ? b.green : b.line, backgroundColor: l === lang ? b.green : b.paper }}>
            <Text style={{ color: l === lang ? '#fff' : b.ink, fontWeight: '600' }}>{LABELS[l]}</Text>
          </Pressable>
        ))}
      </View>
      <Text accessibilityRole="header" style={[{ color: b.ink, fontSize: 22, fontWeight: '900' }, dir]}>
        {pol.title}
      </Text>
      <Text style={[{ color: b.inkMuted, marginTop: 4 }, dir]}>{pol.updated}</Text>
      {pol.prevails ? <Text style={[{ color: b.inkMuted, marginTop: 4, fontStyle: 'italic' }, dir]}>{pol.prevails}</Text> : null}
      <Text style={[{ color: b.ink, marginTop: 12, lineHeight: 22 }, dir]}>{pol.lead}</Text>
      {pol.sections.map((sec) => (
        <View key={sec.id} style={{ marginTop: 18 }}>
          <Text accessibilityRole="header" style={[{ color: b.ink, fontSize: 17, fontWeight: '800', marginBottom: 6 }, dir]}>
            {sec.h}
          </Text>
          {sec.p?.map((x) => (
            <Text key={x} selectable style={[{ color: b.ink, lineHeight: 21, marginBottom: 6 }, dir]}>
              {x}
            </Text>
          ))}
          {sec.li?.map((x) => (
            <View key={x} style={{ flexDirection: rtl ? 'row-reverse' : 'row', gap: 8, marginBottom: 6 }}>
              <Text style={{ color: b.green }}>•</Text>
              <Text selectable style={[{ color: b.ink, lineHeight: 21, flex: 1 }, dir]}>
                {x}
              </Text>
            </View>
          ))}
        </View>
      ))}
      <View style={{ height: 32 }} />
    </Screen>
  );
}
