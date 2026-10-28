import { Amiri_400Regular, Amiri_700Bold } from '@expo-google-fonts/amiri';
import { AmiriQuran_400Regular } from '@expo-google-fonts/amiri-quran';
import { useFonts } from 'expo-font';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { useColorScheme, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '@/lib/community/auth';
import { CommunityProvider } from '@/lib/community/sync';
import { DataProvider } from '@/lib/data';
import { isRTL } from '@/lib/i18n';
import { SettingsProvider, useSettings } from '@/lib/settings';
import { applyScheme, brand, theme as t, type Scheme } from '@/ui/theme';
import { takePendingRoute } from '@/ui/appearance';
import { GrowthProvider } from '@/lib/growth';
import { ZikrProvider } from '@/lib/zikrs';
import { AppErrorBoundary, ErrorScreen } from '@/components/AppErrorBoundary';

// Écran d'erreur Expo Router pour les erreurs de rendu des routes.
export function ErrorBoundary({ error, retry }: { error: Error; retry: () => Promise<void> }) {
  return <ErrorScreen error={error} retry={() => void retry()} />;
}

function Root() {
  const { s, t: tr } = useSettings();
  const sys = useColorScheme();
  const scheme: Scheme = s.appearance === 'light' || s.appearance === 'dark' ? s.appearance : sys === 'dark' ? 'dark' : 'light';
  // Les jetons sont réécrits AVANT le rendu des enfants ; la clé force un redessin complet.
  applyScheme(scheme);
  const [fontsLoaded] = useFonts({ Amiri_400Regular, Amiri_700Bold, AmiriQuran_400Regular });
  const [fontTimeout, setFontTimeout] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setFontTimeout(true), 2500);
    return () => clearTimeout(id);
  }, []);
  useEffect(() => {
    const r = takePendingRoute();
    if (r) setTimeout(() => router.push(r as never), 60);
  }, [scheme]);
  if (!fontsLoaded && !fontTimeout) return <View style={{ flex: 1, backgroundColor: t.bg }} />;
  return (
    <View key={scheme} style={{ flex: 1, backgroundColor: t.bg, direction: isRTL(s.lang) ? 'rtl' : 'ltr' }}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: brand.cream },
          headerTintColor: brand.ink,
          headerTitleStyle: { fontWeight: '700', fontSize: 17 },
          headerShadowVisible: false,
          headerBackButtonDisplayMode: 'minimal',
          contentStyle: { backgroundColor: t.bg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="sources" options={{ title: tr.sources_title }} />
        <Stack.Screen name="ring" options={{ title: tr.ring }} />
        <Stack.Screen name="qibla" options={{ title: tr.qibla_title }} />
        <Stack.Screen name="dhikr" options={{ title: tr.dhikr_title }} />
        <Stack.Screen name="settings" options={{ title: tr.settings_title }} />
        <Stack.Screen name="search" options={{ title: tr.search }} />
        <Stack.Screen name="tijani" options={{ title: 'Tijaniyya' }} />
        <Stack.Screen name="sahw" options={{ title: tr.sahw }} />
        <Stack.Screen name="kahf" options={{ title: tr.kahf }} />
        <Stack.Screen name="songs" options={{ title: tr.songs }} />
        <Stack.Screen name="community" options={{ title: tr.community }} />
        <Stack.Screen name="config" options={{ title: tr.config_missing }} />
        <Stack.Screen name="content-admin" options={{ title: tr.content_admin }} />
        <Stack.Screen name="audit" options={{ title: tr.audit }} />
        <Stack.Screen name="quran/index" options={{ title: 'Qur’an' }} />
        <Stack.Screen name="quran/[n]" options={{ title: 'Sourate' }} />
        <Stack.Screen name="quran/mushaf" options={{ title: 'Mushaf' }} />
        <Stack.Screen name="quran/hifz" options={{ title: 'Mémorisation' }} />
        <Stack.Screen name="quran/hifz-session" options={{ title: 'Session de mémorisation' }} />
        <Stack.Screen name="quran/bookmarks" options={{ title: 'Marque-pages et notes' }} />
        <Stack.Screen name="quran/khatma" options={{ title: 'Khatma' }} />
        <Stack.Screen name="hadiths" options={{ title: 'Hadiths' }} />
        <Stack.Screen name="duas" options={{ title: 'Du‘as prophétiques' }} />
        <Stack.Screen name="abjad" options={{ title: 'Calculateur abjad' }} />
        <Stack.Screen name="names" options={{ title: 'Les 99 Noms d’Allah' }} />
        <Stack.Screen name="zikrs/index" options={{ title: 'Mes zikrs' }} />
        <Stack.Screen name="zikrs/edit" options={{ title: 'Composer un zikr' }} />
        <Stack.Screen name="zikrs/practice" options={{ title: 'Pratique' }} />
        <Stack.Screen name="fiqh" options={{ title: 'Fiqh' }} />
        <Stack.Screen name="journey" options={{ title: 'Mon parcours spirituel' }} />
        <Stack.Screen name="habits" options={{ title: 'Jardin des habitudes' }} />
        <Stack.Screen name="bilal" options={{ title: 'El Ghaly Bilal' }} />
        <Stack.Screen name="planner" options={{ title: 'Planificateur du jour' }} />
        <Stack.Screen name="auth" options={{ title: 'Connexion' }} />
        <Stack.Screen name="join" options={{ title: 'Rejoindre' }} />
        <Stack.Screen name="family/[id]" options={{ title: 'Ma famille' }} />
        <Stack.Screen name="circle/[id]" options={{ title: 'Mon cercle' }} />
        <Stack.Screen name="live/[id]" options={{ title: 'Zikr en direct' }} />
      </Stack>
    </View>
  );
}

export default function Layout() {
  return (
    <AppErrorBoundary>
      <SafeAreaProvider>
        <SettingsProvider>
          <DataProvider>
            <ZikrProvider>
              <AuthProvider>
                <CommunityProvider>
                  <GrowthProvider>
                    <Root />
                  </GrowthProvider>
                </CommunityProvider>
              </AuthProvider>
            </ZikrProvider>
          </DataProvider>
        </SettingsProvider>
      </SafeAreaProvider>
    </AppErrorBoundary>
  );
}
