import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Platform, Share, Text, View } from 'react-native';
import { PWA_URL } from '@/lib/backend';
import * as api from '@/lib/community/api';
import { useAuth } from '@/lib/community/auth';
import { useCommunity } from '@/lib/community/sync';
import { Badge, Button, Card, Chip, Field, H2, Muted, Notice, Row, Segmented, Spacer } from '@/ui/kit';
import { theme as t } from '@/ui/theme';

export const fmt = (n: number) => n.toLocaleString('fr-CH');

/** Confirmation (Alert natif, window.confirm sur le web). */
export function confirmAsk(title: string, text: string, ok: string, onOk: () => void) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.confirm(`${title}\n\n${text}`)) onOk();
    return;
  }
  Alert.alert(title, text, [
    { text: 'Annuler', style: 'cancel' },
    { text: ok, style: 'destructive', onPress: onOk },
  ]);
}

/** Chargement simple avec erreur lisible et rechargement. */
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(fn, deps);
  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setData(await run());
      setError(null);
    } catch (e) {
      setError(api.frError(e));
    } finally {
      setLoading(false);
    }
  }, [run]);
  useEffect(() => {
    void reload();
  }, [reload]);
  return { data, error, loading, reload, setData };
}

export function ProgressBar({ value, target }: { value: number; target: number }) {
  const pct = target > 0 ? Math.min(1, value / target) : 0;
  return (
    <View style={{ height: 10, backgroundColor: t.surfaceAlt, borderRadius: 5, marginTop: 10 }} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: target, now: value }}>
      <View style={{ width: `${pct * 100}%`, height: 10, backgroundColor: pct >= 1 ? t.success : t.primary, borderRadius: 5 }} />
    </View>
  );
}

export function ErrorNote({ error, onRetry }: { error: string | null; onRetry?: () => void }) {
  if (!error) return null;
  return (
    <View>
      <Notice tone="warning" title="Impossible de charger" text={error} />
      {onRetry ? <Button small variant="secondary" icon="refresh" title="Réessayer" onPress={onRetry} /> : null}
      <Spacer h={8} />
    </View>
  );
}

const ROLE_FR: Record<string, string> = { parent: 'Parent', adult: 'Adulte', child: 'Enfant', guest: 'Invité·e', founder: 'Fondateur', moderator: 'Modérateur', member: 'Membre' };
export const roleFr = (r: string) => ROLE_FR[r] ?? r;

