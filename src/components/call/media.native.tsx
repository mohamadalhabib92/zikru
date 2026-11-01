/**
 * Média natif (iOS / Android) : @livekit/react-native (WebRTC). Chargé seulement depuis l'écran d'appel,
 * lui-même chargé à la demande, et seulement si callsSupported() a vu les modules natifs dans ce binaire.
 */
import { AudioSession, registerGlobals, VideoTrack } from '@livekit/react-native';
import type { Participant, Room, TrackPublication } from 'livekit-client';
import { Track } from 'livekit-client';
import type { ViewStyle } from 'react-native';

let globalsDone = false;
export async function prepareMedia(): Promise<void> {
  if (!globalsDone) {
    registerGlobals();
    globalsDone = true;
  }
  await AudioSession.startAudioSession();
}
export async function releaseMedia(): Promise<void> {
  await AudioSession.stopAudioSession().catch(() => {});
}
/** Sur mobile, le son des autres est joué par le module natif dès l'abonnement. */
export function bindRemoteAudio(_room: Room): () => void {
  return () => {};
}

export function VideoTile({ participant, publication, mirror, style }: { participant: Participant; publication: TrackPublication; mirror?: boolean; style?: ViewStyle }) {
  return <VideoTrack trackRef={{ participant, publication, source: Track.Source.Camera }} mirror={mirror} objectFit="cover" style={style} />;
}
