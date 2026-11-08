import { Stack, useLocalSearchParams } from 'expo-router';
import { lazy, Suspense } from 'react';
import { ActivityIndicator } from 'react-native';
import { brand as b } from '@/ui/theme';

/**
 * Route unique et légère du mode Ramadan (/ramadan?s=compte|jeune|tarawih|nuits|zakat|carte ; sans « s » : accueil).
 * Écrans et traductions sont chargés à la demande, hors chargement initial de la PWA.
 */
const load = () => import('@/components/ramadan/module');
const SCREENS = {
  hub: lazy(() => load().then((m) => ({ default: m.Hub }))),
  compte: lazy(() => load().then((m) => ({ default: m.Compte }))),
  jeune: lazy(() => load().then((m) => ({ default: m.Jeune }))),
  tarawih: lazy(() => load().then((m) => ({ default: m.Tarawih }))),
  nuits: lazy(() => load().then((m) => ({ default: m.Nuits }))),
  zakat: lazy(() => load().then((m) => ({ default: m.Zakat }))),
  carte: lazy(() => load().then((m) => ({ default: m.Carte }))),
};

export default function RamadanRoute() {
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
