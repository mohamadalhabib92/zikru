import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { Text } from '@/ui/Text';
import * as api from '@/lib/community/api';
import { Card, H2, Ionicons, Muted, Row, Spacer } from '@/ui/kit';
import { theme as t } from '@/ui/theme';
import { L } from '@/lib/l10n';

/**
 * Programmes de groupe d’une famille ou d’un cercle (étapes enchaînées, avancée par membre).
 * Rien n’est affiché si le serveur n’a pas encore les programmes (migration non appliquée) : l’import retombe alors
 * sur les objectifs communs.
 */
export function ProgramsPanel({ scope, scopeId }: { scope: api.ScopeType; scopeId: string }) {
  const [list, setList] = useState<api.GroupProgram[] | null>(null);
  const [missing, setMissing] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      setList(await api.listGroupPrograms(scope, scopeId));
      setErr(null);
    } catch (e) {
      if (e instanceof api.ProgramsMissing) setMissing(true);
      else setErr(api.frError(e));
    }
  }, [scope, scopeId]);
  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);
  if (missing || (!list?.length && !err)) return null;
  return (
    <View>
      <H2>Programmes du groupe</H2>
      {err ? <Muted style={{ color: t.danger }}>{err}</Muted> : null}
      {list?.map((p) => (
        <Card key={p.id} onPress={() => router.push({ pathname: '/program/[id]', params: { id: p.id } })} accessibilityLabel={L('Ouvrir le programme {t}', { t: p.title })}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={{ color: t.text, fontSize: 16, fontWeight: '600', flex: 1 }}>{p.title}</Text>
            <Ionicons name="chevron-forward" size={18} color={t.muted} />
          </Row>
          {p.description ? <Muted>{p.description}</Muted> : null}
          <Muted style={{ fontSize: 12 }}>Tasbih de groupe : les étapes s’enchaînent, chacun voit l’avancée commune.</Muted>
        </Card>
      ))}
      <Spacer />
    </View>
  );
}
