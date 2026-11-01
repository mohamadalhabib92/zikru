/**
 * Discussion de groupe (Passe 5) : fil type messagerie, réponses citées, envois hors ligne, signaler / bloquer /
 * supprimer pour tous, sourdine. Libellé exact : « chiffré en transit, pas encore de bout en bout » (aucune
 * promesse de chiffrement de bout en bout : Signal / OpenMLS = phase 3). Le serveur décide de tout (RLS).
 */
import * as Clipboard from 'expo-clipboard';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import { AppState, FlatList, KeyboardAvoidingView, Platform, Pressable, Text as RNText, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlockButton, KINDS, ReportButton } from '@/components/community/parts';
import * as api from '@/lib/community/api';
import { chatBackend, loadDrafts, loadOutbox, saveDrafts, saveOutbox, type ChatBackend, type ChatError, type ChatRights } from '@/lib/community/chat-api';
import {
  applyIncoming,
  buildTimeline,
  canDelete,
  canReport,
  classifyError,
  dueItems,
  enqueue,
  markFailed,
  MAX_LEN,
  mergeMessages,
  newClientId,
  oldestAt,
  PAGE,
  POLL_MS,
  quotePreview,
  removeSent,
  retryNow,
  validateDraft,
  type ChatKind,
  type ChatMessage,
  type ChatScope,
  type Outgoing,
  type TimelineItem,
} from '@/lib/community/chat-core';
import { useAuth } from '@/lib/community/auth';
import { L, useUiLang } from '@/lib/l10n';
import { useMiniPlayerInset } from '@/lib/recitation-context';
import { Button, Card, Chip, IconButton, Ionicons, Muted, Notice, Row } from '@/ui/kit';
import { Text } from '@/ui/Text';
import { theme as t } from '@/ui/theme';

const DEMO_ME = '00000000-0000-4000-8000-00000000d000';
const KIND_LABEL: Record<string, string> = Object.fromEntries(KINDS.map((k) => [k.value, k.label]));
const KIND_ICON: Record<string, keyof typeof Ionicons.glyphMap> = { bravo: 'ribbon-outline', dua: 'hand-left-outline', rappel: 'alarm-outline', salam: 'heart-outline' };
const AUDIENCE: Record<string, string> = {
  parents: 'Vos messages ne sont lus que par vos parents, et vous ne lisez que les leurs (réglage parental).',
  family_no_guests: 'Vos messages sont lus par votre famille, jamais par les invités (réglage parental).',
  no_children: 'En tant qu’invité, vous ne voyez pas les messages des enfants et ils ne voient pas les vôtres.',
  none: 'Le réglage parental ne permet pas d’utiliser la discussion.',
};

function timeOf(iso: string, lang: string) {
  try {
    return new Date(iso).toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso.slice(11, 16);
  }
}
function dayLabel(day: string, lang: string) {
  const d = new Date(day + 'T12:00:00');
  const today = new Date();
  const k = (x: Date) => `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`;
  const y = new Date(today.getTime() - 86_400_000);
  if (k(d) === k(today)) return L('Aujourd’hui');
  if (k(d) === k(y)) return L('Hier');
  try {
    return d.toLocaleDateString(lang, { weekday: 'long', day: 'numeric', month: 'long' });
  } catch {
    return day;
  }
}

