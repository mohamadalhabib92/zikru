import { Stack } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, View } from 'react-native';
import { L } from '@/lib/l10n';
import { useAuth } from '@/lib/community/auth';
import { isPlatformModerator, moderationBackend, type QueueFilter, type QueueItem, type ReportStatus } from '@/lib/community/moderation-api';
import { Badge, Body, Button, Card, DemoBanner, Field, H1, Muted, Notice, Row, Screen, Segmented, Spacer } from '@/ui/kit';

/**
 * File de modération de la plateforme (Passe 6). Visible seulement pour le rôle serveur « moderator » ou « admin » ;
 * le serveur revérifie le rôle à chaque appel. L'identité de la personne qui signale n'est jamais affichée.
 * Les signalements « Sécurité d'un enfant » puis « Personne en danger » / « Violence » passent en premier.
 */
const REASON: Record<string, string> = {
  harassment: 'Harcèlement',
  spam: 'Spam',
  hate: 'Haine',
  sexual: 'Contenu sexuel',
  violence: 'Violence ou menace',
  self_harm: 'Personne en danger',
  impersonation: 'Usurpation d’identité',
  child_safety: 'Sécurité d’un enfant',
  other: 'Autre',
};
const TARGET: Record<string, string> = {
  group_message: 'Message de groupe',
  message: 'Message privé',
  member: 'Membre',
  circle: 'Cercle',
  session: 'Séance',
};
const STATUS: Record<ReportStatus, string> = { open: 'Nouveau', reviewing: 'En cours d’examen', actioned: 'Traité', dismissed: 'Classé sans suite' };

function ask(title: string, text: string, ok: string, onOk: () => void) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.confirm(`${L(title)}\n\n${L(text)}`)) onOk();
    return;
  }
  Alert.alert(L(title), L(text), [
    { text: L('Annuler'), style: 'cancel' },
    { text: L(ok), style: 'destructive', onPress: onOk },
  ]);
}

