import { Stack } from 'expo-router';
import { lazy, Suspense } from 'react';
import { ActivityIndicator } from 'react-native';
import { brand as b } from '@/ui/theme';

/**
 * Discussion de groupe d’une famille ou d’un cercle (/discussion?scope=family|circle&id=…).
 * Écran, file d’envoi hors ligne et traductions chargés à la demande, hors chargement initial de la PWA.
 */
const Discussion = lazy(() => import('@/components/chat/module').then((m) => ({ default: m.Discussion })));

export default function DiscussionRoute() {
  return (
    <Suspense
      fallback={
        <>
          <Stack.Screen options={{ title: '' }} />
          <ActivityIndicator color={b.green} style={{ marginTop: 48 }} />
        </>
      }
    >
      <Discussion />
    </Suspense>
  );
}
