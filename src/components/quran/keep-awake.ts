import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useEffect } from 'react';

/** Garde l’écran allumé pendant la lecture (si activé dans les réglages). */
export function useReaderKeepAwake(on: boolean, tag = 'zikru-quran') {
  useEffect(() => {
    if (!on) return;
    activateKeepAwakeAsync(tag).catch(() => {});
    return () => {
      deactivateKeepAwake(tag).catch(() => {});
    };
  }, [on, tag]);
}
