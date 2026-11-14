/**
 * Média natif (iOS / Android) : @livekit/react-native (WebRTC). Chargé seulement depuis l'écran d'appel,
 * lui-même chargé à la demande, et seulement si callsSupported() a vu les modules natifs dans ce binaire.
 */
import { AndroidAudioTypePresets, AudioSession, registerGlobals, VideoTrack } from '@livekit/react-native';
import type { Participant, Room, TrackPublication } from 'livekit-client';
import { Track } from 'livekit-client';
import { Platform, type ViewStyle } from 'react-native';

let globalsDone = false;
export async function prepareMedia(): Promise<void> {
  if (!globalsDone) {
    registerGlobals();
    globalsDone = true;
  }
  // Bluetooth d’abord, puis casque, haut-parleur. Mode voix : annulation d’écho côté système.
  await AudioSession.configureAudio({
    android: {
      preferredOutputList: ['bluetooth', 'headset', 'speaker', 'earpiece'],
      audioTypeOptions: AndroidAudioTypePresets.communication,
    },
    ios: { defaultOutput: 'speaker' },
  });
  if (Platform.OS === 'ios') {
    await AudioSession.setAppleAudioConfiguration({
      audioCategory: 'playAndRecord',
      audioCategoryOptions: ['allowBluetooth', 'allowBluetoothA2DP', 'defaultToSpeaker'],
      audioMode: 'videoChat',
    });
  }
  await AudioSession.startAudioSession();
}

/** Haut-parleur, écouteur, ou le sélecteur iOS (Bluetooth, AirPlay). */
export async function setSpeaker(on: boolean): Promise<void> {
  const outputs = await AudioSession.getAudioOutputs();
  if (Platform.OS === 'ios') {
    const id = on ? 'force_speaker' : 'default';
    if (outputs.includes(id)) await AudioSession.selectAudioOutput(id);
    return;
  }
  const id = on ? 'speaker' : outputs.includes('bluetooth') ? 'bluetooth' : outputs.includes('earpiece') ? 'earpiece' : 'speaker';
  if (outputs.includes(id)) await AudioSession.selectAudioOutput(id);
}

export async function showRoutePicker(): Promise<void> {
  if (Platform.OS === 'ios') await AudioSession.showAudioRoutePicker();
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