export default function Discussion() {
  const p = useLocalSearchParams<{ scope?: string; id?: string; name?: string }>();
  const scope: ChatScope = p.scope === 'family' ? 'family' : 'circle';
  const sid = String(p.id ?? '');
  const lang = useUiLang();
  const insets = useSafeAreaInsets();
  const mini = useMiniPlayerInset();
  const auth = useAuth();
  const [be, setBe] = useState<ChatBackend | null>(null);
  const me = be?.demo ? DEMO_ME : auth.userId;

  const [rights, setRights] = useState<ChatRights | null>(null);
  const [msgs, setMsgs] = useState<ChatMessage[]>([]);
  const [outbox, setOutbox] = useState<Outgoing[]>([]);
  const [loading, setLoading] = useState(true);
  const [older, setOlder] = useState<'idle' | 'busy' | 'end'>('idle');
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [live, setLive] = useState(false);
  const [muted, setMuted] = useState(false);
  const [title, setTitle] = useState(String(p.name ?? ''));
  const [sessions, setSessions] = useState<api.ZikrSession[]>([]);
  const [draft, setDraft] = useState('');
  const [kind, setKind] = useState<ChatKind>('text');
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [selected, setSelected] = useState<ChatMessage | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [sendErr, setSendErr] = useState<string | null>(null);
  const outboxRef = useRef<Outgoing[]>([]);
  const lastSeen = useRef<string>(new Date(0).toISOString());
  const sending = useRef(false);
  const input = useRef<ComponentRef<typeof TextInput>>(null);

  const updateOutbox = useCallback((f: (o: Outgoing[]) => Outgoing[]) => {
    const next = f(outboxRef.current);
    outboxRef.current = next;
    setOutbox(next);
    void saveOutbox(next);
  }, []);
  const absorb = useCallback((rows: ChatMessage[]) => {
    if (!rows.length) return;
    for (const r of rows) {
      const m = r.deleted_at && r.deleted_at > r.created_at ? r.deleted_at : r.created_at;
      if (m > lastSeen.current) lastSeen.current = m;
    }
    setMsgs((cur) => mergeMessages(cur, rows));
  }, []);

  // ---------- Chargement ----------
  useEffect(() => {
    void chatBackend().then(setBe);
    void loadOutbox().then((o) => ((outboxRef.current = o), setOutbox(o)));
    void loadDrafts().then((d) => setDraft((cur) => cur || d[`${scope}:${sid}`] || ''));
  }, [scope, sid]);

  const refresh = useCallback(async () => {
    if (!be || !sid) return;
    setLoadErr(null);
    try {
      const [r, rows, mu] = await Promise.all([be.rights(scope, sid), be.list(scope, sid), be.muted(scope, sid).catch(() => false)]);
      setRights(r);
      setMuted(mu);
      lastSeen.current = new Date(0).toISOString();
      setMsgs([]);
      absorb(rows);
      setOlder(rows.length < PAGE ? 'end' : 'idle');
      setOffline(false);
      if (r.member) void be.markRead(scope, sid).catch(() => {});
    } catch (e) {
      setLoadErr(api.frError(e));
      setOffline(/connexion|network|fetch|connection|اتصال/i.test(String((e as Error)?.message ?? '')));
    } finally {
      setLoading(false);
    }
    if (!be.demo) {
      void (scope === 'family' ? api.getFamily(sid) : api.getCircle(sid)).then((g) => setTitle(g.name)).catch(() => {});
      void api.liveSessions(scope, sid).then(setSessions).catch(() => setSessions([]));
    } else {
      setTitle((cur) => cur || L('Cercle de démonstration'));
    }
  }, [be, scope, sid, absorb]);
  useEffect(() => {
    let on = true;
    void Promise.resolve().then(() => (on ? refresh() : undefined));
    return () => {
      on = false;
    };
  }, [refresh]);

  // ---------- Temps réel, sinon relève toutes les 20 s ----------
  useEffect(() => {
    if (!be || !sid || !rights?.member) return;
    const off = be.subscribe(scope, sid, (row) => setMsgs((cur) => applyIncoming(cur, row, scope, sid)), setLive);
    const tick = async () => {
      try {
        absorb(await be.since(scope, sid, lastSeen.current));
        setOffline(false);
      } catch {
        setOffline(true);
      }
    };
    const iv = setInterval(() => void (live ? null : tick()), POLL_MS);
    const st = AppState.addEventListener('change', (s) => s === 'active' && void tick());
    return () => {
      off();
      clearInterval(iv);
      st.remove();
    };
  }, [be, scope, sid, rights?.member, live, absorb]);

  // Lu : à l'ouverture et quand de nouveaux messages arrivent pendant que l'écran est ouvert.
  const newest = msgs.length ? msgs[msgs.length - 1].id : '';
  useEffect(() => {
    if (be && rights?.member && newest) void be.markRead(scope, sid).catch(() => {});
  }, [be, rights?.member, newest, scope, sid]);

  // ---------- File d'envoi ----------
  const flush = useCallback(async () => {
    if (!be || sending.current) return;
    sending.current = true;
    try {
      for (const o of dueItems(outboxRef.current, Date.now())) {
        try {
          const row = await be.post(o);
          absorb([row]);
          updateOutbox((ob) => removeSent(ob, o.client_id));
          setOffline(false);
        } catch (e) {
          const ce = e as ChatError;
          const perm = classifyError(ce?.code, ce?.message) === 'permanent';
          updateOutbox((ob) => markFailed(ob, o.client_id, api.frError(e), perm, Date.now(), ce?.retryAfterS));
          if (!perm) {
            if (!ce?.code) setOffline(true);
            break; // on garde l'ordre d'envoi
          }
        }
      }
    } finally {
      sending.current = false;
    }
  }, [be, absorb, updateOutbox]);
  useEffect(() => {
    const iv = setInterval(() => void flush(), 3000);
    return () => clearInterval(iv);
  }, [flush]);

  const setDraftSaved = (v: string) => {
    setDraft(v);
    void loadDrafts().then((d) => saveDrafts({ ...d, [`${scope}:${sid}`]: v.slice(0, MAX_LEN) }));
  };
  const send = () => {
    const v = validateDraft(draft);
    if (!v.ok) {
      setSendErr(v.error === 'too_long' ? L('Message trop long ({n} caractères maximum).', { n: MAX_LEN }) : null);
      return;
    }
    if (!me) return;
    setSendErr(null);
    const o: Outgoing = {
      client_id: newClientId(),
      scope,
      scope_id: sid,
      sender_id: me,
      body: v.text,
      kind,
      reply_to: replyTo?.id ?? null,
      created_at: new Date().toISOString(),
      attempts: 0,
      next_at: 0,
      status: 'pending',
    };
    updateOutbox((ob) => enqueue(ob, o));
    setDraftSaved('');
    setKind('text');
    setReplyTo(null);
    void flush();
  };

  const items = useMemo(() => (me ? buildTimeline(msgs, outbox, me, scope, sid) : []), [msgs, outbox, me, scope, sid]);
  const reversed = useMemo(() => [...items].reverse(), [items]);
  const byId = useMemo(() => new Map(msgs.map((m) => [m.id, m])), [msgs]);

  const loadOlder = async () => {
    if (!be || older !== 'idle' || !msgs.length) return;
    setOlder('busy');
    try {
      const rows = await be.list(scope, sid, oldestAt(msgs));
      setMsgs((cur) => mergeMessages(cur, rows));
      setOlder(rows.length < PAGE ? 'end' : 'idle');
    } catch {
      setOlder('idle');
    }
  };

  const flash = (s: string) => {
    setNote(s);
    setTimeout(() => setNote(null), 2500);
  };

  // ---------- Écrans d'attente ----------
  if (!be?.demo && auth.enabled && auth.ready && !auth.userId) {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg, padding: 20 }}>
        <Stack.Screen options={{ title: L('Discussion') }} />
        <Notice title="Connexion requise" text="Connectez-vous pour lire et écrire dans la discussion de votre groupe." />
        <Button title="Se connecter" icon="log-in-outline" onPress={() => router.push('/auth')} />
      </View>
    );
  }

  const canPost = !!rights?.member && !!rights.can_post;
  const audience = rights?.audience && rights.audience !== 'all' ? AUDIENCE[rights.audience] : null;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0} style={{ flex: 1, backgroundColor: t.bg }}>
      <Stack.Screen
        options={{
          title: title || L('Discussion'),
          headerRight: () => (
            <IconButton
              icon={muted ? 'notifications-off-outline' : 'notifications-outline'}
              label={muted ? 'Réactiver les notifications' : 'Mettre en sourdine'}
              onPress={() => {
                const v = !muted;
                setMuted(v);
                flash(v ? L('Discussion en sourdine') : L('Notifications réactivées'));
                void be?.setMuted(scope, sid, v).catch(() => setMuted(!v));
              }}
            />
          ),
        }}
      />
      <View style={{ flex: 1, width: '100%', maxWidth: 860, alignSelf: 'center' }}>
        {/* Bandeau de confiance : libellé exact, jamais « chiffré de bout en bout ». */}
        <View accessibilityRole="text" style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: t.surfaceAlt }}>
          <Ionicons name="lock-closed-outline" size={14} color={t.muted} />
          <Text style={{ color: t.muted, fontSize: 12, flex: 1 }}>chiffré en transit, pas encore de bout en bout</Text>
          {be?.demo ? <Text style={{ color: t.accent, fontSize: 12, fontWeight: '700' }}>Démo</Text> : null}
        </View>
        {offline ? (
          <View accessibilityLiveRegion="polite" style={{ paddingHorizontal: 14, paddingVertical: 6, backgroundColor: t.warningBg }}>
            <Text style={{ color: t.warning, fontSize: 13 }}>Hors ligne : vos messages partiront dès le retour du réseau.</Text>
          </View>
        ) : null}
        {sessions.slice(0, 1).map((s) => (
          <Pressable
            key={s.id}
            onPress={() => router.push(`/live/${s.id}`)}
            accessibilityRole="button"
            accessibilityLabel={L('Rejoindre le zikr en direct : {title}', { title: s.title })}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, paddingHorizontal: 14, backgroundColor: t.successBg }}
          >
            <Ionicons name="radio-outline" size={18} color={t.success} />
            <RNText style={{ color: t.success, fontWeight: '700', flex: 1 }} numberOfLines={1}>
              {L('En direct : {title}', { title: s.title })}
            </RNText>
            <Text style={{ color: t.success, fontWeight: '700' }}>Rejoindre</Text>
          </Pressable>
        ))}
        {audience ? (
          <View style={{ paddingHorizontal: 14, paddingTop: 8 }}>
            <Muted style={{ fontSize: 12 }}>{audience}</Muted>
          </View>
        ) : null}

        {loading ? (
          <Muted style={{ padding: 20 }}>Chargement…</Muted>
        ) : loadErr ? (
          <View style={{ padding: 20, gap: 8 }}>
            <Notice tone="danger" title="Discussion indisponible" text={loadErr} />
            <Button title="Réessayer" icon="refresh" variant="secondary" onPress={() => void refresh()} />
          </View>
        ) : rights && !rights.member ? (
          <View style={{ padding: 20 }}>
            <Notice title="Accès réservé" text="Seuls les membres de ce groupe peuvent lire sa discussion." />
          </View>
        ) : (
          <FlatList
            style={{ flex: 1 }}
            data={reversed}
            inverted
            keyExtractor={(i) => i.key}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: 10, paddingVertical: 10 }}
            onEndReached={() => void loadOlder()}
            onEndReachedThreshold={0.3}
            ListEmptyComponent={
              <View style={{ padding: 24, alignItems: 'center', transform: [{ scaleY: -1 }] }}>
                <Ionicons name="chatbubbles-outline" size={36} color={t.muted} />
                <Text style={{ color: t.muted, textAlign: 'center', marginTop: 8 }}>Aucun message pour l’instant. Commencez par un salām !</Text>
              </View>
            }
            ListFooterComponent={older === 'end' && msgs.length ? <Muted style={{ textAlign: 'center', fontSize: 12, paddingVertical: 8 }}>Début de la discussion · messages gardés 365 jours</Muted> : undefined}
            renderItem={({ item }) => (
              <Bubble
                item={item}
                lang={lang}
                quoted={item.msg.reply_to ? byId.get(item.msg.reply_to) : undefined}
                hasQuote={!!item.msg.reply_to}
                selected={selected?.id === item.msg.id}
                onPress={() => setSelected((cur) => (cur?.id === item.msg.id || item.msg.deleted_at ? null : item.msg))}
                onRetry={() => (updateOutbox((ob) => retryNow(ob, item.msg.client_id ?? '', Date.now())), void flush())}
                onDiscard={() => updateOutbox((ob) => removeSent(ob, item.msg.client_id ?? ''))}
              />
            )}
          />
        )}

        {note ? (
          <View accessibilityLiveRegion="polite" style={{ alignSelf: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: t.surfaceAlt, marginBottom: 6 }}>
            <RNText style={{ color: t.text, fontSize: 13 }}>{note}</RNText>
          </View>
        ) : null}

        {selected && me ? (
          <ActionSheet
            msg={selected}
            me={me}
            canModerate={!!rights?.can_moderate}
            canPost={canPost}
            scope={scope}
            sid={sid}
            demo={!!be?.demo}
            onClose={() => setSelected(null)}
            onReply={() => (setReplyTo(selected), setSelected(null), input.current?.focus())}
            onCopy={() => void Clipboard.setStringAsync(selected.body).then(() => (flash(L('Message copié')), setSelected(null)))}
            onDelete={() =>
              void be
                ?.remove(selected.id)
                .then(() => (setMsgs((cur) => cur.map((m) => (m.id === selected.id ? { ...m, body: '', deleted_at: new Date().toISOString() } : m))), setSelected(null), flash(L('Message supprimé pour tous'))))
                .catch((e) => flash(api.frError(e)))
            }
            onBlocked={() => (setSelected(null), void refresh())}
          />
        ) : null}

        {rights?.member ? (
          canPost ? (
            <View style={{ borderTopWidth: 1, borderTopColor: t.border, backgroundColor: t.surface, paddingHorizontal: 10, paddingTop: 6, paddingBottom: 8 + insets.bottom + mini }}>
              {replyTo ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, borderStartWidth: 3, borderStartColor: t.primary, paddingStart: 8, marginBottom: 6 }}>
                  <View style={{ flex: 1 }}>
                    <RNText style={{ color: t.primary, fontWeight: '700', fontSize: 12 }}>{L('Réponse à {name}', { name: quotePreview(replyTo).name || L('Membre') })}</RNText>
                    <RNText numberOfLines={1} style={{ color: t.muted, fontSize: 13 }}>
                      {quotePreview(replyTo).text}
                    </RNText>
                  </View>
                  <IconButton icon="close" label="Annuler la réponse" onPress={() => setReplyTo(null)} size={20} />
                </View>
              ) : null}
              <Row gap={6} wrap style={{ marginBottom: 6 }}>
                {KINDS.map((k) => (
                  <Chip
                    key={k.value}
                    label={k.label}
                    active={kind === k.value}
                    onPress={() => {
                      if (kind === k.value) {
                        setKind('text');
                        return;
                      }
                      setKind(k.value as ChatKind);
                      if (!draft.trim() || KINDS.some((x) => x.text === draft)) setDraftSaved(k.text);
                    }}
                  />
                ))}
              </Row>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6 }}>
                <TextInput
                  ref={input}
                  value={draft}
                  onChangeText={setDraftSaved}
                  placeholder={L('Message')}
                  placeholderTextColor={t.muted}
                  accessibilityLabel={L('Écrire un message')}
                  multiline
                  maxLength={MAX_LEN + 50}
                  onKeyPress={(e) => {
                    // Web : Entrée envoie, Maj+Entrée = nouvelle ligne.
                    const ne = e.nativeEvent as { key?: string; shiftKey?: boolean };
                    if (Platform.OS === 'web' && ne.key === 'Enter' && !ne.shiftKey) {
                      (e as unknown as { preventDefault?: () => void }).preventDefault?.();
                      send();
                    }
                  }}
                  style={{
                    flex: 1,
                    minHeight: 44,
                    maxHeight: 140,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    borderRadius: 22,
                    backgroundColor: t.surfaceAlt,
                    color: t.text,
                    fontSize: 16,
                    textAlign: lang === 'ar' ? 'right' : 'left',
                  }}
                />
                <Pressable
                  onPress={send}
                  accessibilityRole="button"
                  accessibilityLabel={L('Envoyer')}
                  accessibilityState={{ disabled: !draft.trim() }}
                  style={({ pressed }) => ({
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: draft.trim() ? t.primary : t.surfaceAlt,
                    opacity: pressed ? 0.85 : 1,
                  })}
                >
                  <Ionicons name="send" size={20} color={draft.trim() ? t.onPrimary : t.muted} style={{ transform: [{ scaleX: lang === 'ar' ? -1 : 1 }] }} />
                </Pressable>
              </View>
              {draft.length > MAX_LEN - 200 ? (
                <RNText style={{ color: draft.length > MAX_LEN ? t.danger : t.muted, fontSize: 12, marginTop: 4 }}>{`${draft.length} / ${MAX_LEN}`}</RNText>
              ) : null}
              {sendErr ? <RNText style={{ color: t.danger, fontSize: 13, marginTop: 4 }}>{sendErr}</RNText> : null}
            </View>
          ) : (
            <View style={{ padding: 14, paddingBottom: 14 + insets.bottom + mini, borderTopWidth: 1, borderTopColor: t.border }}>
              <Muted>{rights.audience === 'none' ? AUDIENCE.none : 'Vous ne pouvez pas écrire dans cette discussion pour le moment.'}</Muted>
            </View>
          )
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}

