import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { LocalGroups } from '@/components/LocalGroups';
import { confirmAsk, ErrorNote, useLoad } from '@/components/community/parts';
import * as api from '@/lib/community/api';
import { useAuth } from '@/lib/community/auth';
import { useCommunity } from '@/lib/community/sync';
import { Button, Card, Eyebrow, Field, H1, H2, ListItem, Muted, Notice, Row, Screen, Spacer } from '@/ui/kit';
import { theme as t } from '@/ui/theme';

/**
 * Communauté : « Ma famille » (niveau 1, Usra) et « Mes cercles » (niveau 2, Ahbab).
 * Sans compte (ou hors-ligne), les groupes locaux restent disponibles.
 * Les niveaux Locale, Régionale et Oumma viendront s'ajouter ici.
 */
export default function Community() {
  const auth = useAuth();
  const [showLocal, setShowLocal] = useState(false);
  if (!auth.enabled || !auth.session) {
    return (
      <Screen>
        <Eyebrow>Communauté</Eyebrow>
        <H1>Ma famille · Mes cercles</H1>
        <Muted>Faites du dhikr ensemble : objectifs communs, zikr du soir à distance, encouragements privés. Votre famille et vos proches uniquement, jamais d’annuaire public.</Muted>
        <Spacer />
        {auth.enabled ? (
          <Card>
            <H2>Se connecter</H2>
            <Muted>Un code à 6 chiffres vous est envoyé par e-mail. Aucun mot de passe.</Muted>
            <Spacer h={8} />
            <Button icon="mail-outline" title="Continuer avec mon e-mail" onPress={() => router.push('/auth')} />
          </Card>
        ) : (
          <Notice tone="info" title="Mode local" text="Le serveur des communautés n’est pas configuré : seuls les groupes locaux sont disponibles." />
        )}
        <Spacer />
        <H2>Groupes locaux (sans compte)</H2>
        <LocalGroups />
      </Screen>
    );
  }
  return (
    <Screen>
      <Eyebrow>Communauté</Eyebrow>
      <H1>Salām, {auth.displayName}</H1>
      <SyncStatus />
      <MyFamilies />
      <Spacer />
      <MyCircles />
      <Spacer />
      <JoinWithCode />
      <Spacer />
      <Account />
      <Spacer />
      <Button variant="ghost" icon="phone-portrait-outline" title={showLocal ? 'Masquer les groupes locaux' : 'Groupes locaux (hors-ligne)'} onPress={() => setShowLocal(!showLocal)} />
      {showLocal ? <LocalGroups /> : null}
    </Screen>
  );
}

function SyncStatus() {
  const c = useCommunity();
  if (!c.pending && !c.syncError && !c.links.length) return null;
  return (
    <View style={{ marginTop: 8 }}>
      {c.links.length ? <Muted>Tasbih relié à : {c.links.map((l) => `${l.title} (${l.scopeName})`).join(', ')}</Muted> : null}
      {c.pending ? <Muted>{c.pending} dhikr en attente d’envoi…</Muted> : null}
      {c.syncError ? <Muted style={{ color: t.warning }}>{c.syncError}</Muted> : null}
    </View>
  );
}

