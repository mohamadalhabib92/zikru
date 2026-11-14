import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { TvBack, TvButton, TvMuted, TvScroll, TvTitle } from '@/components/tv/ui';
import * as api from '@/lib/community/api';
import { useAuth } from '@/lib/community/auth';
import { chatBackend, type ChatBackend } from '@/lib/community/chat-api';
import { applyIncoming, type ChatMessage } from '@/lib/community/chat-core';
import { uid } from '@/lib/storage';
import { L } from '@/lib/l10n';
import { Text } from '@/ui/Text';
import { theme as t } from '@/ui/theme';

const PRESETS: { kind: 'salam' | 'bravo' | 'dua'; body: string }[] = [
  { kind: 'salam', body: 'As-salamu alaykum' },
  { kind: 'bravo', body: 'Masha’Allah' },
  { kind: 'dua', body: 'Amin' },
];

export default function TvChat() {
  const auth = useAuth();
  const [families, setFamilies] = useState<api.Family[]>([]);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [be, setBe] = useState<ChatBackend | null>(null);
  const [msgs, setMsgs] = useState<ChatMessage[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [canPost, setCanPost] = useState(false);

  useEffect(() => {
    if (!auth.session) return;
    let on = true;
    api
      .listFamilies()
      .then((list) => {
        if (!on) return;
        setFamilies(list);
        setFamilyId((cur) => cur ?? list[0]?.id ?? null);
      })
      .catch((e) => on && setErr(api.frError(e)));
    void chatBackend().then((b) => on && setBe(b));
    return () => {
      on = false;
    };
  }, [auth.session]);

  useEffect(() => {
    if (!be || !familyId) return;
    let on = true;
    be.rights('family', familyId)
      .then((r) => {
        if (!on) return;
        setCanPost(!!r.member && r.can_post !== false && r.audience !== 'none');
        return be.list('family', familyId);
      })
      .then((rows) => {
        if (on && rows) setMsgs(rows.filter((m) => !m.deleted_at));
      })
      .catch((e) => on && setErr(api.frError(e)));
    const off = be.subscribe('family', familyId, (row) => setMsgs((cur) => applyIncoming(cur, row, 'family', familyId).filter((m) => !m.deleted_at)), () => {});
    return () => {
      on = false;
      off();
    };
  }, [be, familyId]);

  const send = (body: string, kind: 'salam' | 'bravo' | 'dua') => {
    if (!be || !familyId || !auth.userId) return;
    const o = {
      client_id: uid('c-'),
      scope: 'family' as const,
      scope_id: familyId,
      sender_id: auth.userId,
      body,
      kind,
      reply_to: null,
      created_at: new Date().toISOString(),
      attempts: 0,
      next_at: 0,
      status: 'pending' as const,
    };
    void be
      .post(o)
      .then((row) => setMsgs((cur) => applyIncoming(cur, row, 'family', familyId)))
      .catch((e) => setErr(api.frError(e)));
  };

  if (!auth.session) {
    return (
      <TvScroll>
        <TvTitle>{L('Discussion')}</TvTitle>
        <TvMuted>{L('La discussion est gratuite. Connectez-vous pour la lire.')}</TvMuted>
        <View style={{ flexDirection: 'row', gap: 14, marginTop: 18 }}>
          <TvButton preferred label={L('Rejoindre')} onPress={() => router.push('/tv/join')} />
          <TvBack />
        </View>
      </TvScroll>
    );
  }

  const family = families.find((f) => f.id === familyId);
  const visible = msgs.slice(-12);
  return (
    <TvScroll>
      <TvTitle>{family?.name || L('Discussion')}</TvTitle>
      {err ? <TvMuted>{err}</TvMuted> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 16 }}>
        {families.map((f, i) => (
          <TvButton key={f.id} preferred={i === 0} label={f.name} onPress={() => setFamilyId(f.id)} />
        ))}
      </View>
      <View style={{ marginTop: 18, gap: 10 }}>
        {visible.map((m) => (
          <Text key={m.id} style={{ color: t.text, fontSize: 26, lineHeight: 36 }}>
            {m.sender_name ? `${m.sender_name} · ` : ''}
            {m.body}
          </Text>
        ))}
        {!visible.length ? <TvMuted>{L('Pas encore de message.')}</TvMuted> : null}
      </View>
      {canPost ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 18 }}>
          {PRESETS.map((p) => (
            <TvButton key={p.kind} label={p.body} onPress={() => send(p.body, p.kind)} />
          ))}
        </View>
      ) : (
        <TvMuted>{L('Lecture seule pour ce compte.')}</TvMuted>
      )}
      <View style={{ marginTop: 16 }}>
        <TvBack />
      </View>
    </TvScroll>
  );
}