/** Objectif commun : avancée, détail par membre (selon les choix de partage), contribution. */
export function GoalCard({
  goal,
  scopeName,
  canAdmin,
  gentle,
  managedChildren = [],
}: {
  goal: api.Goal;
  scopeName: string;
  canAdmin: boolean;
  /** Mode enfant : pas de comparaison entre membres. */
  gentle?: boolean;
  managedChildren?: { id: string; name: string }[];
}) {
  const c = useCommunity();
  const [p, setP] = useState<api.GoalProgress | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [custom, setCustom] = useState('');
  const [forMember, setForMember] = useState<string | null>(null);
  const scopeId = (goal.family_id ?? goal.circle_id) as string;
  const load = useCallback(async () => {
    try {
      setP(await api.goalProgress(goal.id));
      setErr(null);
    } catch (e) {
      setErr(api.frError(e));
    }
  }, [goal.id]);
  useEffect(() => {
    void load();
    const i = setInterval(() => void load(), 15000);
    return () => clearInterval(i);
  }, [load]);
  // Recharge après chaque envoi réussi.
  useEffect(() => {
    if (c.lastSync) void load();
  }, [c.lastSync, load]);

  const total = p?.total ?? 0;
  const done = (p?.status ?? goal.status) === 'done' || total >= goal.target;
  const linked = c.isLinked(goal.id);
  const add = (n: number) => c.contribute(goal.id, n, 'manuel', forMember);
  return (
    <Card>
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <H2>{goal.title}</H2>
          {goal.formula ? <Muted>{goal.formula}</Muted> : null}
        </View>
        {done ? <Badge label="Objectif atteint" tone="success" /> : <Badge label={`${Math.round(Math.min(1, total / goal.target) * 100)} %`} tone="info" />}
      </Row>
      <ProgressBar value={total} target={goal.target} />
      <Text style={{ color: t.text, fontSize: 22, fontWeight: '800', marginTop: 8 }}>
        {fmt(total)} <Text style={{ color: t.muted, fontSize: 14, fontWeight: '400' }}>/ {fmt(goal.target)}</Text>
      </Text>
      {gentle ? (
        <Muted>{done ? 'Machā’Allāh, vous l’avez fait ensemble !' : 'Chaque dhikr compte. Ensemble, on avance doucement.'}</Muted>
      ) : p?.members.length ? (
        <View style={{ marginTop: 6 }}>
          {p.members.map((m, i) => (
            <Row key={(m.member_id ?? m.user_id ?? '') + i} style={{ justifyContent: 'space-between' }}>
              <Muted>
                {m.name} · {roleFr(m.role)}
              </Muted>
              <Muted>{m.count != null ? fmt(m.count) : m.participated ? 'a participé ✓' : '—'}</Muted>
            </Row>
          ))}
        </View>
      ) : null}
      {err ? <Muted style={{ color: t.danger }}>{err}</Muted> : null}
      {!done ? (
        <View style={{ marginTop: 10 }}>
          {managedChildren.length ? (
            <Row wrap gap={6} style={{ marginBottom: 8 }}>
              <Chip label="Pour moi" active={!forMember} onPress={() => setForMember(null)} />
              {managedChildren.map((m) => (
                <Chip key={m.id} label={`Pour ${m.name}`} active={forMember === m.id} onPress={() => setForMember(m.id)} />
              ))}
            </Row>
          ) : null}
          <Row wrap gap={8}>
            {[1, 33, 100].map((v) => (
              <Button key={v} small title={`+${v}`} variant="secondary" onPress={() => add(v)} />
            ))}
            <View style={{ flex: 1, minWidth: 90 }}>
              <Field label="Autre" keyboardType="number-pad" value={custom} onChangeText={setCustom} />
            </View>
            <Button
              small
              title="Ajouter"
              onPress={() => {
                add(parseInt(custom, 10));
                setCustom('');
              }}
            />
          </Row>
          <Button
            small
            variant={linked ? 'primary' : 'ghost'}
            icon={linked ? 'link' : 'link-outline'}
            title={linked ? 'Relié à mon tasbih ✓' : 'Relier à mon tasbih (et au compteur Bluetooth)'}
            onPress={() =>
              linked ? c.unlink(goal.id) : c.link({ goalId: goal.id, title: goal.title, scope: goal.scope_type, scopeId, scopeName, memberId: forMember })
            }
          />
          {linked && c.modes[scopeId] === 'nothing' ? <Muted>Votre choix de partage est « Rien » ici : vos appuis ne sont pas envoyés.</Muted> : null}
        </View>
      ) : null}
      {canAdmin ? (
        <Button
          small
          variant="ghost"
          icon="archive-outline"
          title="Archiver l’objectif"
          onPress={() => confirmAsk('Archiver cet objectif ?', 'Il ne sera plus affiché.', 'Archiver', () => void api.archiveGoal(goal.id).then(load).catch(() => {}))}
        />
      ) : null}
    </Card>
  );
}

