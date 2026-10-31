import { Amiri_400Regular, Amiri_700Bold } from '@expo-google-fonts/amiri';
import { AmiriQuran_400Regular } from '@expo-google-fonts/amiri-quran';
import { useFonts } from 'expo-font';
import { router, Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Platform, useColorScheme, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '@/lib/community/auth';
import { CommunityProvider } from '@/lib/community/sync';
import { DataProvider } from '@/lib/data';
import { DispenseProvider } from '@/lib/dispense-context';
import { setBleLang } from '@/lib/ble/messages';
import { isRTL } from '@/lib/i18n';
import { SettingsProvider, useSettings } from '@/lib/settings';
import { applyScheme, brand, theme as t, type Scheme } from '@/ui/theme';
import { takePendingRoute } from '@/ui/appearance';
import { GrowthProvider } from '@/lib/growth';
import { ZikrProvider } from '@/lib/zikrs';
import { AppErrorBoundary, ErrorScreen } from '@/components/AppErrorBoundary';
import { StorageAlert } from '@/components/StorageAlert';
import { L } from '@/lib/l10n';

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
  // Messages Bluetooth (transports hors React) dans la langue de l'interface.
  setBleLang(s.lang);
  const rtl = isRTL(s.lang);
  useEffect(() => {
    // Web : dir/lang sur <html> (lecteurs d'écran, sélection, barres de défilement côté droit en arabe).
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    document.documentElement.lang = s.lang;
    document.documentElement.dir = rtl ? 'rtl' : 'ltr';
  }, [s.lang, rtl]);
  const [fontsLoaded] = useFonts({ Amiri_400Regular, Amiri_700Bold, AmiriQuran_400Regular });
  const [fontTimeout, setFontTimeout] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setFontTimeout(true), 2500);
    return () => clearTimeout(id);
  }, []);
  // Lien de connexion refusé (expiré, déjà utilisé) arrivé sur n'importe quelle page : écran de connexion avec « Renvoyer un lien ».
  const auth = useAuth();
  const linkFailed = !!auth.linkError && !auth.session;
  const path = usePathname();
  const onAuth = path === '/auth' || path === '/auth-callback';
  useEffect(() => {
    if (!linkFailed || onAuth) return;
    const id = setTimeout(() => router.push('/auth'), 120);
    return () => clearTimeout(id);
  }, [linkFailed]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const r = takePendingRoute();
    if (r) setTimeout(() => router.push(r as never), 60);
  }, [scheme]);
  if (!fontsLoaded && !fontTimeout) return <View style={{ flex: 1, backgroundColor: t.bg }} />;
  return (
    <View key={scheme} style={{ flex: 1, backgroundColor: t.bg, direction: rtl ? 'rtl' : 'ltr' }}>
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
        <Stack.Screen name="privacy" options={{ title: L("Confidentialité") }} />
        <Stack.Screen name="ring" options={{ title: tr.ring }} />
        <Stack.Screen name="ble-diag" options={{ title: L("Diagnostic Bluetooth") }} />
        <Stack.Screen name="qibla" options={{ title: tr.qibla_title }} />
        <Stack.Screen name="dhikr" options={{ title: tr.dhikr_title }} />
        <Stack.Screen name="settings" options={{ title: tr.settings_title }} />
        <Stack.Screen name="search" options={{ title: tr.search }} />
        <Stack.Screen name="tijani" options={{ title: L("Tijaniyya") }} />
        <Stack.Screen name="sahw" options={{ title: tr.sahw }} />
        <Stack.Screen name="kahf" options={{ title: tr.kahf }} />
        <Stack.Screen name="songs" options={{ title: tr.songs }} />
        <Stack.Screen name="community" options={{ title: tr.community }} />
        <Stack.Screen name="config" options={{ title: tr.config_missing }} />
        <Stack.Screen name="content-admin" options={{ title: tr.content_admin }} />
        <Stack.Screen name="audit" options={{ title: tr.audit }} />
        <Stack.Screen name="validation" options={{ title: L("Validation savante") }} />
        <Stack.Screen name="quran/index" options={{ title: L("Qur’an") }} />
        <Stack.Screen name="quran/[n]" options={{ title: L("Sourate") }} />
        <Stack.Screen name="quran/mushaf" options={{ title: L("Mushaf") }} />
        <Stack.Screen name="quran/hifz" options={{ title: L("Mémorisation") }} />
        <Stack.Screen name="quran/hifz-session" options={{ title: L("Session de mémorisation") }} />
        <Stack.Screen name="quran/bookmarks" options={{ title: L("Marque-pages et notes") }} />
        <Stack.Screen name="quran/khatma" options={{ title: L("Khatma") }} />
        <Stack.Screen name="hadiths" options={{ title: L("Hadiths") }} />
        <Stack.Screen name="duas" options={{ title: L("Du‘as prophétiques") }} />
        <Stack.Screen name="adhkar" options={{ title: L("Adhkar du jour") }} />
        <Stack.Screen name="goals" options={{ title: L("Objectifs du jour") }} />
        <Stack.Screen name="abjad" options={{ title: L("Calculateur abjad") }} />
        <Stack.Screen name="names" options={{ title: L("Les 99 Noms d’Allah") }} />
        <Stack.Screen name="zikrs/index" options={{ title: L("Mes zikrs") }} />
        <Stack.Screen name="zikrs/edit" options={{ title: L("Composer un zikr") }} />
        <Stack.Screen name="zikrs/practice" options={{ title: L("Pratique") }} />
        <Stack.Screen name="fiqh" options={{ title: L("Fiqh") }} />
        <Stack.Screen name="journey" options={{ title: L("Mon parcours spirituel") }} />
        <Stack.Screen name="habits" options={{ title: L("Jardin des habitudes") }} />
        <Stack.Screen name="bilal" options={{ title: L("El Ghaly Bilal") }} />
        <Stack.Screen name="planner" options={{ title: L("Planificateur du jour") }} />
        <Stack.Screen name="auth" options={{ title: L("Connexion") }} />
        <Stack.Screen name="auth-callback" options={{ title: L("Connexion") }} />
        <Stack.Screen name="join" options={{ title: L("Rejoindre") }} />
        <Stack.Screen name="family/[id]" options={{ title: L("Ma famille") }} />
        <Stack.Screen name="circle/[id]" options={{ title: L("Mon cercle") }} />
        <Stack.Screen name="live/[id]" options={{ title: L("Zikr en direct") }} />
      </Stack>
      <StorageAlert />
    </View>
  );
}

export default function Layout() {
  return (
    <AppErrorBoundary>
      <SafeAreaProvider>
        <SettingsProvider>
          <DispenseProvider>
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
          </DispenseProvider>
        </SettingsProvider>
      </SafeAreaProvider>
    </AppErrorBoundary>
  );
}
