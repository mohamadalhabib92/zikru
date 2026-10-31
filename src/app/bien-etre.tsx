import { Stack, useLocalSearchParams } from 'expo-router';
import { lazy, Suspense } from 'react';
import { ActivityIndicator } from 'react-native';
import { brand as b } from '@/ui/theme';

/**
 * Route unique et légère du module bien-être (/bien-etre?s=respiration|meditation|jeux|noms|tajwid ; sans « s » : accueil).
 * Écrans, données et traductions sont chargés à la demande, en un seul morceau, hors chargement initial de la PWA.
 */
const load = () => import('@/components/bien-etre/module');
const SCREENS = {
  hub: lazy(() => load().then((m) => ({ default: m.Hub }))),
  respiration: lazy(() => load().then((m) => ({ default: m.Respiration }))),
  meditation: lazy(() => load().then((m) => ({ default: m.Meditation }))),
  jeux: lazy(() => load().then((m) => ({ default: m.Jeux }))),
  noms: lazy(() => load().then((m) => ({ default: m.Noms }))),
  tajwid: lazy(() => load().then((m) => ({ default: m.Tajwid }))),
};

export default function BienEtreRoute() {
  const { s } = useLocalSearchParams<{ s?: string }>();
  const Screen = SCREENS[(s && s in SCREENS ? s : 'hub') as keyof typeof SCREENS];
  return (
    <Suspense
      fallback={
        <>
          <Stack.Screen options={{ title: '' }} />
          <ActivityIndicator color={b.green} style={{ marginTop: 48 }} />
        </>
      }
    >
      <Screen />
    </Suspense>
  );
}