export function NewGoal({ onCreate }: { onCreate: (g: { title: string; formula: string; target: number }) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [formula, setFormula] = useState('');
  const [target, setTarget] = useState('1000');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (!open) return <Button small variant="secondary" icon="flag-outline" title="Nouvel objectif commun" onPress={() => setOpen(true)} />;
  return (
    <Card>
      <H2>Nouvel objectif</H2>
      <Field label="Titre" placeholder="Salāt ‘alā n-Nabī" value={title} onChangeText={setTitle} />
      <Field label="Formule (facultatif)" placeholder="Allāhumma ṣalli ‘alā Muḥammad" value={formula} onChangeText={setFormula} />
      <Field label="Objectif" keyboardType="number-pad" value={target} onChangeText={setTarget} error={err} />
      <Row gap={8}>
        <Button
          title="Créer"
          icon="add"
          loading={busy}
          onPress={async () => {
            const n = parseInt(target, 10);
            if (!title.trim() || !(n > 0)) return setErr('Titre et objectif requis.');
            setBusy(true);
            try {
              await onCreate({ title: title.trim(), formula: formula.trim(), target: n });
              setOpen(false);
              setTitle('');
              setFormula('');
            } catch (e) {
              setErr(api.frError(e));
            } finally {
              setBusy(false);
            }
          }}
        />
        <Button title="Annuler" variant="ghost" onPress={() => setOpen(false)} />
      </Row>
    </Card>
  );
}

/** Création et partage d'une invitation (code à usage limité, qui expire). */
export function InvitePanel({ scope, scopeId, scopeName, roles }: { scope: api.ScopeType; scopeId: string; scopeName: string; roles: { label: string; value: string }[] }) {
  const [role, setRole] = useState(roles[0].value);
  const [uses, setUses] = useState(1);
  const [days, setDays] = useState(7);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const list = useLoad(() => api.listInvitations(scope, scopeId), [scope, scopeId]);
  const share = (code: string) => {
    const link = `${PWA_URL}join?code=${code}`;
    void Share.share({
      message: `Assalāmu ‘alaykum ! Rejoignez « ${scopeName} » sur Zikru.\nCode d’invitation : ${code}\nDans l’app : Communauté › Rejoindre avec un code, ou ouvrez ${link}`,
    }).catch(() => {});
  };
  return (
    <Card>
      <H2>Inviter</H2>
      <Segmented label="Rôle" options={roles} value={role} onChange={setRole} />
      <Segmented
        label="Utilisations"
        options={[
          { label: '1 personne', value: 1 },
          { label: '5', value: 5 },
          { label: '20', value: 20 },
        ]}
        value={uses}
        onChange={setUses}
      />
      <Segmented
        label="Valable"
        options={[
          { label: '1 jour', value: 1 },
          { label: '7 jours', value: 7 },
          { label: '30 jours', value: 30 },
        ]}
        value={days}
        onChange={setDays}
      />
      {err ? <Muted style={{ color: t.danger }}>{err}</Muted> : null}
      <Button
        icon="share-outline"
        title="Créer et partager le code"
        loading={busy}
        onPress={async () => {
          setBusy(true);
          try {
            const inv = await api.createInvitation(scope, scopeId, role, uses, days);
            setErr(null);
            share(inv.code);
            void list.reload();
          } catch (e) {
            setErr(api.frError(e));
          } finally {
            setBusy(false);
          }
        }}
      />
      {list.data?.length ? (
        <View style={{ marginTop: 10 }}>
          <Muted>Invitations actives</Muted>
          {list.data.map((i) => (
            <Row key={i.id} style={{ justifyContent: 'space-between', marginTop: 6 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: t.text, fontWeight: '700', letterSpacing: 1 }}>{i.code}</Text>
                <Muted style={{ fontSize: 12 }}>
                  {roleFr(i.role)} · {i.uses}/{i.max_uses} · jusqu’au {new Date(i.expires_at).toLocaleDateString('fr-CH')}
                </Muted>
              </View>
              <Button small variant="ghost" icon="share-outline" title="Partager" onPress={() => share(i.code)} />
              <Button small variant="ghost" icon="close" title="Révoquer" onPress={() => void api.revokeInvitation(i.id).then(list.reload).catch(() => {})} />
            </Row>
          ))}
        </View>
      ) : null}
    </Card>
  );
}

/** Choix de partage par lieu : rien / participation / compteur. */
export function SharingPicker({ scope, scopeId }: { scope: api.ScopeType; scopeId: string }) {
  const { userId } = useAuth();
  const c = useCommunity();
  const mode = c.modes[scopeId] ?? (scope === 'family' ? 'counter' : 'participation');
  const [err, setErr] = useState<string | null>(null);
  return (
    <Card>
      <H2>Ce que je partage ici</H2>
      <Segmented
        options={[
          { label: 'Rien', value: 'nothing' },
          { label: 'Participation', value: 'participation' },
          { label: 'Compteur', value: 'counter' },
        ]}
        value={mode}
        onChange={async (m: api.SharingMode) => {
          if (!userId) return;
          try {
            await api.setSharingMode(scope, scopeId, userId, m);
            await c.refreshModes();
            setErr(null);
          } catch (e) {
            setErr(api.frError(e));
          }
        }}
      />
      <Muted>
        {mode === 'nothing'
          ? 'Rien : vous n’apparaissez pas dans le détail et vos appuis reliés ne sont pas envoyés.'
          : mode === 'participation'
            ? 'Participation : les autres voient seulement que vous avez participé, jamais votre nombre.'
            : 'Compteur : votre nombre de dhikr est visible des membres de ce lieu.'}
      </Muted>
      {err ? <Muted style={{ color: t.danger }}>{err}</Muted> : null}
    </Card>
  );
}

/** Sessions de zikr en direct du lieu. */
export function LivePanel({ scope, scopeId }: { scope: api.ScopeType; scopeId: string }) {
  const { userId } = useAuth();
  const list = useLoad(() => api.liveSessions(scope, scopeId), [scope, scopeId]);
  const [title, setTitle] = useState('Zikr du soir');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <Card>
      <H2>Zikr en direct</H2>
      <Muted>Récitez ensemble à distance : chacun compte sur son téléphone ou sa bague, le total s’affiche en direct.</Muted>
      <Spacer h={8} />
      {list.data?.map((s) => (
        <Button key={s.id} icon="radio-outline" title={`Rejoindre : ${s.title}`} onPress={() => router.push(`/live/${s.id}`)} style={{ marginBottom: 8 }} />
      ))}
      <Row gap={8}>
        <View style={{ flex: 1 }}>
          <Field label="Nouvelle session" value={title} onChangeText={setTitle} />
        </View>
        <Button
          small
          title="Lancer"
          icon="play"
          loading={busy}
          onPress={async () => {
            if (!userId || !title.trim()) return;
            setBusy(true);
            try {
              const id = await api.startSession(scope, scopeId, userId, { title: title.trim() });
              router.push(`/live/${id}`);
            } catch (e) {
              setErr(api.frError(e));
            } finally {
              setBusy(false);
            }
          }}
        />
      </Row>
      {err ? <Muted style={{ color: t.danger }}>{err}</Muted> : null}
    </Card>
  );
}

