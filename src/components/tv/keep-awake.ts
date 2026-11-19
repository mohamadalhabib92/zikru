import { useEffect } from 'react';
import { Platform } from 'react-native';

/**
 * L’iPhone empêche la veille pendant la lecture. Apple TV n’a pas ce verrou :
 * charger ExpoKeepAwake y appelle un module natif qui ferme l’app.
 */
export function useTvKeepAwake(tag: string) {
  useEffect(() => {
    if (Platform.isTV) return;
    let stop = () => {};
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const k = require('expo-keep-awake') as typeof import('expo-keep-awake');
      void k.activateKeepAwakeAsync(tag).catch(() => {});
      stop = () => {
        void k.deactivateKeepAwake(tag).catch(() => {});
      };
    } catch {
      stop = () => {};
    }
    return () => stop();
  }, [tag]);
}