function Bubble({
  item,
  lang,
  quoted,
  hasQuote,
  selected,
  onPress,
  onRetry,
  onDiscard,
}: {
  item: TimelineItem;
  lang: string;
  quoted?: ChatMessage;
  hasQuote: boolean;
  selected: boolean;
  onPress: () => void;
  onRetry: () => void;
  onDiscard: () => void;
}) {
  const { msg: m, mine } = item;
  const gone = !!m.deleted_at;
  const bg = gone ? t.surfaceAlt : mine ? t.primary : t.surface;
  const fg = gone ? t.muted : mine ? t.onPrimary : t.text;
  const name = mine ? L('Moi') : m.sender_name || L('Membre');
  const time = timeOf(m.created_at, lang);
  const q = hasQuote ? quotePreview(quoted) : null;
  const label = gone
    ? L('{name}, {time} : message supprimé', { name, time })
    : L('{name}, {time} : {text}', { name, time, text: m.body }) + (item.delivery === 'pending' ? ' · ' + L('envoi en cours') : item.delivery === 'failed' ? ' · ' + L('échec de l’envoi') : '');
  return (
    <View>
      {item.showDay ? (
        <View style={{ alignItems: 'center', marginVertical: 10 }}>
          <RNText accessibilityRole="header" style={{ color: t.muted, fontSize: 12, fontWeight: '700', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: t.surfaceAlt }}>
            {dayLabel(item.day, lang)}
          </RNText>
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', justifyContent: mine ? 'flex-end' : 'flex-start', marginTop: item.first ? 8 : 2 }}>
        <Pressable
          onPress={onPress}
          onLongPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityHint={gone ? undefined : L('Touchez pour répondre, copier ou signaler')}
          accessibilityState={{ selected }}
          style={{
            maxWidth: '82%',
            minHeight: 44,
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 18,
            borderBottomEndRadius: mine && item.last ? 6 : 18,
            borderBottomStartRadius: !mine && item.last ? 6 : 18,
            backgroundColor: bg,
            borderWidth: selected ? 2 : mine || gone ? 0 : 1,
            borderColor: selected ? t.accent : t.border,
          }}
        >
          {item.first && !mine ? <RNText style={{ color: t.primary, fontWeight: '700', fontSize: 13, marginBottom: 2 }}>{name}</RNText> : null}
          {!gone && m.kind !== 'text' ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 }}>
              <Ionicons name={KIND_ICON[m.kind] ?? 'sparkles-outline'} size={13} color={fg} />
              <RNText style={{ color: fg, fontSize: 12, fontWeight: '700' }}>{L(KIND_LABEL[m.kind] ?? m.kind)}</RNText>
            </View>
          ) : null}
          {q && !gone ? (
            <View style={{ borderStartWidth: 3, borderStartColor: mine ? t.onPrimary : t.primary, paddingStart: 6, marginBottom: 4 }}>
              {q.missing ? (
                <Text style={{ color: fg, fontSize: 12, fontStyle: 'italic' }}>Message supprimé</Text>
              ) : (
                <>
                  <RNText style={{ color: fg, fontSize: 12, fontWeight: '700' }}>{q.name}</RNText>
                  <RNText numberOfLines={2} style={{ color: fg, fontSize: 12 }}>
                    {q.text}
                  </RNText>
                </>
              )}
            </View>
          ) : null}
          {gone ? (
            <Text style={{ color: fg, fontStyle: 'italic' }}>Message supprimé</Text>
          ) : (
            <RNText selectable style={{ color: fg, fontSize: 16, lineHeight: 22 }}>
              {m.body}
            </RNText>
          )}
          {item.last || item.delivery !== 'sent' ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 2 }}>
              <RNText style={{ color: fg, fontSize: 11 }}>{time}</RNText>
              {mine && item.delivery === 'pending' ? <Ionicons name="time-outline" size={12} color={fg} accessibilityLabel={L('envoi en cours')} /> : null}
              {mine && item.delivery === 'sent' && !gone ? <Ionicons name="checkmark" size={12} color={fg} /> : null}
              {mine && item.delivery === 'failed' ? <Ionicons name="alert-circle" size={13} color={fg} /> : null}
            </View>
          ) : null}
        </Pressable>
      </View>
      {item.delivery === 'failed' ? (
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
          {item.error ? <RNText style={{ color: t.danger, fontSize: 12, flexShrink: 1 }}>{item.error}</RNText> : null}
          <Button small variant="ghost" icon="refresh" title="Réessayer" onPress={onRetry} />
          <Button small variant="ghost" icon="trash-outline" title="Abandonner" onPress={onDiscard} />
        </View>
      ) : null}
    </View>
  );
}

