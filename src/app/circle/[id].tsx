import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { confirmAsk, EncouragementsPanel, ErrorNote, GoalCard, InvitePanel, LivePanel, NewGoal, roleFr, SharingPicker, useLoad } from '@/components/community/parts';
import * as api from '@/lib/community/api';
import { useAuth } from '@/lib/community/auth';
import { Badge, Button, Card, Eyebrow, Field, H1, H2, Muted, Row, Screen, Spacer } from '@/ui/kit';
import { theme as t } from '@/ui/theme';

/** Cercle de proches (Ahbab) : 50 membres maximum, sur invitation, règlement accepté. */
export default function CircleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const cid = String(id);
  const { userId } = useAuth();
  const circle = useLoad(() => api.getCircle(cid), [cid]);
  const members = useLoad(() => api.circleMembers(cid), [cid]);
  const goals = useLoad(() => api.listGoals('circle', cid), [cid]);
  const me = members.data?.find((m) => m.user_id === userId);
  const isMod = me?.role === 'founder' || me?.role === 'moderator';
  const isFounder = me?.role === 'founder';
  const [err, setErr] = useState<string | null>(null);
  const [editRules, setEditRules] = useState(false);
  const [rules, setRules] = useState('');
  const name = circle.data?.name ?? 'Cercle';
  const count = members.data?.length ?? 0;

  return (
    <Screen>
      <Stack.Screen options={{ title: name }} />
      <Eyebrow>Mes cercles · Ahbab</Eyebrow>
      <H1>{name}</H1>
      {circle.data?.description ? <Muted>{circle.data.description}</Muted> : null}
      <Muted>
        {count} / {circle.data?.max_members ?? 50} membres
      </Muted>
      <ErrorNote error={circle.error || members.error} onRetry={() => (circle.reload(), members.reload())} />
      <Spacer />

      <H2>Objectifs</H2>
      <ErrorNote error={goals.error} onRetry={goals.reload} />
      {goals.data?.length ? null : <Muted>Aucun objectif pour l’instant.</Muted>}
      {goals.data?.map((g) => (
        <GoalCard key={g.id} goal={g} scopeName={name} canAdmin={isMod} />
      ))}
      {isMod ? <NewGoal onCreate={async (g) => (await api.createGoal('circle', cid, userId!, g), void goals.reload())} /> : null}
      <Spacer />
      <SharingPicker scope="circle" scopeId={cid} />
      <Spacer />
      <LivePanel scope="circle" scopeId={cid} />
      <Spacer />
      {members.data ? (
        <EncouragementsPanel scope="circle" scopeId={cid} recipients={members.data.filter((m) => m.user_id !== userId).map((m) => ({ userId: m.user_id, name: m.display_name }))} />
      ) : null}
      <Spacer />

      <Card>
        <H2>Règlement</H2>
        {editRules ? (
          <>
            <Field label="Règlement" multiline value={rules} onChangeText={setRules} maxLength={2000} />
            <Row gap={8}>
              <Button small title="Enregistrer" onPress={() => void api.updateCircle(cid, { rules: rules.trim() || null }).then(() => (setEditRules(false), circle.reload())).catch((e) => setErr(api.frError(e)))} />
              <Button small variant="ghost" title="Annuler" onPress={() => setEditRules(false)} />
            </Row>
          </>
        ) : (
          <>
            <Text style={{ color: t.text }}>{circle.data?.rules || 'Pas de règlement.'}</Text>
            {isMod ? <Button small variant="ghost" icon="create-outline" title="Modifier" onPress={() => (setRules(circle.data?.rules ?? ''), setEditRules(true))} /> : null}
          </>
        )}
      </Card>
      <Spacer />

      <H2>Membres</H2>
      {members.data?.map((m) => (
        <Card key={m.user_id}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={{ color: t.text, fontSize: 16, fontWeight: '600', flex: 1 }}>
              {m.display_name}
              {m.user_id === userId ? ' (moi)' : ''}
            </Text>
            <Badge label={roleFr(m.role)} tone={m.role === 'member' ? 'neutral' : 'info'} />
          </Row>
          {isMod && m.user_id !== userId && m.role !== 'founder' ? (
            <Row wrap gap={8} style={{ marginTop: 6 }}>
              {isFounder ? (
                <Button
                  small
                  variant="ghost"
                  title={m.role === 'moderator' ? 'Retirer modérateur' : 'Nommer modérateur'}
                  onPress={() => void api.setCircleRole(cid, m.user_id, m.role === 'moderator' ? 'member' : 'moderator').then(members.reload).catch((e) => setErr(api.frError(e)))}
                />
              ) : null}
              <Button
                small
                variant="ghost"
                icon="person-remove-outline"
                title="Retirer"
                onPress={() => confirmAsk(`Retirer ${m.display_name} ?`, 'Cette personne pourra revenir seulement avec une nouvelle invitation.', 'Retirer', () => void api.removeCircleMember(cid, m.user_id).then(members.reload).catch((e) => setErr(api.frError(e))))}
              />
            </Row>
          ) : null}
        </Card>
      ))}
      {err ? <Muted style={{ color: t.danger }}>{err}</Muted> : null}
      <Spacer />
      {isMod && count < (circle.data?.max_members ?? 50) ? (
        <InvitePanel
          scope="circle"
          scopeId={cid}
          scopeName={name}
          roles={[
            { label: 'Membre', value: 'member' },
            ...(isFounder ? [{ label: 'Modérateur', value: 'moderator' }] : []),
          ]}
        />
      ) : isMod ? (
        <Muted>Le cercle est complet (50 membres maximum).</Muted>
      ) : null}
      <Spacer />
      {me ? (
        <View>
          <Button
            variant="ghost"
            icon="exit-outline"
            title="Quitter le cercle"
            onPress={() =>
              confirmAsk('Quitter le cercle ?', isFounder ? 'Le rôle de fondateur passera à un modérateur ou au membre le plus ancien.' : 'Vous pourrez revenir avec une nouvelle invitation.', 'Quitter', () =>
                void api
                  .leaveCircle(cid, userId!)
                  .then(() => router.back())
                  .catch((e) => setErr(api.frError(e))),
              )
            }
          />
        </View>
      ) : null}
    </Screen>
  );
}
