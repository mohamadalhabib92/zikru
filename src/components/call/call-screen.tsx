/**
 * Appel de groupe audio / vidéo (familles et cercles) — v1, LiveKit.
 * « chiffré en transit, pas encore de bout en bout » : le son et l'image passent par le serveur LiveKit.
 * Aucun enregistrement. Le serveur décide de tout : qui entre (call_join), qui peut publier la caméra (jeton),
 * qui peut couper un micro ou retirer quelqu'un (call_moderate). Ici : affichage, micro / caméra, signaler, bloquer.
 */
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { DisconnectReason, Room, RoomEvent, Track, type Participant, type RemoteParticipant } from 'livekit-client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, ScrollView, View } from 'react-native';
import { BlockButton, confirmAsk, ReportButton } from '@/components/community/parts';
import { callRights, CallError, endCall, joinCall, moderateCall } from '@/lib/calls/api';
import { availability, canModerate, canReport, fmtDuration, isSoonReason, LABEL_TRANSIT, orderPeople, parseMeta, reasonText, type CallAvailability, type CallScope, type Person } from '@/lib/calls/core';
import { callsSupported } from '@/lib/calls/support';
import * as api from '@/lib/community/api';
import { useAuth } from '@/lib/community/auth';
import { L } from '@/lib/l10n';
import { usePremium } from '@/lib/premium';
import { Badge, Button, Card, Eyebrow, H1, H2, Ionicons, Muted, Notice, Row, Screen, Spacer, Toggle } from '@/ui/kit';
import { Text } from '@/ui/Text';
import { theme as t } from '@/ui/theme';
import { bindRemoteAudio, prepareMedia, releaseMedia, setSpeaker, showRoutePicker, VideoTile } from './media';
import { cameraOptions, micCapture, roomOptions } from './room-options';
import type { DataMode } from '@/lib/calls/quality';
import { SharedReading } from '@/components/lesson/shared-reading';
import { TeachLayout } from '@/components/call/teach-panel';
import { PremiumPaywall } from '@/components/premium/paywall';
import { READING_TOPIC, decodeReading, readingBytes, readingText } from '@/lib/lessons/reading';
import { TEACH_TOPIC, acceptTeach, decodeTeach, encodeTeach, teachBytes, teachText, type TeachBoard } from '@/lib/calls/teach';

type Phase = 'loading' | 'lobby' | 'joining' | 'in' | 'ended';
const KEEP_AWAKE = 'zikru-call';

