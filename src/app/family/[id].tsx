import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/ui/Text';
import { confirmAsk, EncouragementsPanel, ErrorNote, fmt, GoalCard, InvitePanel, LivePanel, NewGoal, roleFr, SharingPicker, useLoad } from '@/components/community/parts';
import * as api from '@/lib/community/api';
import { useAuth } from '@/lib/community/auth';
import { useCommunity } from '@/lib/community/sync';
import { Badge, Button, Card, Chip, Eyebrow, Field, H1, H2, Muted, Notice, Row, Screen, Segmented, Spacer } from '@/ui/kit';
import { theme as t } from '@/ui/theme';
import { L } from '@/lib/l10n';

const KINDS = [
  { value: 'wird', label: 'Wird' },
  { value: 'zikr', label: 'Zikr' },
  { value: 'fete', label: 'Fête' },
  { value: 'cours', label: 'Cours' },
  { value: 'rappel', label: 'Rappel' },
];

export default function FamilyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const fid = String(id);
  const { userId, profile } = useAuth();
  const fam = useLoad(() => api.getFamily(fid), [fid]);
  const members = useLoad(() => api.familyMembers(fid), [fid]);
  const goals = useLoad(() => api.listGoals('family', fid), [fid]);
  const me = members.data?.find((m) => m.user_id === userId);
  const isParent = me?.role === 'parent';
  const isAdult = me?.role === 'parent' || me?.role === 'adult';
  const isChild = me?.role === 'child' || !!profile?.is_minor;
  const pcs = useLoad(() => (isParent || isChild ? api.parentalControls(fid) : Promise.resolve([] as api.ParentalControl[])), [fid, isParent, isChild]);
  const [kid, setKid] = useState<{ memberId: string; name: string } | null>(null);
  const [leaveErr, setLeaveErr] = useState<string | null>(null);
  const managed = (members.data ?? []).filter((m) => m.role === 'child' && !m.user_id).map((m) => ({ id: m.id, name: m.display_name }));
  const name = fam.data?.name ?? 'Famille';

  if (kid) return <KidMode family={name} memberId={kid.memberId} childName={kid.name} goals={(goals.data ?? []).filter((g) => g.status === 'active')} onExit={() => setKid(null)} />;

  // Destinataires des encouragements (un enfant restreint « parents » n'écrit qu'aux parents).
  const myPc = isChild ? pcs.data?.find((p) => p.child_member_id === me?.id) : undefined;
  const recipients = (members.data ?? [])
    .filter((m) => m.user_id && m.user_id !== userId)
    .filter((m) => (myPc?.messaging === 'none' ? false : myPc?.messaging === 'parents' ? m.role === 'parent' : true))
    .map((m) => ({ userId: m.user_id as string, name: m.display_name }));

  return (
    <Screen>
      <Stack.Screen options={{ title: name }} />
      <Eyebrow>Ma famille · Usra</Eyebrow>
      <H1>{name}</H1>
      <ErrorNote error={fam.error || members.error} onRetry={() => (fam.reload(), members.reload())} />
      {fam.data ? <Wird family={fam.data} canEdit={isParent} onSaved={fam.reload} /> : null}
      {isChild && myPc?.daily_minutes_limit ? <Notice tone="info" title="Temps conseillé par tes parents" text={L('{n} minutes par jour. Pense à faire des pauses.', { n: myPc.daily_minutes_limit })} /> : null}
      <Spacer />

      <H2>Objectifs communs</H2>
      <ErrorNote error={goals.error} onRetry={goals.reload} />
      {goals.data?.length ? null : <Muted>Aucun objectif pour l’instant.</Muted>}
      {goals.data?.map((g) => (
        <GoalCard key={g.id} goal={g} scopeName={name} canAdmin={isAdult} gentle={isChild} managedChildren={isAdult ? managed : []} />
      ))}
      {isAdult ? <NewGoal onCreate={async (g) => (await api.createGoal('family', fid, userId!, g), void goals.reload())} /> : null}
      {isAdult && managed.length ? (
        <Card>
          <H2>Mode enfant</H2>
          <Muted>Confiez le téléphone à un enfant : un grand bouton de tasbih, sans chiffres des autres ni comparaison. Ses dhikr comptent pour l’objectif familial.</Muted>
          <Row wrap gap={8} style={{ marginTop: 8 }}>
            {managed.map((m) => (
              <Button key={m.id} small icon="happy-outline" title={m.name} onPress={() => setKid({ memberId: m.id, name: m.name })} />
            ))}
          </Row>
        </Card>
      ) : null}
      <Spacer />

      <LivePanel scope="family" scopeId={fid} />
      <Spacer />
      <Calendar familyId={fid} canEdit={isAdult} />
      <Spacer />
      {members.data ? <EncouragementsPanel scope="family" scopeId={fid} recipients={recipients} /> : null}
      <Spacer />

      <H2>Membres</H2>
      {members.data?.map((m) => (
        <MemberRow key={m.id} m={m} isParent={isParent} isMe={m.user_id === userId} pc={pcs.data?.find((p) => p.child_member_id === m.id)} familyId={fid} onChanged={() => (members.reload(), pcs.reload())} />
      ))}
      {isParent ? <AddChild familyId={fid} onAdded={members.reload} /> : null}
      <Spacer />
      {isParent ? (
        <InvitePanel
          scope="family"
          scopeId={fid}
          scopeName={name}
          roles={[
            { label: 'Adulte', value: 'adult' },
            { label: 'Enfant', value: 'child' },
            { label: 'Invité·e', value: 'guest' },
          ]}
        />
      ) : null}
      <Spacer />
      {!isChild ? <SharingPicker scope="family" scopeId={fid} /> : null}
      <Spacer />
      {me && !isChild ? (
        <Button
          variant="ghost"
          icon="exit-outline"
          title="Quitter la famille"
          onPress={() =>
            confirmAsk('Quitter la famille ?', 'Vous pourrez revenir avec une nouvelle invitation.', 'Quitter', () =>
              void api
                .leaveFamily(fid, userId!)
                .then(() => router.back())
                .catch((e) => setLeaveErr(api.frError(e))),
            )
          }
        />
      ) : null}
      {leaveErr ? <Muted style={{ color: t.danger }}>{leaveErr}</Muted> : null}
    </Screen>
  );
}

