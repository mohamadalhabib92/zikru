import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/ui/Text';
import { ErrorNote, fmt, ProgressBar, ReportButton } from '@/components/community/parts';
import * as api from '@/lib/community/api';
import { useAuth } from '@/lib/community/auth';
import { onClicks } from '@/lib/community/clicks';
import { feedback } from '@/lib/feedback';
import { supabase } from '@/lib/supabase';
import { Badge, Button, Card, Eyebrow, H1, Muted, Row, Screen, Spacer } from '@/ui/kit';
import { theme as t } from '@/ui/theme';
import { L } from '@/lib/l10n';

/**
 * Zikr en direct : chacun compte (écran, bague ou compteur Bluetooth) et le total
 * de la session se met à jour en temps réel (Supabase Realtime).
 */
export default function LiveScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const sid = String(id);
  const { userId, displayName } = useAuth();
  const [session, setSession] = useState<api.ZikrSession | null>(null);
  const [counts, setCounts] = useState<api.SessionCount[]>([]);
  const [mine, setMine] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const mineRef = useRef(0);
  const sentRef = useRef(-1);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const [s, c] = await Promise.all([api.getSession(sid), api.sessionCounts(sid)]);
        if (!alive) return;
        setSession(s);
        setCounts(c);
        const m = c.find((x) => x.user_id === userId)?.count ?? 0;
        if (m > mineRef.current) {
          mineRef.current = m;
          sentRef.current = m;
          setMine(m);
        }
        setErr(null);
      } catch (e) {
        if (alive) setErr(api.frError(e));
      }
    };
    void load();
    const ch = supabase
      ?.channel(`live:${sid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'zikr_session_counts', filter: `session_id=eq.${sid}` }, (p) => {
        const row = p.new as api.SessionCount;
        if (!row?.user_id) return;
        setCounts((cs) => [...cs.filter((x) => x.user_id !== row.user_id), row].sort((a, b) => b.count - a.count));
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'zikr_sessions', filter: `id=eq.${sid}` }, (p) => setSession(p.new as api.ZikrSession))
      .subscribe();
    const poll = setInterval(load, 30000); // filet de sécurité si le temps réel est coupé
    return () => {
      alive = false;
      clearInterval(poll);
      if (ch) void supabase?.removeChannel(ch);
    };
  }, [sid, userId]);

  const live = session?.status === 'live';
  const liveRef = useRef(live);
  liveRef.current = live;
  const tap = (n: number) => {
    if (!liveRef.current) return;
    mineRef.current += n;
    setMine(mineRef.current);
  };
  // Appuis Bluetooth / clavier pendant la session.
  useEffect(() => onClicks((n, src) => (src !== 'manuel' ? tap(n) : undefined)), []);
  // Envoi groupé (compteur absolu : aucune perte ni double comptage).
  useEffect(() => {
    const i = setInterval(() => {
      if (!userId || mineRef.current === sentRef.current || !liveRef.current) return;
      const v = mineRef.current;
      api
        .setSessionCount(sid, userId, displayName, v)
        .then(() => (sentRef.current = v))
        .catch(() => {});
    }, 1500);
    return () => clearInterval(i);
  }, [sid, userId, displayName]);

  const others = counts.filter((c) => c.user_id !== userId);
  const total = others.reduce((a, c) => a + c.count, 0) + mine;
  return (
    <Screen>
      <Stack.Screen options={{ title: L("Zikr en direct") }} />
      <Eyebrow>{live ? 'En direct' : 'Session terminée'}</Eyebrow>
      <H1>{session?.title ?? '…'}</H1>
      {session?.formula ? <Muted>{session.formula}</Muted> : null}
      <ErrorNote error={err} />
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Muted>Total ensemble</Muted>
          <Badge label={`${counts.length || 1} participant(s)`} tone="info" />
        </Row>
        <Text style={{ color: t.text, fontSize: 40, fontWeight: '800' }}>{fmt(total)}</Text>
        {session?.target ? <ProgressBar value={total} target={session.target} /> : null}
      </Card>
      <Spacer h={20} />
      <Pressable
        disabled={!live}
        accessibilityRole="button"
        accessibilityLabel={L("Compter un dhikr")}
        onPress={() => {
          tap(1);
          feedback('tap', { sound: false, haptics: true });
        }}
        style={({ pressed }) => ({
          alignSelf: 'center',
          width: 220,
          height: 220,
          borderRadius: 110,
          backgroundColor: pressed ? t.primary : t.surfaceAlt,
          borderWidth: 4,
          borderColor: live ? t.primary : t.border,
          alignItems: 'center',
          justifyContent: 'center',
        })}
      >
        <Text style={{ color: t.text, fontSize: 48, fontWeight: '800' }}>{fmt(mine)}</Text>
        <Muted>Moi</Muted>
      </Pressable>
      <Muted style={{ textAlign: 'center', marginTop: 8 }}>Votre bague ou compteur Bluetooth compte aussi ici.</Muted>
      <Spacer />
      {others.map((c) => (
        <Row key={c.user_id} style={{ justifyContent: 'space-between' }}>
          <Muted>{c.display_name || 'Membre'}</Muted>
          <Muted>{fmt(c.count)}</Muted>
        </Row>
      ))}
      <Spacer />
      {live ? (
        <Button
          variant="secondary"
          icon="stop-circle-outline"
          title="Terminer la session"
          onPress={() =>
            void api
              .endSession(sid)
              .then(() => setSession((s) => (s ? { ...s, status: 'ended' } : s)))
              .catch(() => setErr('Seule la personne qui a lancé la session (ou un responsable) peut la terminer.'))
          }
        />
      ) : (
        <Button variant="secondary" icon="arrow-back" title="Retour" onPress={() => router.back()} />
      )}
      {session ? (
        <ReportButton target="session" targetId={sid} scope={session.scope_type} scopeId={(session.scope_type === 'family' ? session.family_id : session.circle_id) ?? undefined} label="Signaler cette session" />
      ) : null}
      <View style={{ height: 20 }} />
    </Screen>
  );
}
