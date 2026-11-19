import { Stack } from 'expo-router';
import { lazy, Suspense } from 'react';
import { ActivityIndicator } from 'react-native';
import { brand as b } from '@/ui/theme';

/**
 * Appel de groupe audio / vidéo d’une famille ou d’un cercle (/call?scope=family|circle&id=…).
 * Écran, WebRTC / LiveKit et traductions chargés à la demande, hors chargement initial.
 */
const CallScreen = lazy(() => import('@/components/call/module').then((m) => ({ default: m.CallScreen })));

export default function CallRoute() {
  return (
    <Suspense
      fallback={
        <>
          <Stack.Screen options={{ title: '' }} />
          <ActivityIndicator color={b.green} style={{ marginTop: 48 }} />
        </>
      }
    >
      <CallScreen />
    </Suspense>
  );
}
