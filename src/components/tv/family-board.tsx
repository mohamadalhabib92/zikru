import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { TvBack, TvButton, TvColumn, TvMuted, TvRow, TvScroll, TvTitle } from '@/components/tv/ui';
import * as api from '@/lib/community/api';
import { useAuth } from '@/lib/community/auth';
import { getSupabase } from '@/lib/supabase';
import { goalTotal, kidsCount, mergeCounts, rowsFromSession, sessionTotal, type TvCountRow } from '@/lib/tv';
import { L } from '@/lib/l10n';
import { Text } from '@/ui/Text';
import { theme as t } from '@/ui/theme';

type Family = { id: string; name: string };

/** Compteur du salon : sessions en direct (mêmes lignes que l’iPhone) et totaux d’objectifs. */
export function FamilyBoard({ kids }: { kids?: boolean }) {
  const auth = useAuth();
  const [families, setFamilies] = useState<Family[] | null>(null);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [rows, setRows] = useState<TvCountRow[]>([]);
  const [goals, setGoals] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const [mineCount, setMineCount] = useState(0);
  const mine = useRef(0);
  const sent = useRef(-1);
  const rememberMine = (n: number) => {
    mine.current = n;
    setMineCount(n);
  };
  const userId = auth.userId;

  useEffect(() => {
    if (!auth.session) return;
    let on = true;
    api
      .listFamilies()
      .then((list) => {
        if (!on) return;
        setFamilies(list.map((f) => ({ id: f.id, name: f.name })));
        setFamilyId((cur) => cur ?? list[0]?.id ?? null);
      })
      .catch((e) => on && setErr(api.frError(e)));
    return () => {
      on = false;
    };
  }, [auth.session]);

  useEffect(() => {
    if (!familyId) return;
    let on = true;
    const load = async () => {
      try {
        const [sessions, goalRows] = await Promise.all([api.liveSessions('family', familyId), api.listGoals('family', familyId)]);
        if (!on) return;
        const session = sessions[0] ?? null;
        setSessionId(session?.id ?? null);
        setTitle(session?.title || goalRows[0]?.title || '');
        setLive(session?.status === 'live');
        if (session) {
          const counts = rowsFromSession(await api.sessionCounts(session.id));
          if (!on) return;
          setRows(counts);
          const m = counts.find((r) => r.userId === userId)?.count ?? 0;
          if (m > mine.current) {
            mine.current = m;
            sent.current = m;
            setMineCount(m);
          }
        } else setRows([]);
        const progress = await Promise.all(goalRows.filter((g) => g.status === 'active').map((g) => api.goalProgress(g.id).catch(() => null)));
        if (on) setGoals(goalTotal(progress.filter((p): p is api.GoalProgress => !!p)));
        setErr(null);
      } catch (e) {
        if (on) setErr(api.frError(e));
      }
    };
    void load();
    const poll = setInterval(() => void load(), 8000);
    return () => {
      on = false;
      clearInterval(poll);
    };
  }, [familyId, userId]);

  useEffect(() => {
    if (!sessionId) return;
    let stop: (() => void) | null = null;
    let off = false;
    void getSupabase().then((c) => {
      if (off || !c) return;
      const ch = c
        .channel(`tv-live:${sessionId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'zikr_session_counts', filter: `session_id=eq.${sessionId}` }, (p) => {
          const row = p.new as { user_id?: string; display_name?: string; count?: number };
          if (!row?.user_id) return;
          setRows((cur) => mergeCounts(cur, rowsFromSession([row])));
        })
        .subscribe();
      stop = () => void c.removeChannel(ch);
    });
    return () => {
      off = true;
      stop?.();
    };
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId || !userId || !live) return;
    const id = setInterval(() => {
      if (mine.current === sent.current) return;
      const v = mine.current;
      api
        .setSessionCount(sessionId, userId, auth.displayName || 'Salon', v)
        .then(() => {
          sent.current = v;
        })
        .catch(() => {});
    }, 1500);
    return () => clearInterval(id);
  }, [sessionId, userId, live, auth.displayName]);

  const tap = () => {
    if (!live || !userId) return;
    const next = mine.current + 1;
    rememberMine(next);
    setRows((cur) => mergeCounts(cur, [{ userId, name: auth.displayName || 'Salon', count: next }]));
  };
  const total = sessionTotal(rows, userId ? { userId, count: mineCount } : null);
  const shown = kids ? Math.max(kidsCount(rows, userId), mineCount) : total;
  const family = families?.find((f) => f.id === familyId);

  if (!auth.session) {
    return (
      <TvScroll>
        <TvTitle>{kids ? L('Enfants') : L('Dhikr en famille')}</TvTitle>
        <TvMuted>{L('Connectez-vous, ou rejoignez la famille avec un code. Cela reste gratuit.')}</TvMuted>
        <TvRow>
          <TvButton preferred label={L('Rejoindre')} onPress={() => router.push('/tv/join')} />
          <TvBack />
        </TvRow>
      </TvScroll>
    );
  }

  return (
    <TvScroll>
      <TvTitle>{family?.name || (kids ? L('Enfants') : L('Dhikr en famille'))}</TvTitle>
      {title ? <TvMuted>{title}</TvMuted> : null}
      {err ? <TvMuted>{err}</TvMuted> : null}
      <Text style={{ color: t.text, fontSize: 140, lineHeight: 168, fontWeight: '800', marginTop: 12, fontVariant: ['tabular-nums'] }}>{shown}</Text>
      <TvMuted>{kids ? L('Seulement votre compte. Les autres ne s’affichent pas.') : live ? L('En direct, avec les téléphones et les anneaux de la famille.') : L('Aucun dhikr en direct. Le total des objectifs communs est à côté.')}</TvMuted>
      {!kids && !live ? <Text style={{ color: t.accent, fontSize: 40, marginTop: 10 }}>{goals}</Text> : null}
      <TvRow>
        {live ? <TvButton preferred label={L('Compter un dhikr')} onPress={tap} /> : null}
        {(families ?? []).map((f) => (
          <TvButton key={f.id} label={f.name} onPress={() => setFamilyId(f.id)} />
        ))}
        <TvBack preferred={!live} />
      </TvRow>
      {!kids ? (
        <TvColumn>
          {rows.map((r) => (
            <TvButton key={r.userId} block label={`${r.name} · ${r.count}`} onPress={() => {}} />
          ))}
        </TvColumn>
      ) : null}
    </TvScroll>
  );
}