export default function CallScreen() {
  const p = useLocalSearchParams<{ scope?: string; id?: string; name?: string; lesson?: string }>();
  const scope: CallScope = p.scope === 'family' ? 'family' : 'circle';
  const sid = String(p.id ?? '');
  const lessonId = /^[0-9a-f-]{36}$/i.test(String(p.lesson ?? '')) ? String(p.lesson) : '';
  const title = String(p.name ?? '') || L('Appel de groupe');
  const { userId } = useAuth();
  const premium = usePremium();

  const [av, setAv] = useState<CallAvailability>({ kind: 'hidden' });
  const [phase, setPhase] = useState<Phase>('loading');
  const [withMic, setWithMic] = useState(false);
  const [withVideo, setWithVideo] = useState(false);
  const [lowData, setLowData] = useState(false);
  const [speaker, setSpeakerOn] = useState(true);
  const dataMode: DataMode = lowData ? 'low-data' : 'standard';
  const [err, setErr] = useState<string | null>(null);
  const [endNote, setEndNote] = useState<string | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [admin, setAdmin] = useState(false);
  const [videoOk, setVideoOk] = useState(false);
  const [mic, setMic] = useState(true);
  const [cam, setCam] = useState(false);
  const [startedAt, setStartedAt] = useState(0);
  const [now, setNow] = useState(0);
  const [active, setActive] = useState<Room | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [remoteReading, setRemoteReading] = useState<string | null>(null);
  const [paywall, setPaywall] = useState(false);
  const [board, setBoard] = useState<TeachBoard | null>(null);
  const [teachOn, setTeachOn] = useState(false);
  const [teachLocked, setTeachLocked] = useState(false);
  const boardRef = useRef<TeachBoard | null>(null);
  const adminRef = useRef(false);
  const room = useRef<Room | null>(null);
  const unbind = useRef<() => void>(() => {});
  const hiddenRef = useRef(hidden);
  useEffect(() => {
    hiddenRef.current = hidden;
  }, [hidden]);

  useEffect(() => {
    boardRef.current = board;
  }, [board]);
  useEffect(() => {
    adminRef.current = admin;
  }, [admin]);

  const publishBoard = useCallback((next: TeachBoard) => {
    setBoard(next);
    const live = room.current;
    if (!live || !adminRef.current) return;
    void live.localParticipant.publishData(teachBytes(encodeTeach(next)), { reliable: true, topic: TEACH_TOPIC }).catch(() => {});
  }, []);

  useEffect(() => {
    const r = active;
    if (!r) return;
    const onTeach = (payload: Uint8Array, who?: { metadata?: string }, _kind?: unknown, topic?: string) => {
      if (topic !== TEACH_TOPIC || !who || !parseMeta(who.metadata).admin) return;
      const next = decodeTeach(teachText(payload));
      if (!next || next.callId !== sid) return;
      setBoard((prev) => acceptTeach(prev, next) ?? prev);
      if (next.kind !== 'off') setTeachOn(true);
    };
    r.on(RoomEvent.DataReceived, onTeach);
    const onJoin = () => {
      const current = boardRef.current;
      if (adminRef.current && current && current.kind !== 'off') {
        void r.localParticipant.publishData(teachBytes(encodeTeach(current)), { reliable: true, topic: TEACH_TOPIC }).catch(() => {});
      }
    };
    r.on(RoomEvent.ParticipantConnected, onJoin);
    return () => {
      r.off(RoomEvent.DataReceived, onTeach);
      r.off(RoomEvent.ParticipantConnected, onJoin);
    };
  }, [active, sid]);

  useEffect(() => {
    const r = active;
    if (!r || !lessonId) return;
    const onData = (payload: Uint8Array, _who?: unknown, _kind?: unknown, topic?: string) => {
      if (topic !== READING_TOPIC) return;
      const text = readingText(payload);
      if (decodeReading(text)?.lessonId === lessonId) setRemoteReading(text);
    };
    r.on(RoomEvent.DataReceived, onData);
    return () => {
      r.off(RoomEvent.DataReceived, onData);
    };
  }, [active, lessonId]);

  // ---------- Droits (kill-switch serveur, module natif présent ?) ----------
  useEffect(() => {
    let on = true;
    void callRights(scope, sid).then((r) => {
      if (!on) return;
      if (r.offline) {
        setErr(reasonText('offline'));
        setAv({ kind: 'hidden' });
      } else setAv(availability(r.rights, { missing: r.missing, nativeOk: callsSupported() }));
      setPhase('lobby');
    });
    return () => {
      on = false;
    };
  }, [scope, sid]);

  // ---------- Participants ----------
  const refresh = useCallback(() => {
    const r = room.current;
    if (!r) return;
    const toPerson = (x: Participant, local: boolean): Person => ({
      identity: x.identity,
      name: x.name || L('Membre'),
      admin: parseMeta(x.metadata).admin,
      speaking: x.isSpeaking,
      micOn: x.isMicrophoneEnabled,
      camOn: x.isCameraEnabled,
      local,
    });
    const list = [toPerson(r.localParticipant, true), ...[...r.remoteParticipants.values()].filter((x) => !hiddenRef.current.has(x.identity)).map((x) => toPerson(x, false))];
    setPeople(orderPeople(list));
    setMic(r.localParticipant.isMicrophoneEnabled);
    setCam(r.localParticipant.isCameraEnabled);
  }, []);

  /** Abonnements : audio de chacun ; vidéo seulement si autorisée pour moi ; jamais une personne bloquée. */
  const syncSubs = useCallback(
    (x: RemoteParticipant) => {
      const blocked = hiddenRef.current.has(x.identity);
      x.trackPublications.forEach((pub) => {
        const want = !blocked && (pub.kind === Track.Kind.Audio || (pub.kind === Track.Kind.Video && videoOk && pub.source === Track.Source.Camera));
        if (pub.isSubscribed !== want) pub.setSubscribed(want);
      });
    },
    [videoOk],
  );
  useEffect(() => {
    room.current?.remoteParticipants.forEach(syncSubs);
    refresh();
  }, [hidden, syncSubs, refresh]);

  const leave = useCallback(async () => {
    const r = room.current;
    room.current = null;
    setActive(null);
    unbind.current();
    unbind.current = () => {};
    if (r) await r.disconnect().catch(() => {});
    void releaseMedia();
    deactivateKeepAwake(KEEP_AWAKE);
  }, []);
  useEffect(() => () => void leave(), [leave]);

  useEffect(() => {
    if (phase !== 'in') return;
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, [phase]);

  const join = async () => {
    if (av.kind !== 'ready') return;
    if ((premium.ready && !premium.canCreate) || av.needsPremium) {
      setPaywall(true);
      return;
    }
    setErr(null);
    setPhase('joining');
    try {
      // Le jeton peut autoriser la caméra ; elle reste éteinte tant que la personne ne l’ouvre pas.
      const info = await joinCall(scope, sid, av.video);
      await prepareMedia();
      const r = new Room(roomOptions());
      room.current = r;
      setAdmin(info.admin);
      setVideoOk(av.video);
      unbind.current = bindRemoteAudio(r);
      const sub = (x: RemoteParticipant) => syncSubs(x);
      r.on(RoomEvent.ParticipantConnected, (x) => (sub(x), refresh()))
        .on(RoomEvent.TrackPublished, (_pub, x) => (sub(x), refresh()))
        .on(RoomEvent.ParticipantDisconnected, refresh)
        .on(RoomEvent.TrackSubscribed, refresh)
        .on(RoomEvent.TrackUnsubscribed, refresh)
        .on(RoomEvent.TrackMuted, refresh)
        .on(RoomEvent.TrackUnmuted, refresh)
        .on(RoomEvent.LocalTrackPublished, refresh)
        .on(RoomEvent.LocalTrackUnpublished, refresh)
        .on(RoomEvent.ActiveSpeakersChanged, refresh)
        .on(RoomEvent.ParticipantMetadataChanged, refresh)
        .on(RoomEvent.Disconnected, (reason?: DisconnectReason) => {
          if (room.current !== r) return;
          void leave();
          setEndNote(reason === DisconnectReason.PARTICIPANT_REMOVED ? L('Un hôte vous a retiré·e de l’appel.') : reason === DisconnectReason.ROOM_DELETED ? L('L’appel est terminé.') : L('Vous avez quitté l’appel.'));
          setPhase('ended');
        });
      // Pas de réception auto : on choisit les pistes (vidéo autorisée ? personne bloquée ?).
      await r.connect(info.url, info.token, { autoSubscribe: false });
      r.remoteParticipants.forEach(sub);
      void activateKeepAwakeAsync(KEEP_AWAKE).catch(() => {});
      const t0 = Date.now();
      setStartedAt(t0);
      setNow(t0);
      setActive(r);
      setPhase('in');
      const peopleNow = r.remoteParticipants.size + 1;
      if (withMic) {
        try {
          await r.localParticipant.setMicrophoneEnabled(true, micCapture());
        } catch {
          setErr(L('Autorisez le micro dans les réglages du téléphone pour parler. Vous pouvez écouter en attendant.'));
        }
      }
      if (info.video && withVideo) {
        const cam = cameraOptions(dataMode, peopleNow);
        await r.localParticipant.setCameraEnabled(true, cam.capture, cam.publish).catch(() => setErr(L('Caméra indisponible ou refusée : l’appel continue en audio.')));
      }
      refresh();
    } catch (e) {
      await leave();
      const reason = e instanceof CallError ? e.reason : /network|fetch|websocket|connect/i.test(String((e as Error)?.message)) ? 'offline' : 'livekit';
      if (reason === 'premium_required' || reason === 'premium_host') {
        setPaywall(true);
        setPhase('lobby');
        return;
      }
      if (isSoonReason(reason)) setAv({ kind: 'soon' });
      setErr(reasonText(reason) === 'Bientôt disponible' ? null : L(reasonText(reason)));
      setPhase('lobby');
    }
  };

  const toggleMic = async () => {
    const r = room.current;
    if (!r) return;
    const next = !r.localParticipant.isMicrophoneEnabled;
    await r.localParticipant.setMicrophoneEnabled(next, next ? micCapture() : undefined).catch(() => setErr(L('Micro indisponible.')));
    refresh();
  };
  const applyCamera = async (on: boolean, mode: DataMode) => {
    const r = room.current;
    if (!r) return;
    if (!on) {
      await r.localParticipant.setCameraEnabled(false).catch(() => setErr(L('Caméra indisponible ou refusée : l’appel continue en audio.')));
    } else {
      const cam = cameraOptions(mode, r.remoteParticipants.size + 1);
      await r.localParticipant.setCameraEnabled(true, cam.capture, cam.publish).catch(() => setErr(L('Caméra indisponible ou refusée : l’appel continue en audio.')));
    }
    refresh();
  };
  const toggleCam = () => {
    const r = room.current;
    if (!r) return;
    void applyCamera(!r.localParticipant.isCameraEnabled, dataMode);
  };
  const moderate = (who: Person, action: 'mute' | 'remove') =>
    moderateCall(scope, sid, action, who.identity)
      .then(() => refresh())
      .catch((e) => setErr(L(reasonText(e instanceof CallError ? e.reason : 'livekit'))));

  // ---------- Rendu ----------
  if (phase === 'loading')
    return (
      <Screen>
        <Stack.Screen options={{ title }} />
        <Muted>Préparation de l’appel</Muted>
      </Screen>
    );

  if (phase === 'ended')
    return (
      <Screen>
        <Stack.Screen options={{ title }} />
        <Notice tone="info" title="Appel terminé" text={endNote ?? undefined} />
        <Spacer />
        <Button title="Retour au groupe" icon="arrow-back" onPress={() => router.back()} />
      </Screen>
    );

  if (phase !== 'in')
    return (
      <Screen>
        <Stack.Screen options={{ title }} />
        <Eyebrow>Appel de groupe</Eyebrow>
        <H1>{title}</H1>
        <Muted>{L(LABEL_TRANSIT)}</Muted>
        <Spacer />
        {av.kind === 'soon' ? <Notice tone="info" title="Bientôt disponible" text={L(callsSupported() ? 'Les appels de groupe ne sont pas encore ouverts.' : 'Les appels arrivent avec une prochaine version de l’app.')} /> : null}
        {av.kind === 'blocked' ? <Notice tone="warning" title="Appel indisponible" text={L(reasonText(av.reason))} /> : null}
        {av.kind === 'hidden' && !err ? <Notice tone="info" title="Réservé aux membres du groupe." /> : null}
        {av.kind === 'ready' ? (
          <Card>
            <H2>Rejoindre l’appel</H2>
            <Muted>Aucun enregistrement. Le son et l’image passent par notre serveur d’appels (LiveKit), sans être conservés.</Muted>
            <Muted>{L('Le micro et la caméra restent éteints tant que vous ne les ouvrez pas.')}</Muted>
            <Muted>{L('Jusqu’à {n} personnes.', { n: av.max })}</Muted>
            <Spacer h={8} />
            <Toggle label="Ouvrir mon micro" hint="Le micro reste coupé tant que vous ne l’ouvrez pas." value={withMic} onChange={setWithMic} />
            <Toggle
              label="Économie de données"
              hint="Moins d’image, le son d’abord. Utile en 4G ou si la batterie est basse."
              value={lowData}
              onChange={setLowData}
            />
            {av.video ? (
              <Toggle label="Avec la vidéo" hint="La caméra reste éteinte, sauf si vous la cochez ici ou si vous l’allumez pendant l’appel." value={withVideo} onChange={setWithVideo} />
            ) : (
              <Muted style={{ fontSize: 12 }}>{L(av.mixedClosed ? 'La vidéo de cette classe est fermée. L’enseignant peut l’ouvrir.' : av.videoNeedsConsent ? 'Audio seulement : la vidéo demande l’accord d’un parent.' : 'Audio seulement.')}</Muted>
            )}
            <Spacer h={8} />
            {paywall ? (
              <PremiumPaywall title="Cet appel demande Zikru Premium." text="Tout le monde dans l’appel doit avoir Zikru Premium, y compris les personnes invitées." />
            ) : (
              <Button title={withVideo && av.video ? 'Rejoindre en vidéo' : withMic ? 'Rejoindre en audio' : 'Rejoindre en silence'} icon={withVideo && av.video ? 'videocam' : 'call'} loading={phase === 'joining'} onPress={() => void join()} />
            )}
          </Card>
        ) : null}
        {err ? <Notice tone="warning" title={err} /> : null}
      </Screen>
    );

  const r = active;
  const remoteOf = (id: string) => r?.remoteParticipants.get(id);
  const camPub = (x: Participant | undefined) => x?.getTrackPublication(Track.Source.Camera);
  const liveBoard = board && board.kind !== 'off' ? board : null;
  const showTeach = teachOn || !!liveBoard;
  const tile = (who: Person, tall: boolean) => {
    const part = who.local ? r?.localParticipant : remoteOf(who.identity);
    const pub = camPub(part);
    const showVideo = who.camOn && pub && (who.local || (videoOk && pub.isSubscribed));
    return (
      <Card key={who.identity} onPress={who.local ? undefined : () => setOpen(open === who.identity ? null : who.identity)} accessibilityLabel={who.name}>
        {showVideo && part && pub ? <VideoTile participant={part} publication={pub} mirror={who.local} style={{ height: tall ? 280 : 120, borderRadius: 12, marginBottom: 8 }} /> : tall ? <Muted>{L('Caméra éteinte')}</Muted> : null}
        <Row gap={8} style={{ alignItems: 'center' }}>
          <Ionicons name={who.micOn ? 'mic' : 'mic-off'} size={18} color={who.speaking ? t.primary : who.micOn ? t.text : t.muted} accessibilityLabel={L(who.micOn ? 'Micro ouvert' : 'Micro coupé')} />
          <Text style={{ color: t.text, fontSize: 16, fontWeight: who.speaking ? '700' : '500', flex: 1 }}>
            {who.name}
            {who.local ? ` (${L('moi')})` : ''}
          </Text>
          {who.admin ? <Badge label="Hôte" tone="info" /> : null}
        </Row>
        {open === who.identity && !who.local ? (
          <Row wrap gap={6} style={{ marginTop: 8 }}>
            {canModerate(admin, who) && who.micOn ? <Button small variant="ghost" icon="mic-off-outline" title="Couper son micro" onPress={() => void moderate(who, 'mute')} /> : null}
            {canModerate(admin, who) ? (
              <Button
                small
                variant="ghost"
                icon="exit-outline"
                title="Retirer de l’appel"
                onPress={() => confirmAsk(L('Retirer {name} de l’appel ?', { name: who.name }), 'Elle pourra rejoindre l’appel à nouveau. Si le problème continue, signalez-la ou retirez-la du groupe.', 'Retirer', () => void moderate(who, 'remove'))}
              />
            ) : null}
            {canReport(who) ? <ReportButton target="member" targetId={who.identity} scope={scope as api.ScopeType} scopeId={sid} canBlock who={who.name} onDone={() => setHidden((h) => new Set(h).add(who.identity))} /> : null}
            {canReport(who) && userId ? <BlockButton userId={who.identity} name={who.name} onDone={() => setHidden((h) => new Set(h).add(who.identity))} /> : null}
          </Row>
        ) : null}
      </Card>
    );
  };
  const teacher = people.find((who) => who.admin) ?? people.find((who) => who.local);
  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Stack.Screen options={{ title }} />
      {showTeach ? (
        <View style={{ flex: 1, paddingBottom: 108 }}>
          <Row style={{ justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8 }}>
            <Muted>{L('{n} dans l’appel', { n: people.length })} · {fmtDuration(now - startedAt)}</Muted>
            <Badge label={L(LABEL_TRANSIT)} tone="neutral" />
          </Row>
          {err ? <Notice tone="warning" title={err} /> : null}
          {teachLocked ? <Notice tone="info" title={L('Conduire la lecture demande Zikru Premium. Les personnes déjà dans l’appel la voient sans nouvel achat.')} /> : null}
          <TeachLayout callId={sid} board={board} host={admin} premium={premium.ready && premium.canCreate} video={
            <ScrollView contentContainerStyle={{ padding: 12, gap: 8 }}>
              {teacher ? tile(teacher, true) : null}
              {people.filter((who) => who.identity !== teacher?.identity).map((who) => tile(who, false))}
            </ScrollView>
          } onBoard={(next) => {
            publishBoard(next);
            if (next.kind === 'off') setTeachOn(false);
          }} />
        </View>
      ) : (
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 140 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Muted>{L('{n} dans l’appel', { n: people.length })} · {fmtDuration(now - startedAt)}</Muted>
          <Badge label={L(LABEL_TRANSIT)} tone="neutral" />
        </Row>
        {err ? <Notice tone="warning" title={err} /> : null}
        <Spacer h={8} />
        {people.map((who) => tile(who, false))}
        {hidden.size ? <Muted style={{ fontSize: 12 }}>Vous n’entendez plus et ne voyez plus les personnes bloquées pendant cet appel.</Muted> : null}
        {lessonId ? (
          <SharedReading
            lessonId={lessonId}
            embedded
            remoteRaw={remoteReading}
            onBroadcast={(json) => {
              const live = room.current;
              if (!live) return;
              void live.localParticipant.publishData(readingBytes(json), { reliable: true, topic: READING_TOPIC }).catch(() => {});
            }}
          />
        ) : null}
      </ScrollView>
      )}
      <Row gap={10} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16, paddingBottom: Platform.OS === 'ios' ? 32 : 16, justifyContent: 'center', backgroundColor: t.surface }}>
        <Button small variant={mic ? 'secondary' : 'primary'} icon={mic ? 'mic' : 'mic-off'} title={mic ? 'Couper le micro' : 'Ouvrir le micro'} onPress={() => void toggleMic()} />
        {videoOk ? <Button small variant={cam ? 'secondary' : 'ghost'} icon={cam ? 'videocam' : 'videocam-off'} title={cam ? 'Éteindre la caméra' : 'Allumer la caméra'} onPress={() => void toggleCam()} /> : null}
        <Button
          small
          variant={lowData ? 'secondary' : 'ghost'}
          icon="cellular-outline"
          title="Économie de données"
          onPress={() => {
            const next = !lowData;
            setLowData(next);
            if (room.current?.localParticipant.isCameraEnabled) void applyCamera(true, next ? 'low-data' : 'standard');
          }}
        />
        {Platform.OS === 'web' ? null : (
          <Button
            small
            variant={speaker ? 'secondary' : 'ghost'}
            icon={speaker ? 'volume-high-outline' : 'ear-outline'}
            title={speaker ? 'Haut-parleur' : 'Écouteur'}
            onPress={() => {
              const next = !speaker;
              setSpeakerOn(next);
              void (Platform.OS === 'ios' && !next ? showRoutePicker() : setSpeaker(next)).catch(() => setErr(L('Le haut-parleur n’a pas pu être changé.')));
            }}
          />
        )}
        {admin ? (
          <Button
            small
            variant={showTeach ? 'secondary' : 'ghost'}
            icon="book-outline"
            title={L('Enseigner')}
            onPress={() => {
              if (premium.ready && !premium.canCreate) {
                setTeachLocked(true);
                setTeachOn(true);
                return;
              }
              setTeachLocked(false);
              setTeachOn(true);
            }}
          />
        ) : null}
        {admin ? (
          <Button
            small
            variant="danger"
            icon="close-circle-outline"
            title="Terminer l’appel"
            onPress={() =>
              confirmAsk(L('Terminer l’appel pour tout le monde ?'), 'Tout le monde sera déconnecté. Rien n’est enregistré.', 'Terminer', () =>
                void endCall(scope, sid)
                  .then(() => leave())
                  .then(() => {
                    setEndNote(L('L’appel est terminé.'));
                    setPhase('ended');
                  })
                  .catch((e) => setErr(L(reasonText(e instanceof CallError ? e.reason : 'livekit')))),
              )
            }
          />
        ) : null}
        <Button
          small
          variant="danger"
          icon="call"
          title="Quitter"
          onPress={() =>
            void leave().then(() => {
              setEndNote(L('Vous avez quitté l’appel.'));
              setPhase('ended');
            })
          }
        />
      </Row>
    </View>
  );
}
