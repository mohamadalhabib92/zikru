/**
 * Média web (PWA) : livekit-client directement (WebRTC du navigateur). Chargé seulement depuis l'écran d'appel.
 */
import { RoomEvent, Track, type Participant, type RemoteTrack, type Room, type TrackPublication } from 'livekit-client';
import { createElement, useEffect, useRef } from 'react';
import { View, type ViewStyle } from 'react-native';

export async function prepareMedia(): Promise<void> {}
export async function releaseMedia(): Promise<void> {}

/** Le navigateur ne joue l'audio distant que s'il est attaché à un élément <audio>. */
export function bindRemoteAudio(room: Room): () => void {
  const els = new Map<string, HTMLMediaElement>();
  const on = (track: RemoteTrack) => {
    if (track.kind !== Track.Kind.Audio || !track.sid) return;
    const el = track.attach();
    el.style.display = 'none';
    document.body.appendChild(el);
    els.set(track.sid, el);
  };
  const off = (track: RemoteTrack) => {
    track.detach().forEach((e) => e.remove());
    if (track.sid) els.delete(track.sid);
  };
  room.on(RoomEvent.TrackSubscribed, on).on(RoomEvent.TrackUnsubscribed, off);
  return () => {
    room.off(RoomEvent.TrackSubscribed, on).off(RoomEvent.TrackUnsubscribed, off);
    els.forEach((e) => e.remove());
    els.clear();
  };
}

export function VideoTile({ publication, mirror, style }: { participant: Participant; publication: TrackPublication; mirror?: boolean; style?: ViewStyle }) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const track = publication.track;
  useEffect(() => {
    const el = ref.current;
    if (!el || !track) return;
    track.attach(el);
    return () => {
      track.detach(el);
    };
  }, [track]);
  return (
    <View style={[{ overflow: 'hidden', backgroundColor: '#000' }, style]}>
      {createElement('video', {
        ref,
        autoPlay: true,
        playsInline: true,
        muted: true,
        style: { width: '100%', height: '100%', objectFit: 'cover', transform: mirror ? 'scaleX(-1)' : undefined },
      })}
    </View>
  );
}