const KINDS = [
  { value: 'bravo', label: 'Bravo', text: 'Bravo, machā’Allāh ! Continue ainsi.' },
  { value: 'dua', label: 'Du‘a', text: 'Qu’Allah te bénisse et facilite tes affaires.' },
  { value: 'rappel', label: 'Rappel', text: 'Petit rappel affectueux pour ton wird du jour.' },
  { value: 'salam', label: 'Salām', text: 'As-salāmu ‘alaykum, je pense à toi.' },
];

/** Encouragements privés (jamais publics, jamais de compteur). */
export function EncouragementsPanel({ scope, scopeId, recipients }: { scope: api.ScopeType; scopeId: string; recipients: { userId: string; name: string }[] }) {
  const { userId } = useAuth();
  const list = useLoad(() => api.listEncouragements(scope, scopeId), [scope, scopeId]);
  const [to, setTo] = useState<string | null>(null);
  const [kind, setKind] = useState('bravo');
  const [body, setBody] = useState(KINDS[0].text);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const nameOf = (id: string) => (id === userId ? 'Moi' : (recipients.find((r) => r.userId === id)?.name ?? 'Membre'));
  return (
    <Card>
      <H2>Encouragements</H2>
      <Muted>Messages privés et bienveillants, visibles seulement par l’expéditeur et le destinataire (et les parents pour les enfants).</Muted>
      <Spacer h={8} />
      {recipients.length ? (
        <>
          <Row wrap gap={6}>
            {recipients.map((r) => (
              <Chip key={r.userId} label={r.name} active={to === r.userId} onPress={() => setTo(r.userId)} />
            ))}
          </Row>
          <Spacer h={8} />
          <Row wrap gap={6}>
            {KINDS.map((k) => (
              <Chip
                key={k.value}
                label={k.label}
                active={kind === k.value}
                onPress={() => {
                  setKind(k.value);
                  setBody(k.text);
                }}
              />
            ))}
          </Row>
          <Spacer h={8} />
          <Field label="Message" value={body} onChangeText={setBody} maxLength={500} multiline />
          {err ? <Muted style={{ color: t.danger }}>{err}</Muted> : null}
          <Button
            small
            icon="heart-outline"
            title="Envoyer"
            disabled={!to || !body.trim()}
            loading={busy}
            onPress={async () => {
              if (!userId || !to) return;
              setBusy(true);
              try {
                await api.sendEncouragement(scope, scopeId, userId, to, kind, body.trim());
                setErr(null);
                setTo(null);
                void list.reload();
              } catch (e) {
                setErr(api.frError(e));
              } finally {
                setBusy(false);
              }
            }}
          />
        </>
      ) : (
        <Muted>Aucun destinataire possible pour l’instant.</Muted>
      )}
      {list.data?.length ? (
        <View style={{ marginTop: 12 }}>
          {list.data.slice(0, 15).map((e) => (
            <View key={e.id} style={{ marginBottom: 8 }}>
              <Muted style={{ fontSize: 12 }}>
                {nameOf(e.sender_id)} → {nameOf(e.recipient_id)} · {new Date(e.created_at).toLocaleString('fr-CH', { dateStyle: 'short', timeStyle: 'short' })}
              </Muted>
              <Text
                style={{ color: t.text, fontWeight: e.recipient_id === userId && !e.read_at ? '700' : '400' }}
                onPress={() => (e.recipient_id === userId && !e.read_at ? void api.markRead(e.id).then(list.reload).catch(() => {}) : undefined)}
              >
                {e.body}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </Card>
  );
}
