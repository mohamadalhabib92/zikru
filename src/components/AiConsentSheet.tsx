import { useRouter } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';
import { Text } from '@/ui/Text';
import { useSettings } from '@/lib/settings';
import { privacyText } from '@/lib/privacy-text';
import { Button, Ionicons } from '@/ui/kit';
import { brand as b } from '@/ui/theme';

/** Consentement explicite avant le premier envoi à l'IA (Bilal). Rien n'est envoyé tant qu'il n'est pas donné. */
export function AiConsentSheet({ onAccept, onDecline }: { onAccept: () => void; onDecline: () => void }) {
  const { s } = useSettings();
  const router = useRouter();
  const p = privacyText(s.lang);
  const rtl = s.lang === 'ar';
  const dir = { textAlign: rtl ? ('right' as const) : ('left' as const), writingDirection: rtl ? ('rtl' as const) : ('ltr' as const) };
  return (
    <ScrollView style={{ flex: 1, backgroundColor: b.cream }} contentContainerStyle={{ padding: 20, maxWidth: 640, width: '100%', alignSelf: 'center' }}>
      <View testID="ai-consent" style={{ backgroundColor: b.paper, borderRadius: 20, borderWidth: 1, borderColor: b.line, padding: 18 }}>
        <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: b.purple, alignItems: 'center', justifyContent: 'center', alignSelf: rtl ? 'flex-end' : 'flex-start' }}>
          <Ionicons name="shield-checkmark" size={28} color="#fff" />
        </View>
        <Text accessibilityRole="header" style={[{ color: b.ink, fontSize: 21, fontWeight: '900', marginTop: 12 }, dir]}>
          {p.ai_title}
        </Text>
        <Text style={[{ color: b.ink, marginTop: 8, lineHeight: 21 }, dir]}>{p.ai_intro}</Text>
        <View style={{ marginTop: 12, gap: 10 }}>
          {p.ai_points.map((x) => (
            <View key={x} style={{ flexDirection: rtl ? 'row-reverse' : 'row', gap: 8 }}>
              <Text style={{ color: b.purple, fontWeight: '900' }}>•</Text>
              <Text style={[{ color: b.ink, flex: 1, lineHeight: 20 }, dir]}>{x}</Text>
            </View>
          ))}
        </View>
        <Pressable accessibilityRole="link" onPress={() => router.push('/privacy')} style={{ paddingVertical: 10 }}>
          <Text style={[{ color: b.purple, fontWeight: '700', textDecorationLine: 'underline' }, dir]}>{p.policy_link}</Text>
        </Pressable>
        <Button title={p.ai_accept} icon="checkmark" onPress={onAccept} />
        <View style={{ height: 8 }} />
        <Button title={p.ai_decline} variant="ghost" onPress={onDecline} />
      </View>
    </ScrollView>
  );
}