function Wird({ family, canEdit, onSaved }: { family: api.Family; canEdit: boolean; onSaved: () => void }) {
  const [edit, setEdit] = useState(false);
  const [wird, setWird] = useState(family.wird ?? '');
  if (edit)
    return (
      <Card>
        <Field label="Wird familial" multiline value={wird} onChangeText={setWird} maxLength={500} placeholder={L("Ex. 100 istighfār et 100 ṣalawāt chaque soir")} />
        <Row gap={8}>
          <Button small title="Enregistrer" onPress={() => void api.updateFamily(family.id, { wird: wird.trim() || null }).then(() => (setEdit(false), onSaved()))} />
          <Button small variant="ghost" title="Annuler" onPress={() => setEdit(false)} />
        </Row>
      </Card>
    );
  return (
    <Card>
      <Eyebrow>Wird familial</Eyebrow>
      <Text style={{ color: t.text, fontSize: 16 }}>{family.wird || 'Pas encore de wird familial.'}</Text>
      {canEdit ? <Button small variant="ghost" icon="create-outline" title="Modifier" onPress={() => setEdit(true)} /> : null}
    </Card>
  );
}

function MemberRow({ m, isParent, isMe, pc, familyId, onChanged }: { m: api.FamilyMember; isParent: boolean; isMe: boolean; pc?: api.ParentalControl; familyId: string; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [limit, setLimit] = useState(pc?.daily_minutes_limit ? String(pc.daily_minutes_limit) : '');
  const save = (patch: Partial<api.ParentalControl>) =>
    api
      .saveParentalControl({
        child_member_id: m.id,
        family_id: familyId,
        daily_minutes_limit: pc?.daily_minutes_limit ?? null,
        messaging: pc?.messaging ?? 'family',
        content_level: pc?.content_level ?? 'enfant',
        ...patch,
      })
      .then(onChanged)
      .catch((e) => setErr(api.frError(e)));
  return (
    <Card onPress={isParent && !isMe ? () => setOpen(!open) : undefined}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text style={{ color: t.text, fontSize: 16, fontWeight: '600' }}>
          {m.display_name}
          {isMe ? ' (moi)' : ''}
        </Text>
        <Row gap={6}>
          {m.role === 'child' && !m.user_id ? <Badge label="Géré" /> : null}
          <Badge label={roleFr(m.role)} tone={m.role === 'parent' ? 'info' : 'neutral'} />
        </Row>
      </Row>
      {open ? (
        <View style={{ marginTop: 10 }}>
          {m.user_id ? (
            <Segmented
              label="Rôle"
              options={[
                { label: 'Parent', value: 'parent' },
                { label: 'Adulte', value: 'adult' },
                { label: 'Enfant', value: 'child' },
                { label: 'Invité·e', value: 'guest' },
              ]}
              value={m.role}
              onChange={(r: api.FamilyRole) => void api.setMemberRole(m.id, r).then(onChanged).catch((e) => setErr(api.frError(e)))}
            />
          ) : null}
          {m.role === 'child' ? (
            <>
              <Eyebrow>Contrôle parental</Eyebrow>
              {m.user_id ? (
                <Segmented
                  label="Messages"
                  options={[
                    { label: 'Aucun', value: 'none' },
                    { label: 'Parents', value: 'parents' },
                    { label: 'Famille', value: 'family' },
                  ]}
                  value={pc?.messaging ?? 'family'}
                  onChange={(v: api.ParentalControl['messaging']) => void save({ messaging: v })}
                />
              ) : null}
              <Segmented
                label="Contenu"
                options={[
                  { label: 'Enfant', value: 'enfant' },
                  { label: 'Ado', value: 'ado' },
                ]}
                value={pc?.content_level ?? 'enfant'}
                onChange={(v: api.ParentalControl['content_level']) => void save({ content_level: v })}
              />
              <Row gap={8}>
                <View style={{ flex: 1 }}>
                  <Field label="Temps par jour (minutes, vide = libre)" keyboardType="number-pad" value={limit} onChangeText={setLimit} />
                </View>
                <Button small title="OK" onPress={() => void save({ daily_minutes_limit: limit ? Math.max(5, Math.min(600, parseInt(limit, 10) || 0)) : null })} />
              </Row>
              <Muted>Les enfants ne rejoignent aucun cercle et ne sont jamais visibles hors de la famille.</Muted>
            </>
          ) : null}
          {err ? <Muted style={{ color: t.danger }}>{err}</Muted> : null}
          <Button
            small
            variant="ghost"
            icon="person-remove-outline"
            title="Retirer de la famille"
            onPress={() => confirmAsk(L('Retirer {name} ?', { name: m.display_name }), 'Ses contributions passées restent dans le total.', 'Retirer', () => void api.removeFamilyMember(m.id).then(onChanged).catch((e) => setErr(api.frError(e))))}
          />
        </View>
      ) : null}
    </Card>
  );
}

function AddChild({ familyId, onAdded }: { familyId: string; onAdded: () => void }) {
  const [name, setName] = useState('');
  const [err, setErr] = useState<string | null>(null);
  return (
    <Card>
      <H2>Ajouter un enfant (sans compte)</H2>
      <Muted>Pour un jeune enfant sans e-mail : vous comptez pour lui, ou passez en « Mode enfant ». Pour un enfant avec son propre appareil, utilisez une invitation « Enfant ».</Muted>
      <Row gap={8} style={{ marginTop: 8 }}>
        <View style={{ flex: 1 }}>
          <Field label="Prénom" value={name} onChangeText={setName} maxLength={60} error={err} />
        </View>
        <Button
          small
          icon="add"
          title="Ajouter"
          disabled={!name.trim()}
          onPress={() =>
            void api
              .addManagedChild(familyId, name.trim())
              .then(() => (setName(''), setErr(null), onAdded()))
              .catch((e) => setErr(api.frError(e)))
          }
        />
      </Row>
    </Card>
  );
}

function Calendar({ familyId, canEdit }: { familyId: string; canEdit: boolean }) {
  const { userId } = useAuth();
  const ev = useLoad(() => api.listEvents(familyId), [familyId]);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState('zikr');
  const today = new Date();
  const [date, setDate] = useState(today.toISOString().slice(0, 10));
  const [time, setTime] = useState('20:00');
  const [err, setErr] = useState<string | null>(null);
  return (
    <Card>
      <H2>Calendrier spirituel</H2>
      <ErrorNote error={ev.error} onRetry={ev.reload} />
      {ev.data?.length ? (
        ev.data.map((e) => (
          <Row key={e.id} style={{ justifyContent: 'space-between', marginTop: 6 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.text, fontWeight: '600' }}>{e.title}</Text>
              <Muted style={{ fontSize: 12 }}>
                {KINDS.find((k) => k.value === e.kind)?.label ?? 'Autre'} ·{' '}
                {new Date(e.starts_at).toLocaleString('fr-CH', e.all_day ? { dateStyle: 'full' } : { dateStyle: 'medium', timeStyle: 'short' })}
              </Muted>
            </View>
            {canEdit ? <Button small variant="ghost" icon="trash-outline" title="" accessibilityLabel={L('Supprimer {x}', { x: e.title })} onPress={() => void api.deleteEvent(e.id).then(ev.reload)} /> : null}
          </Row>
        ))
      ) : (
        <Muted>Rien de prévu. Ajoutez le zikr du soir, une fête ou un cours.</Muted>
      )}
      {canEdit ? (
        adding ? (
          <View style={{ marginTop: 10 }}>
            <Field label="Titre" placeholder={L("Zikr du jeudi soir")} value={title} onChangeText={setTitle} />
            <Row wrap gap={6} style={{ marginBottom: 10 }}>
              {KINDS.map((k) => (
                <Chip key={k.value} label={k.label} active={kind === k.value} onPress={() => setKind(k.value)} />
              ))}
            </Row>
            <Row gap={8}>
              <View style={{ flex: 1 }}>
                <Field label="Date (AAAA-MM-JJ)" value={date} onChangeText={setDate} />
              </View>
              <View style={{ width: 110 }}>
                <Field label="Heure (vide = journée)" value={time} onChangeText={setTime} />
              </View>
            </Row>
            {err ? <Muted style={{ color: t.danger }}>{err}</Muted> : null}
            <Row gap={8}>
              <Button
                small
                title="Ajouter"
                onPress={async () => {
                  const allDay = !time.trim();
                  const d = new Date(`${date}T${allDay ? '00:00' : time.trim()}:00`);
                  if (!title.trim() || isNaN(d.getTime())) return setErr('Titre et date valides requis.');
                  try {
                    await api.createEvent(familyId, userId!, { title: title.trim(), kind, starts_at: d.toISOString(), all_day: allDay });
                    setAdding(false);
                    setTitle('');
                    void ev.reload();
                  } catch (e) {
                    setErr(api.frError(e));
                  }
                }}
              />
              <Button small variant="ghost" title="Annuler" onPress={() => setAdding(false)} />
            </Row>
          </View>
        ) : (
          <Button small variant="secondary" icon="calendar-outline" title="Ajouter un moment" onPress={() => setAdding(true)} />
        )
      ) : null}
    </Card>
  );
}

/** Mode enfant : un grand bouton doux, aucun chiffre des autres. Sortie par appui long. */
function KidMode({ family, memberId, childName, goals, onExit }: { family: string; memberId: string; childName: string; goals: api.Goal[]; onExit: () => void }) {
  const c = useCommunity();
  const [goalId, setGoalId] = useState(goals[0]?.id ?? null);
  const [n, setN] = useState(0);
  return (
    <Screen>
      <Stack.Screen options={{ title: L('Mode enfant · {name}', { name: childName }) }} />
      <Eyebrow>{family}</Eyebrow>
      <H1>Salām {childName} !</H1>
      <Muted>Touche le grand bouton à chaque dhikr.</Muted>
      {goals.length > 1 ? (
        <Row wrap gap={6} style={{ marginTop: 8 }}>
          {goals.map((g) => (
            <Chip key={g.id} label={g.title} active={goalId === g.id} onPress={() => setGoalId(g.id)} />
          ))}
        </Row>
      ) : null}
      <Spacer h={24} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={L("Compter un dhikr")}
        onPress={() => {
          setN(n + 1);
          if (goalId) c.contribute(goalId, 1, 'manuel', memberId);
        }}
        style={({ pressed }) => ({
          alignSelf: 'center',
          width: 240,
          height: 240,
          borderRadius: 120,
          backgroundColor: pressed ? t.primary : t.surfaceAlt,
          borderWidth: 4,
          borderColor: t.primary,
          alignItems: 'center',
          justifyContent: 'center',
        })}
      >
        <Text style={{ color: t.text, fontSize: 56, fontWeight: '800' }}>{fmt(n)}</Text>
        <Text style={{ color: t.muted, fontSize: 16 }}>{n === 0 ? 'Bismillāh' : n % 33 === 0 ? 'Machā’Allāh ! 🌟' : 'Continue 🌙'}</Text>
      </Pressable>
      <Spacer h={24} />
      {!goalId ? <Notice tone="info" title="Pas d’objectif familial" text="Les appuis sont comptés ici, sans être envoyés." /> : null}
      <Pressable onLongPress={onExit} delayLongPress={1200} accessibilityRole="button" accessibilityLabel={L("Quitter le mode enfant (appui long)")} style={{ alignSelf: 'center', padding: 16 }}>
        <Muted>Parent : appui long ici pour quitter</Muted>
      </Pressable>
    </Screen>
  );
}