function ActionSheet({
  msg,
  me,
  canModerate,
  canPost,
  scope,
  sid,
  demo,
  onClose,
  onReply,
  onCopy,
  onDelete,
  onBlocked,
}: {
  msg: ChatMessage;
  me: string;
  canModerate: boolean;
  canPost: boolean;
  scope: ChatScope;
  sid: string;
  demo: boolean;
  onClose: () => void;
  onReply: () => void;
  onCopy: () => void;
  onDelete: () => void;
  onBlocked: () => void;
}) {
  const [confirmDel, setConfirmDel] = useState(false);
  const local = msg.id.startsWith('local:');
  const other = msg.sender_id !== me;
  return (
    <Card style={{ marginHorizontal: 10, marginBottom: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <RNText numberOfLines={1} style={{ color: t.muted, fontSize: 13, flex: 1 }}>
          {quotePreview(msg, 60).text}
        </RNText>
        <IconButton icon="close" label="Fermer" onPress={onClose} size={20} />
      </View>
      <Row wrap gap={6}>
        {canPost && !local ? <Button small variant="ghost" icon="arrow-undo-outline" title="Répondre" onPress={onReply} /> : null}
        <Button small variant="ghost" icon="copy-outline" title="Copier" onPress={onCopy} />
        {canDelete(msg, me, canModerate) ? (
          confirmDel ? (
            <Button small variant="danger" icon="trash" title={other ? 'Confirmer (modération)' : 'Confirmer la suppression'} onPress={onDelete} />
          ) : (
            <Button small variant="ghost" icon="trash-outline" title="Supprimer pour tous" onPress={() => setConfirmDel(true)} />
          )
        ) : null}
        {canReport(msg, me) && !demo ? (
          <>
            <ReportButton target="group_message" targetId={msg.id} scope={scope} scopeId={sid} canBlock who={msg.sender_name} onDone={onBlocked} />
            <BlockButton userId={msg.sender_id} name={msg.sender_name || L('Membre')} onDone={onBlocked} />
          </>
        ) : null}
        {canReport(msg, me) && demo ? (
          <>
            <Button small variant="ghost" icon="flag-outline" title="Signaler" onPress={() => {}} />
            <Button small variant="ghost" icon="ban-outline" title="Bloquer" onPress={() => {}} />
          </>
        ) : null}
      </Row>
      {confirmDel ? <Muted style={{ fontSize: 12 }}>{other ? 'Le message sera effacé pour tout le groupe ; une copie reste à la seule équipe de modération.' : 'Le message sera effacé pour tout le groupe.'}</Muted> : null}
    </Card>
  );
}
