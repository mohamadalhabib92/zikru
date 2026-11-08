/**
 * Le module d'appel natif (WebRTC + LiveKit) est-il présent dans ce binaire ? Les builds publiés avant les appels
 * (ex. 61) ne l'ont pas : on affiche alors « Bientôt disponible » au lieu de charger un module qui planterait.
 */
import { NativeModules, Platform, TurboModuleRegistry } from 'react-native';

const has = (name: string) => {
  try {
    return !!(NativeModules[name] || TurboModuleRegistry.get(name));
  } catch {
    return false;
  }
};

export function callsSupported(): boolean {
  if (Platform.OS === 'web') return typeof (globalThis as { RTCPeerConnection?: unknown }).RTCPeerConnection === 'function';
  return has('WebRTCModule') && has('LivekitReactNativeModule');
}