function MyFamilies() {
  const { displayName, profile } = useAuth();
  const fams = useLoad(() => api.listFamilies(), []);
  useFocusEffect(
    useCallback(() => {
      void fams.reload();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [me, setMe] = useState(displayName);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <View>
      <H2>Ma famille</H2>
      <ErrorNote error={fams.error} onRetry={fams.reload} />
      {fams.data?.map((f) => (
        <ListItem key={f.id} icon="home-outline" title={f.name} subtitle={f.wird ? `Wird : ${f.wird}` : 'Famille privée'} onPress={() => router.push(`/family/${f.id}`)} />
      ))}
      {fams.data && !fams.data.length && !creating ? <Muted>Créez votre famille ou rejoignez-la avec le code reçu d’un parent.</Muted> : null}
      {profile?.is_minor ? null : creating ? (
        <Card>
          <Field label="Nom de la famille" placeholder="Famille Ba" value={name} onChangeText={setName} />
          <Field label="Votre nom dans la famille" placeholder="Papa, Maman, Habib…" value={me} onChangeText={setMe} error={err} />
          <Muted>Vous serez parent administrateur (2 parents maximum).</Muted>
          <Spacer h={8} />
          <Row gap={8}>
            <Button
              title="Créer"
              icon="add"
              loading={busy}
              onPress={async () => {
                if (!name.trim() || !me.trim()) return setErr('Nom requis.');
                setBusy(true);
                try {
                  const id = await api.createFamily(name.trim(), me.trim());
                  setCreating(false);
                  router.push(`/family/${id}`);
                } catch (e) {
                  setErr(api.frError(e));
                } finally {
                  setBusy(false);
                }
              }}
            />
            <Button title="Annuler" variant="ghost" onPress={() => setCreating(false)} />
          </Row>
        </Card>
      ) : (
        <Button small variant="secondary" icon="home-outline" title="Créer une famille" onPress={() => setCreating(true)} />
      )}
    </View>
  );
}

function MyCircles() {
  const { displayName, profile } = useAuth();
  const list = useLoad(() => api.listCircles(), []);
  useFocusEffect(
    useCallback(() => {
      void list.reload();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [rules, setRules] = useState('Bienveillance, discrétion et sincérité. Pas de comparaison, pas de jugement.');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (profile?.is_minor) return null; // les mineurs ne rejoignent pas de cercles (protection)
  return (
    <View>
      <H2>Mes cercles</H2>
      <Muted>Vos proches (Ahbab) : 50 personnes maximum, sur invitation uniquement.</Muted>
      <ErrorNote error={list.error} onRetry={list.reload} />
      {list.data?.map((c) => (
        <ListItem key={c.id} icon="people-outline" title={c.name} subtitle={c.description ?? 'Cercle privé'} onPress={() => router.push(`/circle/${c.id}`)} />
      ))}
      {creating ? (
        <Card>
          <Field label="Nom du cercle" placeholder="Cercle du jeudi" value={name} onChangeText={setName} />
          <Field label="Description (facultatif)" value={desc} onChangeText={setDesc} />
          <Field label="Règlement (accepté par chaque membre)" value={rules} onChangeText={setRules} multiline error={err} />
          <Row gap={8}>
            <Button
              title="Créer"
              icon="add"
              loading={busy}
              onPress={async () => {
                if (!name.trim()) return setErr('Nom requis.');
                setBusy(true);
                try {
                  const id = await api.createCircle(name.trim(), desc.trim(), rules.trim(), displayName);
                  setCreating(false);
                  router.push(`/circle/${id}`);
                } catch (e) {
                  setErr(api.frError(e));
                } finally {
                  setBusy(false);
                }
              }}
            />
            <Button title="Annuler" variant="ghost" onPress={() => setCreating(false)} />
          </Row>
        </Card>
      ) : (
        <Button small variant="secondary" icon="people-outline" title="Créer un cercle" onPress={() => setCreating(true)} />
      )}
    </View>
  );
}

function JoinWithCode() {
  const [code, setCode] = useState('');
  return (
    <Card>
      <H2>Rejoindre avec un code</H2>
      <Row gap={8}>
        <View style={{ flex: 1 }}>
          <Field label="Code d’invitation" autoCapitalize="characters" autoCorrect={false} placeholder="ABCD2345EF" value={code} onChangeText={setCode} />
        </View>
        <Button small title="Voir" disabled={code.trim().length < 6} onPress={() => router.push({ pathname: '/join', params: { code: code.trim().toUpperCase() } })} />
      </Row>
    </Card>
  );
}

function Account() {
  const auth = useAuth();
  const [name, setName] = useState(auth.displayName);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  return (
    <Card>
      <H2>Mon compte</H2>
      <Muted>{auth.email}</Muted>
      <Spacer h={8} />
      <Field label="Mon prénom (affiché à ma famille et mes cercles)" value={name} onChangeText={(v) => (setName(v), setSaved(false))} error={err} />
      <Row wrap gap={8}>
        <Button
          small
          title={saved ? 'Enregistré ✓' : 'Enregistrer'}
          onPress={() =>
            void auth
              .setDisplayName(name)
              .then(() => setSaved(true))
              .catch((e) => setErr(api.frError(e)))
          }
        />
        <Button small variant="secondary" icon="log-out-outline" title="Se déconnecter" onPress={() => void auth.signOut()} />
      </Row>
      <Spacer h={8} />
      <Button
        small
        variant="ghost"
        icon="trash-outline"
        title="Supprimer mon compte"
        onPress={() =>
          confirmAsk(
            'Supprimer définitivement le compte ?',
            'Votre profil, vos contributions et vos appartenances sont effacés. Une famille dont vous êtes le seul adulte est supprimée. Vos données locales (tasbih, groupes locaux) restent sur cet appareil.',
            'Supprimer',
            () => void auth.deleteAccount().catch((e) => setErr(api.frError(e))),
          )
        }
      />
    </Card>
  );
}
