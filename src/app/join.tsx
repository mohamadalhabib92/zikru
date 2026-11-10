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
  const { code: raw, ask, gid } = useLocalSearchParams<{ code?: string; ask?: string; gid?: string }>();
  const askScope = ask === 'family' || ask === 'circle' ? ask : null;
  const askId = typeof gid === 'string' ? gid : '';
  const code = String(raw ?? '').toUpperCase();
  const auth = useAuth();
  const [p, setP] = useState<api.InvitePreview | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [nameFrom, setNameFrom] = useState(auth.displayName);
  const [name, setName] = useState(auth.displayName);
  if (auth.displayName !== nameFrom) {
    setNameFrom(auth.displayName);
    setName(auth.displayName);
  }
  const [accept, setAccept] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [sent, setSent] = useState(false);
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
        <Notice tone="info" title="Connexion requise" text="Connectez-vous avec votre e-mail : l’invitation s’ouvrira ensuite toute seule, sans ressaisir le code." />
        <Spacer />
        <Button icon="mail-outline" title="Se connecter" onPress={() => void (code ? api.rememberPendingJoin(code) : Promise.resolve()).finally(() => router.push('/auth'))} />
      </Screen>
    );
  }
  return (
    <Screen>
      <Stack.Screen options={{ title: L(askScope && !code ? 'Demander à rejoindre' : 'Invitation') }} />
      <H1>{askScope && !code ? L('Demander à rejoindre') : 'Invitation'}</H1>
      {askScope && askId && !code ? (
        <Card>
          <Muted>{L('Votre demande part à l’administrateur. Rejoindre ne demande pas Premium.')}</Muted>
          <Field label="Votre nom ici" value={name} onChangeText={setName} maxLength={60} />
          <Field label={L('Message (facultatif)')} value={note} onChangeText={setNote} maxLength={280} />
          {sent ? <Notice tone="success" title={L('Demander à rejoindre')} text={L('Demande envoyée. L’administrateur doit l’accepter.')} /> : null}
          <Button
            title={L('Envoyer la demande')}
            icon="paper-plane-outline"
            loading={busy}
            disabled={!name.trim() || sent}
            onPress={async () => {
              setBusy(true);
              setErr(null);
              try {
                await api.requestGroupJoin(askScope, askId, name.trim(), note.trim());
                setSent(true);
              } catch (e) {
                setErr(api.frError(e));
              } finally {
                setBusy(false);
              }
            }}
          />
        </Card>
      ) : null}
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
