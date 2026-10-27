import { router, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/community/auth';
import { Button, Card, Field, H1, Muted, Notice, Screen, Spacer } from '@/ui/kit';

/** Connexion par e-mail : code à usage unique (ou lien magique dans le même e-mail). */
export default function AuthScreen() {
  const auth = useAuth();
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
      <Stack.Screen options={{ title: 'Connexion' }} />
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
        {!sent ? (
          <Button title="Recevoir un code" icon="mail-outline" disabled={!valid} loading={busy} onPress={send} />
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
              disabled={code.replace(/\D/g, '').length < 6}
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
            <Button variant="ghost" title={cool > 0 ? `Renvoyer le code (${cool} s)` : 'Renvoyer le code'} disabled={cool > 0} onPress={send} />
          </>
        )}
        {err ? <Muted style={{ color: '#E57373', marginTop: 8 }}>{err}</Muted> : null}
      </Card>
      <Spacer />
      <Muted>Les enfants n’ont pas besoin d’adresse : un parent peut les ajouter comme « enfant géré » dans la famille.</Muted>
    </Screen>
  );
}
