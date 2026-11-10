/**
 * Réglages LiveKit appliqués à chaque appel. Chiffré en transit, pas encore de bout en bout.
 * Aucune option de chiffrement de bout en bout (flux insérables) : pas encore activée.
 */
import {
  AudioPresets,
  DefaultReconnectPolicy,
  VideoPresets,
  type RoomOptions,
  type TrackPublishOptions,
  type VideoCaptureOptions,
} from 'livekit-client';
import { AUDIO, captureProfile, reconnectDelaysMs, type DataMode } from '@/lib/calls/quality';

export function roomOptions(): RoomOptions {
  return {
    adaptiveStream: true,
    dynacast: true,
    audioCaptureDefaults: {
      echoCancellation: AUDIO.echoCancellation,
      noiseSuppression: AUDIO.noiseSuppression,
      autoGainControl: AUDIO.autoGainControl,
      channelCount: AUDIO.channelCount,
    },
    publishDefaults: {
      dtx: AUDIO.dtx,
      red: AUDIO.red,
      audioPreset: AudioPresets.speech,
      simulcast: true,
      videoCodec: 'vp8',
      backupCodec: { codec: 'h264' },
      degradationPreference: 'maintain-framerate',
      videoSimulcastLayers: [VideoPresets.h180, VideoPresets.h360],
    },
    reconnectPolicy: new DefaultReconnectPolicy(reconnectDelaysMs()),
  };
}

export function micCapture() {
  return {
    echoCancellation: AUDIO.echoCancellation,
    noiseSuppression: AUDIO.noiseSuppression,
    autoGainControl: AUDIO.autoGainControl,
    channelCount: AUDIO.channelCount,
  };
}

export function cameraOptions(mode: DataMode, participants: number): { capture: VideoCaptureOptions; publish: TrackPublishOptions } {
  const p = captureProfile(mode, Math.max(1, participants));
  const layers = !p.simulcast ? [] : p.height >= 720 ? [VideoPresets.h180, VideoPresets.h360] : [VideoPresets.h180];
  return {
    capture: { resolution: { width: p.width, height: p.height, frameRate: p.maxFramerate } },
    publish: {
      dtx: AUDIO.dtx,
      red: AUDIO.red,
      simulcast: p.simulcast,
      videoCodec: 'vp8',
      backupCodec: p.simulcast ? { codec: 'h264' } : false,
      degradationPreference: 'maintain-framerate',
      videoEncoding: { maxBitrate: p.maxBitrate, maxFramerate: p.maxFramerate },
      videoSimulcastLayers: layers,
    },
  };
}
