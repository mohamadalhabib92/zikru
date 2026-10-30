import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text } from '@/ui/Text';
import * as api from '@/lib/community/api';
import { useAuth } from '@/lib/community/auth';
import { Button, Card, Field, H1, H2, Muted, Notice, Screen, Spacer, Toggle } from '@/ui/kit';
import { theme as t } from '@/ui/theme';
import { roleFr } from '@/components/community/parts';
import { L } from '@/lib/l10n';

/** Rejoindre une famille ou un cercle avec un code (lien zikru://join?code=… ou …/zikru/join?code=…). */
export default function Join() {
  const { code: raw } = useLocalSearchParams<{ code?: string }>();
  const code = String(raw ?? '').toUpperCase();
  const auth = useAuth();
  const [p, setP] = useState<api.InvitePreview | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [name, setName] = useState(auth.displayName);
  const [accept, setAccept] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => setName(auth.displayName), [auth.displayName]);
  useEffect(() => {
    if (!auth.session || !code) return;
    api
      .previewInvitation(code)
      .then(setP)
      .catch((e) => setErr(api.frError(e)));
  }, [auth.session, code]);

  if (!auth.session) {
    return (
      <Screen>
        <Stack.Screen options={{ title: L("Invitation") }} />
        <H1>Invitation</H1>
        {code ? <Muted>Code : {code}</Muted> : null}
        <Spacer />
        <Notice tone="info" title="Connexion requise" text="Connectez-vous avec votre e-mail, puis revenez saisir ce code (Communauté › Rejoindre avec un code)." />
        <Spacer />
        <Button icon="mail-outline" title="Se connecter" onPress={() => router.push('/auth')} />
      </Screen>
    );
  }
  return (
    <Screen>
      <Stack.Screen options={{ title: L("Invitation") }} />
      <H1>Invitation</H1>
      {err ? <Notice tone="warning" title="Invitation" text={err} /> : null}
      {p && !p.valid ? <Notice tone="warning" title="Invitation non valable" text="Ce code est invalide, expiré, révoqué ou déjà utilisé. Demandez-en un nouveau." /> : null}
      {p?.valid ? (
        <Card>
          <Muted>{p.scope_type === 'family' ? 'Famille' : 'Cercle de proches'}</Muted>
          <H2>{p.name}</H2>
          <Muted>
            {L('Rôle : {role}', { role: roleFr(p.role ?? '') })} · {p.max_members ? L('{n} / {max} personnes', { n: p.members ?? 0, max: p.max_members }) : L('{n} personne(s)', { n: p.members ?? 0 })}
          </Muted>
          {p.full ? <Notice tone="warning" title="Groupe complet" text={L('Ce groupe est complet ({n} personnes maximum, créateur inclus).', { n: p.max_members ?? 0 })} /> : null}
          {p.expires_at ? <Muted>Valable jusqu’au {new Date(p.expires_at).toLocaleDateString('fr-CH')}</Muted> : null}
          <Spacer />
          {p.role === 'child' ? <Notice tone="info" title="Compte enfant" text="Vos parents gèrent vos réglages. Vous ne pourrez pas rejoindre de cercles en dehors de la famille." /> : null}
          <Field label="Votre nom ici" value={name} onChangeText={setName} maxLength={60} />
          {p.scope_type === 'circle' && p.rules ? (
            <>
              <Text style={{ color: t.text, fontWeight: '700' }}>Règlement du cercle</Text>
              <Muted>{p.rules}</Muted>
              <Spacer h={8} />
              <Toggle label="J’accepte le règlement" value={accept} onChange={setAccept} />
            </>
          ) : null}
          <Button
            title="Rejoindre"
            icon="enter-outline"
            loading={busy}
            disabled={!!p.full || !name.trim() || (p.scope_type === 'circle' && !!p.rules && !accept)}
            onPress={async () => {
              setBusy(true);
              try {
                const r = await api.acceptInvitation(code, name.trim(), accept);
                await auth.refreshProfile();
                router.replace(r.scope_type === 'family' ? `/family/${r.id}` : `/circle/${r.id}`);
              } catch (e) {
                setErr(api.frError(e));
              } finally {
                setBusy(false);
              }
            }}
          />
        </Card>
      ) : null}
    </Screen>
  );
}
