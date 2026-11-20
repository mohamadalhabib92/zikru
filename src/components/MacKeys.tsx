import { router } from 'expo-router';
import { useEffect } from 'react';
import { isIosAppOnMac } from '@/lib/mac';
import { macNative } from '@/lib/mac-native';

/** Échap : retour. Cmd+F : recherche. Sans effet sur iPhone. */
export function MacKeys() {
  useEffect(() => {
    if (!isIosAppOnMac()) return;
    const native = macNative();
    if (!native?.installKeys || !native.addListener) return;
    native.installKeys();
    const sub = native.addListener('onKey', (e) => {
      if (e?.key === 'escape') {
        if (router.canGoBack()) router.back();
        return;
      }
      if (e?.key === 'find') router.push('/search');
    });
    return () => sub.remove();
  }, []);
  return null;
}