export default function Moderation() {
  const auth = useAuth();
  const be = moderationBackend();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [filter, setFilter] = useState<QueueFilter>('pending');
  const [items, setItems] = useState<QueueItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const signedIn = be.demo || (auth.enabled && !!auth.session);

  useEffect(() => {
    if (!signedIn) return;
    let alive = true;
    be.roles()
      .then((r) => alive && setAllowed(isPlatformModerator(r)))
      .catch(() => alive && setAllowed(false));
    return () => {
      alive = false;
    };
  }, [be, signedIn]);

  const load = useCallback(async () => {
    setError(null);
    try {
      setItems(await be.list(filter));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [be, filter]);
  useEffect(() => {
    if (!allowed) return;
    let alive = true;
    be.list(filter)
      .then((r) => alive && setItems(r))
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      alive = false;
    };
  }, [allowed, be, filter]);

  const head = <Stack.Screen options={{ title: L('Modération') }} />;
  if (!signedIn || allowed === false) {
    return (
      <Screen>
        {head}
        <H1>Modération</H1>
        <Notice tone="info" title="Réservé à l’équipe de modération" text="Cet écran n’est accessible qu’aux comptes désignés par l’équipe Zikru." />
      </Screen>
    );
  }
  return (
    <Screen>
      {head}
      {be.demo ? <DemoBanner text="Démonstration : exemples fictifs, rien n’est envoyé." /> : null}
      <H1>Modération</H1>
      <Muted>Signalements de toute la plateforme. L’identité de la personne qui signale n’est jamais affichée. Chaque décision est enregistrée au journal de l’équipe.</Muted>
      <Spacer h={10} />
      <Segmented
        label="Afficher"
        options={[
          { label: 'En attente', value: 'pending' as const },
          { label: 'Traités', value: 'actioned' as const },
          { label: 'Classés', value: 'dismissed' as const },
        ]}
        value={filter}
        onChange={(v) => {
          setItems(null);
          setError(null);
          setFilter(v);
        }}
      />
      {error ? <Notice tone="danger" title={error} /> : null}
      {allowed === null || items === null ? (
        error ? null : <ActivityIndicator accessibilityLabel={L('Chargement…')} />
      ) : items.length === 0 ? (
        <Notice tone="success" title="Aucun signalement ici." />
      ) : (
        items.map((it) => <ReportCard key={it.id} it={it} onChanged={load} />)
      )}
    </Screen>
  );
}

function ReportCard({ it, onChanged }: { it: QueueItem; onChanged: () => Promise<void> }) {
  const be = moderationBackend();
  const [note, setNote] = useState(it.resolution ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const urgent = it.reason === 'child_safety' || it.reason === 'self_harm' || it.reason === 'violence';
  const pending = it.status === 'open' || it.status === 'reviewing';
  const run = (f: () => Promise<void>) => async () => {
    setBusy(true);
    setErr(null);
    try {
      await f();
      await onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const body = it.snapshot?.body;
  return (
    <Card style={{ marginBottom: 12 }}>
      <Row wrap>
        <Badge label={L(REASON[it.reason] ?? it.reason)} tone={urgent ? 'danger' : 'warning'} />
        <Badge label={L(TARGET[it.target_type] ?? it.target_type)} tone="neutral" />
        <Badge label={L(STATUS[it.status])} tone={pending ? 'info' : 'success'} />
      </Row>
      <Spacer h={6} />
      <Muted>
        {L('Signalé le {d}', { d: new Date(it.created_at).toLocaleString() })}
        {it.reports_on_user > 1 ? ` · ${L('{n} signalements visant ce compte', { n: it.reports_on_user })}` : ''}
      </Muted>
      {urgent ? <Notice tone="danger" title="Prioritaire" text="Danger possible pour une personne : traiter sans attendre et, si nécessaire, contacter les secours (112 / 144 en Suisse)." /> : null}
      {body !== undefined ? (
        <View style={{ marginTop: 8 }} accessible accessibilityLabel={L('Contenu signalé : {t}', { t: body || L('(effacé)') })}>
          <Muted>{it.snapshot?.sender_name ? L('Contenu signalé (auteur : {n})', { n: it.snapshot.sender_name }) : 'Contenu signalé'}</Muted>
          <Body>{body || L('(effacé)')}</Body>
        </View>
      ) : null}
      {it.details ? <Muted>{L('Précision : {t}', { t: it.details })}</Muted> : null}
      <Spacer h={8} />
      {pending ? (
        <>
          <Field label="Note de décision (facultatif)" value={note} onChangeText={setNote} maxLength={1000} />
          <Row wrap>
            {it.status === 'open' ? <Button title="Examiner" variant="secondary" disabled={busy} onPress={run(() => be.setStatus(it.id, 'reviewing'))} /> : null}
            {it.target_type === 'group_message' && body ? (
              <Button
                title="Supprimer le message"
                variant="danger"
                icon="trash-outline"
                disabled={busy}
                onPress={() =>
                  ask('Supprimer ce message pour tout le groupe ?', 'Une copie reste au journal de l’équipe.', 'Supprimer', run(async () => {
                    await be.deleteGroupMessage(it.id);
                    await be.setStatus(it.id, 'actioned', note || L('Message supprimé'));
                  }))
                }
              />
            ) : null}
            <Button title="Marquer traité" disabled={busy} onPress={run(() => be.setStatus(it.id, 'actioned', note))} />
            <Button title="Classer sans suite" variant="ghost" disabled={busy} onPress={run(() => be.setStatus(it.id, 'dismissed', note))} />
          </Row>
        </>
      ) : it.resolution ? (
        <Muted>{L('Décision : {t}', { t: it.resolution })}</Muted>
      ) : null}
      {err ? <Notice tone="danger" title={err} /> : null}
    </Card>
  );
}
