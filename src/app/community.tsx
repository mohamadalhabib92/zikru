import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { Text } from '@/ui/Text';
import { LocalGroups } from '@/components/LocalGroups';
import { confirmAsk, ErrorNote, useLoad } from '@/components/community/parts';
import * as api from '@/lib/community/api';
import { useAuth } from '@/lib/community/auth';
import { useCommunity } from '@/lib/community/sync';
import { HeroHeader } from '@/ui/ds';
import { Button, Card, Field, H2, Ionicons, ListItem, Muted, Notice, Row, Screen, Spacer, type IconName } from '@/ui/kit';
import { alpha, brand as b, theme as t } from '@/ui/theme';
import { L } from '@/lib/l10n';

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
        <CommunityHero title="Ma famille · Mes cercles" sub="Faites du dhikr ensemble, avec vos proches uniquement. Jamais d’annuaire public." features />
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
      <CommunityHero title={`Salām, ${auth.displayName}`} sub="Vos familles et cercles de dhikr." />
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

const FEATURES: { icon: IconName; label: string }[] = [
  { icon: 'flag', label: 'Objectifs communs' },
  { icon: 'moon', label: 'Zikr du soir à distance' },
  { icon: 'heart', label: 'Encouragements privés' },
];
function CommunityHero({ title, sub, features }: { title: string; sub: string; features?: boolean }) {
  return (
    <HeroHeader>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: alpha(b.gold, 0.18), alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="people" size={24} color={b.gold} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: b.heroMuted, fontSize: 12, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' }}>Communauté</Text>
          <Text style={{ color: b.heroText, fontSize: 22, fontWeight: '800' }}>{title}</Text>
        </View>
      </View>
      <Text style={{ color: b.heroMuted, marginTop: 10, lineHeight: 20 }}>{sub}</Text>
      {features ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
          {FEATURES.map((f) => (
            <View key={f.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: alpha('#FFFFFF', 0.1), borderWidth: 1, borderColor: alpha(b.gold, 0.35) }}>
              <Ionicons name={f.icon} size={14} color={b.gold} />
              <Text style={{ color: b.heroText, fontSize: 12, fontWeight: '700' }}>{f.label}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </HeroHeader>
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
        <ListItem key={f.id} icon="home-outline" title={f.name} subtitle={f.wird ? L('Wird : {w}', { w: f.wird }) : 'Famille privée'} onPress={() => router.push(`/family/${f.id}`)} />
      ))}
      {fams.data && !fams.data.length && !creating ? <Muted>Créez votre famille ou rejoignez-la avec le code reçu d’un parent.</Muted> : null}
      {profile?.is_minor ? null : creating ? (
        <Card>
          <Field label="Nom de la famille" placeholder={L("Famille Ba")} value={name} onChangeText={setName} />
          <Field label="Votre nom dans la famille" placeholder={L("Papa, Maman, Habib…")} value={me} onChangeText={setMe} error={err} />
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
          <Field label="Nom du cercle" placeholder={L("Cercle du jeudi")} value={name} onChangeText={setName} />
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
          <Field label="Code d’invitation" autoCapitalize="characters" autoCorrect={false} placeholder={L("ABCD2345EF")} value={code} onChangeText={setCode} />
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
