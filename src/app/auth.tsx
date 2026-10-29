import { router, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/ui/Text';
import { useAuth } from '@/lib/community/auth';
import { useConsent } from '@/lib/consent';
import { privacyText } from '@/lib/privacy-text';
import { useSettings } from '@/lib/settings';
import { brand as b } from '@/ui/theme';
import { Button, Card, Field, H1, Ionicons, Muted, Notice, Screen, Spacer } from '@/ui/kit';
import { L } from '@/lib/l10n';

/** Connexion par e-mail : code à usage unique (ou lien magique dans le même e-mail). */
export default function AuthScreen() {
  const auth = useAuth();
  const { s } = useSettings();
  const pt = privacyText(s.lang);
  const [consent, choose] = useConsent();
  const agreed = consent.account === true;
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [cool, setCool] = useState(0);
  useEffect(() => {
    if (auth.session) router.replace('/community');
  }, [auth.session]);
  useEffect(() => {
    if (cool <= 0) return;
    const i = setTimeout(() => setCool(cool - 1), 1000);
    return () => clearTimeout(i);
  }, [cool]);
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const send = async () => {
    setBusy(true);
    setErr(null);
    try {
      await auth.sendCode(email);
      setSent(true);
      setCool(60);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen>
      <Stack.Screen options={{ title: L("Connexion") }} />
      <H1>Connexion</H1>
      <Muted>Pour votre famille et vos cercles. Sans mot de passe : nous vous envoyons un code par e-mail.</Muted>
      <Spacer />
      {auth.linkError ? <Notice tone="warning" title="Lien de connexion" text={auth.linkError} /> : null}
      <Card>
        <Field
          label="Adresse e-mail"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          value={email}
          onChangeText={(v) => (setEmail(v), setSent(false))}
        />
        <Pressable
          testID="account-consent"
          accessibilityRole="checkbox"
          accessibilityState={{ checked: agreed }}
          onPress={() => choose('account', !agreed)}
          style={{ flexDirection: s.lang === 'ar' ? 'row-reverse' : 'row', gap: 10, alignItems: 'flex-start', paddingVertical: 10 }}
        >
          <Ionicons name={agreed ? 'checkbox' : 'square-outline'} size={24} color={agreed ? b.green : b.inkMuted} />
          <Text style={{ flex: 1, color: b.ink, lineHeight: 20, textAlign: s.lang === 'ar' ? 'right' : 'left' }}>{pt.account_check}</Text>
        </Pressable>
        <Pressable accessibilityRole="link" onPress={() => router.push('/privacy')} style={{ paddingBottom: 10 }}>
          <Text style={{ color: b.green, fontWeight: '700', textDecorationLine: 'underline' }}>{pt.policy_link}</Text>
        </Pressable>
        {!agreed ? (
          <View style={{ paddingBottom: 8 }}>
            <Text style={{ color: b.inkMuted, fontSize: 13 }}>{pt.account_required}</Text>
          </View>
        ) : null}
        {!sent ? (
          <Button title="Recevoir un code" icon="mail-outline" disabled={!valid || !agreed} loading={busy} onPress={send} />
        ) : (
          <>
            <Notice tone="success" title="E-mail envoyé" text="Saisissez le code reçu, ou touchez le lien dans l’e-mail depuis cet appareil. Pensez aux indésirables." />
            <Spacer h={8} />
            <Field
              label="Code reçu"
              keyboardType="number-pad"
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              maxLength={10}
              value={code}
              onChangeText={setCode}
            />
            <Button
              title="Valider"
              icon="checkmark"
              disabled={!agreed || code.replace(/\D/g, '').length < 6}
              loading={busy}
              onPress={async () => {
                setBusy(true);
                setErr(null);
                try {
                  await auth.verifyCode(email, code);
                } catch (e) {
                  setErr((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            />
            <Spacer h={8} />
            <Button variant="ghost" title={cool > 0 ? L('Renvoyer le code ({n} s)', { n: cool }) : 'Renvoyer le code'} disabled={cool > 0} onPress={send} />
          </>
        )}
        {err ? <Muted style={{ color: '#E57373', marginTop: 8 }}>{err}</Muted> : null}
      </Card>
      <Spacer />
      <Muted>Les enfants n’ont pas besoin d’adresse : un parent peut les ajouter comme « enfant géré » dans la famille.</Muted>
    </Screen>
  );
}
