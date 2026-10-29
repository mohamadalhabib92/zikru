import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View, type ScrollViewInstance } from 'react-native';
import { Text } from '@/ui/Text';
import { AiConsentSheet } from '@/components/AiConsentSheet';
import { askBilal, BilalError, bilalErrorFr, type ChatMsg } from '@/lib/bilal';
import { useConsent } from '@/lib/consent';
import { canSendToAI } from '@/lib/privacy';
import { useAuth } from '@/lib/community/auth';
import { periodFor, PERIODS, REFLECTIONS } from '@/lib/reflections';
import { usePersistentState } from '@/lib/storage';
import { Button, Ionicons } from '@/ui/kit';
import { LMuted } from '@/ui/light';
import { brand as b } from '@/ui/theme';
import { L } from '@/lib/l10n';

const IND = b.purple;
const STARTERS = ['Comment être plus régulier dans mon wird ?', 'Je me sens loin de la prière ces jours-ci…', 'Une petite habitude pour mieux commencer la journée ?', 'Comment gérer la colère selon la Sunna ?'];

export default function Bilal() {
  const router = useRouter();
  const auth = useAuth();
  const [consent, choose, consentReady] = useConsent();
  const allowed = canSendToAI(consent, consentReady);
  const [msgs, setMsgs] = usePersistentState<ChatMsg[]>('bilal-chat', []);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const scroll = useRef<ScrollViewInstance>(null);
  const p = periodFor();
  const fallback = REFLECTIONS[p][new Date().getDate() % REFLECTIONS[p].length];

  const send = async (text: string) => {
    const t = text.trim();
    if (!t || busy || !allowed) return;
    setErr(null);
    const next: ChatMsg[] = [...msgs, { role: 'user', content: t }];
    setMsgs(next.slice(-40));
    setInput('');
    setBusy(true);
    try {
      const reply = await askBilal({ mode: 'chat', messages: next.slice(-12) });
      setMsgs([...next, { role: 'assistant' as const, content: reply }].slice(-40));
    } catch (e) {
      if (e instanceof BilalError && e.code === 'not_configured') setUnavailable(true);
      setErr(bilalErrorFr(e));
    } finally {
      setBusy(false);
      setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
    }
  };

  // Consentement explicite avant tout envoi à l'IA (fail closed : rien tant que le stockage n'est pas lu).
  if (!consentReady) return <View style={{ flex: 1, backgroundColor: b.cream }} />;
  if (!allowed) {
    return (
      <AiConsentSheet
        onAccept={() => choose('ai', true)}
        onDecline={() => {
          choose('ai', false);
          if (router.canGoBack()) router.back();
          else router.replace('/');
        }}
      />
    );
  }

  if (auth.enabled && auth.ready && !auth.session) {
    return (
      <View style={{ flex: 1, backgroundColor: b.cream, padding: 24, justifyContent: 'center', alignItems: 'center' }}>
        <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: IND, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="chatbubbles" size={34} color="#fff" />
        </View>
        <Text style={{ color: b.ink, fontSize: 22, fontWeight: '900', marginTop: 12 }}>El Ghaly Bilal</Text>
        <LMuted style={{ textAlign: 'center', marginTop: 6, marginBottom: 16 }}>Votre compagnon de cheminement. Connectez-vous pour discuter avec lui (gratuit, limité à quelques messages par jour).</LMuted>
        <Button title="Se connecter" icon="log-in" onPress={() => router.push('/auth')} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: b.cream }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <ScrollView ref={scroll} contentContainerStyle={{ padding: 16, paddingBottom: 24, maxWidth: 760, width: '100%', alignSelf: 'center' }} onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: false })}>
        <View style={{ backgroundColor: IND, borderRadius: 18, padding: 16, marginBottom: 12 }}>
          <Text style={{ color: '#fff', fontWeight: '900', fontSize: 18 }}>As-salamu ‘alaykum 👋</Text>
          <Text style={{ color: 'rgba(255,255,255,0.9)', marginTop: 4, lineHeight: 20 }}>
            Je suis El Ghaly Bilal, un compagnon pour vos habitudes, votre régularité et votre moral. Je ne suis ni un savant ni un médecin : pour une question de fiqh, consultez un imam ou votre muqaddam.
          </Text>
        </View>
        {unavailable ? (
          <View style={{ backgroundColor: b.goldSoft, borderRadius: 16, borderWidth: 1, borderColor: b.gold, padding: 14, marginBottom: 12 }}>
            <Text style={{ color: b.ink, fontWeight: '800' }}>Bientôt disponible, inch’Allah</Text>
            <Text style={{ color: b.ink, marginTop: 6 }}>{PERIODS[p].title}</Text>
            <Text style={{ color: b.ink, marginTop: 4, lineHeight: 20 }}>{fallback}</Text>
          </View>
        ) : null}
        {msgs.length === 0 && !unavailable ? (
          <View style={{ gap: 8, marginBottom: 12 }}>
            <LMuted>Pour commencer :</LMuted>
            {STARTERS.map((s) => (
              <Pressable key={s} accessibilityRole="button" onPress={() => send(s)} style={{ backgroundColor: b.paper, borderRadius: 14, borderWidth: 1, borderColor: b.line, padding: 12 }}>
                <Text style={{ color: IND, fontWeight: '700' }}>{s}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        {msgs.map((m, i) => (
          <View key={i} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%', backgroundColor: m.role === 'user' ? IND : b.paper, borderRadius: 16, borderWidth: m.role === 'user' ? 0 : 1, borderColor: b.line, padding: 12, marginBottom: 8 }}>
            <Text style={{ color: m.role === 'user' ? '#fff' : b.ink, lineHeight: 21 }}>{m.content}</Text>
          </View>
        ))}
        {busy ? <ActivityIndicator color={IND} style={{ alignSelf: 'flex-start', margin: 8 }} /> : null}
        {err ? <Text style={{ color: b.rust, marginTop: 6 }}>{err}</Text> : null}
        {msgs.length ? (
          <Pressable accessibilityRole="button" onPress={() => setMsgs([])} style={{ alignSelf: 'center', padding: 8, marginTop: 6 }}>
            <Text style={{ color: b.inkMuted, fontSize: 12 }}>Effacer la conversation</Text>
          </Pressable>
        ) : null}
      </ScrollView>
      <View style={{ flexDirection: 'row', gap: 8, padding: 10, borderTopWidth: 1, borderTopColor: b.line, backgroundColor: b.paper }}>
        <TextInput value={input} onChangeText={setInput} placeholder={L("Écrivez à Bilal…")} placeholderTextColor={b.inkMuted} multiline maxLength={1000} accessibilityLabel={L("Message à Bilal")} style={{ flex: 1, maxHeight: 120, minHeight: 44, borderRadius: 22, borderWidth: 1, borderColor: b.line, paddingHorizontal: 14, paddingVertical: 10, color: b.ink, backgroundColor: b.cream }} />
        <Pressable accessibilityRole="button" accessibilityLabel={L("Envoyer")} disabled={busy || !input.trim()} onPress={() => send(input)} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: busy || !input.trim() ? b.line : IND, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-end' }}>
          <Ionicons name="send" size={20} color="#fff" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
