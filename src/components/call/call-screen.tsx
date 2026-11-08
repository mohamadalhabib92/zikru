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
import { ActivityIndicator, Platform, ScrollView, View } from 'react-native';
import { BlockButton, confirmAsk, ReportButton } from '@/components/community/parts';
import { callRights, CallError, joinCall, moderateCall } from '@/lib/calls/api';
import { availability, canModerate, canReport, fmtDuration, isSoonReason, LABEL_TRANSIT, orderPeople, parseMeta, reasonText, type CallAvailability, type CallScope, type Person } from '@/lib/calls/core';
import { callsSupported } from '@/lib/calls/support';
import * as api from '@/lib/community/api';
import { useAuth } from '@/lib/community/auth';
import { L } from '@/lib/l10n';
import { Badge, Button, Card, Eyebrow, H1, H2, Ionicons, Muted, Notice, Row, Screen, Spacer, Toggle } from '@/ui/kit';
import { Text } from '@/ui/Text';
import { theme as t } from '@/ui/theme';
import { bindRemoteAudio, prepareMedia, releaseMedia, VideoTile } from './media';

type Phase = 'loading' | 'lobby' | 'joining' | 'in' | 'ended';
const KEEP_AWAKE = 'zikru-call';

export default function CallScreen() {
  const p = useLocalSearchParams<{ scope?: string; id?: string; name?: string }>();
  const scope: CallScope = p.scope === 'family' ? 'family' : 'circle';
  const sid = String(p.id ?? '');
  const title = String(p.name ?? '') || L('Appel de groupe');
  const { userId } = useAuth();

  const [av, setAv] = useState<CallAvailability>({ kind: 'hidden' });
  const [phase, setPhase] = useState<Phase>('loading');
  const [withVideo, setWithVideo] = useState(false);
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
  const room = useRef<Room | null>(null);
  const unbind = useRef<() => void>(() => {});
  const hiddenRef = useRef(hidden);
  useEffect(() => {
    hiddenRef.current = hidden;
  }, [hidden]);

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
    setErr(null);
    setPhase('joining');
    try {
      const info = await joinCall(scope, sid, withVideo && av.video);
      await prepareMedia();
      const r = new Room({ adaptiveStream: true, dynacast: true });
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
      try {
        await r.localParticipant.setMicrophoneEnabled(true);
      } catch {
        setErr(L('Autorisez le micro dans les réglages du téléphone pour parler. Vous pouvez écouter en attendant.'));
      }
      if (info.video && withVideo) await r.localParticipant.setCameraEnabled(true).catch(() => setErr(L('Caméra indisponible ou refusée : l’appel continue en audio.')));
      refresh();
    } catch (e) {
      await leave();
      const reason = e instanceof CallError ? e.reason : /network|fetch|websocket|connect/i.test(String((e as Error)?.message)) ? 'offline' : 'livekit';
      if (isSoonReason(reason)) setAv({ kind: 'soon' });
      setErr(reasonText(reason) === 'Bientôt disponible' ? null : L(reasonText(reason)));
      setPhase('lobby');
    }
  };

  const toggleMic = async () => {
    const r = room.current;
    if (!r) return;
    await r.localParticipant.setMicrophoneEnabled(!r.localParticipant.isMicrophoneEnabled).catch(() => setErr(L('Micro indisponible.')));
    refresh();
  };
  const toggleCam = async () => {
    const r = room.current;
    if (!r) return;
    await r.localParticipant.setCameraEnabled(!r.localParticipant.isCameraEnabled).catch(() => setErr(L('Caméra indisponible ou refusée : l’appel continue en audio.')));
    refresh();
  };
  const moderate = (who: Person, action: 'mute' | 'remove') =>
    moderateCall(scope, sid, action, who.identity)
      .then(() => refresh())
      .catch((e) => setErr(L(reasonText(e instanceof CallError ? e.reason : 'livekit'))));

  // ---------- Rendu ----------
  if (phase === 'loading')
    return (
      <>
        <Stack.Screen options={{ title }} />
        <ActivityIndicator color={t.primary} style={{ marginTop: 48 }} />
      </>
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
            <Muted>Aucun enregistrement. Le son et l’image passent par notre prestataire d’appels (LiveKit), sans être conservés.</Muted>
            <Muted>{L('Jusqu’à {n} personnes.', { n: av.max })}</Muted>
            <Spacer h={8} />
            {av.video ? (
              <Toggle label="Avec la vidéo" hint="Vous pourrez allumer ou éteindre la caméra pendant l’appel." value={withVideo} onChange={setWithVideo} />
            ) : (
              <Muted style={{ fontSize: 12 }}>{L(av.videoNeedsConsent ? 'Audio seulement : la vidéo demande l’accord d’un parent.' : 'Audio seulement.')}</Muted>
            )}
            <Spacer h={8} />
            <Button title={withVideo && av.video ? 'Rejoindre en vidéo' : 'Rejoindre en audio'} icon={withVideo && av.video ? 'videocam' : 'call'} loading={phase === 'joining'} onPress={() => void join()} />
          </Card>
        ) : null}
        {err ? <Notice tone="warning" title={err} /> : null}
      </Screen>
    );

  const r = active;
  const remoteOf = (id: string) => r?.remoteParticipants.get(id);
  const camPub = (x: Participant | undefined) => x?.getTrackPublication(Track.Source.Camera);
  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Stack.Screen options={{ title }} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 140 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Muted>{L('{n} dans l’appel', { n: people.length })} · {fmtDuration(now - startedAt)}</Muted>
          <Badge label={L(LABEL_TRANSIT)} tone="neutral" />
        </Row>
        {err ? <Notice tone="warning" title={err} /> : null}
        <Spacer h={8} />
        {people.map((who) => {
          const part = who.local ? r?.localParticipant : remoteOf(who.identity);
          const pub = camPub(part);
          const showVideo = who.camOn && pub && (who.local || (videoOk && pub.isSubscribed));
          return (
            <Card key={who.identity} onPress={who.local ? undefined : () => setOpen(open === who.identity ? null : who.identity)} accessibilityLabel={who.name}>
              {showVideo && part && pub ? <VideoTile participant={part} publication={pub} mirror={who.local} style={{ height: 180, borderRadius: 12, marginBottom: 8 }} /> : null}
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
        })}
        {hidden.size ? <Muted style={{ fontSize: 12 }}>Vous n’entendez plus et ne voyez plus les personnes bloquées pendant cet appel.</Muted> : null}
      </ScrollView>
      <Row gap={10} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16, paddingBottom: Platform.OS === 'ios' ? 32 : 16, justifyContent: 'center', backgroundColor: t.surface }}>
        <Button small variant={mic ? 'secondary' : 'primary'} icon={mic ? 'mic' : 'mic-off'} title={mic ? 'Couper le micro' : 'Ouvrir le micro'} onPress={() => void toggleMic()} />
        {videoOk ? <Button small variant={cam ? 'secondary' : 'ghost'} icon={cam ? 'videocam' : 'videocam-off'} title={cam ? 'Éteindre la caméra' : 'Allumer la caméra'} onPress={() => void toggleCam()} /> : null}
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
