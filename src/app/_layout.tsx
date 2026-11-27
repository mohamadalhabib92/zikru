import { Amiri_400Regular, Amiri_700Bold } from '@expo-google-fonts/amiri';
import { AmiriQuran_400Regular } from '@expo-google-fonts/amiri-quran';
import { useFonts } from 'expo-font';
import { Redirect, router, Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState, Platform, useColorScheme, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '@/lib/community/auth';
import { CommunityProvider } from '@/lib/community/sync';
import { DataProvider } from '@/lib/data';
import { DispenseProvider } from '@/lib/dispense-context';
import { setBleLang } from '@/lib/ble/messages';
import { isRTL } from '@/lib/i18n';
import { SettingsProvider, useSettings } from '@/lib/settings';
import { Text } from '@/ui/Text';
import { TVPressable } from '@/ui/tv-pressable';
import { applyVisual, brand, glassSolidColor, isGlass, theme as t, type Scheme, type ThemeFinish } from '@/ui/theme';
import { VisualEffectsProvider } from '@/ui/effects';
import { takePendingRoute } from '@/ui/appearance';
import { useFeatureFlags } from '@/lib/use-premium';
import { PremiumProvider, usePremium } from '@/lib/premium';
import { isPremiumActive } from '@/lib/premium-logic';
import { GrowthProvider } from '@/lib/growth';
import { ZikrProvider } from '@/lib/zikrs';
import { AppErrorBoundary, ErrorScreen } from '@/components/AppErrorBoundary';
import { StorageAlert } from '@/components/StorageAlert';
import { MiniPlayer } from '@/components/quran/MiniPlayer';
import { RecitationProvider } from '@/lib/recitation-context';
import { AudioPrefetch } from '@/components/AudioOffline';
import { L, useUiCatalog } from '@/lib/l10n';
import { storeRelease } from '@/lib/release-content';
import { setFontsReady } from '@/ui/fonts-ready';
import { useWatchSync } from '@/lib/use-watch-sync';
import { sanitizeLandscape } from '@/lib/landscapes';
import { tvLaunchHref } from '@/lib/tv-surface';
import { AppLandscape } from '@/components/landscape-backdrop';
import { MacKeys } from '@/components/MacKeys';
import { WebKeys } from '@/components/WebKeys';
import '@/lib/mac-native';

// Écran d'erreur Expo Router pour les erreurs de rendu des routes.
export function ErrorBoundary({ error, retry }: { error: Error; retry: () => Promise<void> }) {
  return <ErrorScreen error={error} retry={() => void retry()} />;
}

/**
 * Tant que la route n’est pas /tv, on ne laisse pas l’écran iPhone visible.
 * Un simple voile sans texte restait après « Sign in with Apple » (StoreKit) :
 * la redirection vers /tv ne se terminait pas tant que la feuille système était ouverte,
 * et l’écran restait une couleur vide. Ici le salon est redemandé, y compris au retour
 * au premier plan, et le voile affiche un titre et Retour.
 */
function TvHomeGate({ active }: { active: boolean }) {
  useEffect(() => {
    if (!active) return;
    const go = () => router.replace('/tv');
    go();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') go();
    });
    return () => sub.remove();
  }, [active]);
  if (!active) return null;
  return (
    <View pointerEvents="auto" style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: '#10211C', paddingHorizontal: 90, paddingTop: 80, justifyContent: 'center' }}>
      <Text style={{ color: '#F4F1EA', fontSize: 56, fontWeight: '800' }}>{L('Zikru')}</Text>
      <Text style={{ color: '#F4F1EA', fontSize: 32, lineHeight: 44, marginTop: 18 }}>{L('Retour')}</Text>
      <TVPressable hasTVPreferredFocus accessibilityRole="button" accessibilityLabel={L('Retour')} onPress={() => router.replace('/tv')} style={{ alignSelf: 'flex-start', marginTop: 28, height: 88, minWidth: 280, borderRadius: 22, backgroundColor: '#1A2420', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 }}>
        <Text style={{ color: '#F4F1EA', fontSize: 34, fontWeight: '800' }}>{L('Retour')}</Text>
      </TVPressable>
    </View>
  );
}

function Root() {
  useWatchSync();
  const { s, t: tr } = useSettings();
  const flags = useFeatureFlags();
  const storePremium = usePremium();
  const sys = useColorScheme();
  const scheme: Scheme = s.appearance === 'light' || s.appearance === 'dark' ? s.appearance : sys === 'dark' ? 'dark' : 'light';
  const requested: ThemeFinish = s.themeFinish === 'verre' || s.themeFinish === 'verre-or' ? s.themeFinish : 'classic';
  const themesOn = flags.themes || isPremiumActive(storePremium.record);
  const finish: ThemeFinish = requested !== 'classic' && !themesOn ? 'classic' : requested;
  // Les jetons sont réécrits AVANT le rendu des enfants ; la clé force un redessin complet.
  applyVisual(scheme, finish);
  // Messages Bluetooth (transports hors React) dans la langue de l'interface.
  setBleLang(s.lang);
  const rtl = isRTL(s.lang);
  const landscape = sanitizeLandscape(s.landscape);
  useEffect(() => {
    // Web : dir/lang sur <html> (lecteurs d'écran, sélection, barres de défilement côté droit en arabe).
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    document.documentElement.lang = s.lang;
    document.documentElement.dir = rtl ? 'rtl' : 'ltr';
  }, [s.lang, rtl]);
  const [fontsLoaded] = useFonts({ Amiri_400Regular, Amiri_700Bold, AmiriQuran_400Regular });
  useEffect(() => {
    setFontsReady(fontsLoaded);
  }, [fontsLoaded]);
  // Lien de connexion refusé (expiré, déjà utilisé) arrivé sur n'importe quelle page : écran de connexion avec « Renvoyer un lien ».
  const auth = useAuth();
  const linkFailed = !!auth.linkError && !auth.session;
  const path = usePathname();
  const onAuth = path === '/auth' || path === '/auth-callback';
  // Le nom de route initial posé sur Stack est ignoré par Expo Router : sans ce remplacement, Apple TV ouvre les onglets iPhone ou l’onboarding.
  const tvHome = tvLaunchHref(path, Platform.isTV);
  useEffect(() => {
    if (Platform.isTV || !linkFailed || onAuth) return;
    const id = setTimeout(() => router.push('/auth'), 120);
    return () => clearTimeout(id);
  }, [linkFailed]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const r = takePendingRoute();
    if (!r || tvLaunchHref(r, Platform.isTV)) return;
    setTimeout(() => router.push(r as never), 60);
  }, [scheme]);
  // Catalogue d'interface de la langue choisie (chargé à la demande, pré-caché hors-ligne ; rien pour le français).
  const catReady = useUiCatalog(s.lang);
  // Amiri se charge en arrière-plan : le texte arabe utilise d’abord la police du système (fonts-ready).
  // On n’attend que le catalogue d’interface, avec le nom de l’app visible tout de suite.
  if (!catReady) {
    return (
      <View accessibilityRole="progressbar" accessibilityLabel={L('Chargement')} style={{ flex: 1, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <Text maxFontSizeMultiplier={1.6} style={{ color: t.text, fontSize: 32, fontWeight: '800' }}>Zikru</Text>
        <Text style={{ color: t.muted }}>{L('Chargement')}</Text>
      </View>
    );
  }
  return (
    <View key={`${scheme}-${finish}`} style={{ flex: 1, backgroundColor: t.bg, direction: rtl ? 'rtl' : 'ltr' }}>
      <AppLandscape id={landscape} />
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} hidden={Platform.isTV} />
      <VisualEffectsProvider>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: isGlass() ? glassSolidColor() : brand.cream },
          headerTintColor: brand.ink,
          headerTitleStyle: { fontWeight: '700', fontSize: 17 },
          headerShadowVisible: false,
          headerBackButtonDisplayMode: 'minimal',
          contentStyle: { backgroundColor: landscape === 'none' ? t.bg : 'transparent' },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="sources" options={{ title: tr.sources_title }} />
        <Stack.Screen name="sound-credits" options={{ title: L('Crédits et licences des sons') }} />
        <Stack.Screen name="privacy" options={{ title: L("Confidentialité") }} />
        <Stack.Screen name="premium" options={{ title: L("Zikru Premium") }} />
        <Stack.Screen name="terms" options={{ title: L("Conditions d’utilisation") }} />
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
        <Stack.Screen name="config" options={{ title: storeRelease() ? L('Réglages') : tr.config_missing }} />
        <Stack.Screen name="content-admin" options={{ title: tr.content_admin }} />
        <Stack.Screen name="audit" options={{ title: tr.audit }} />
        <Stack.Screen name="validation" options={{ title: L("Validation savante") }} />
        <Stack.Screen name="quran/index" options={{ title: L("Qur’an") }} />
        <Stack.Screen name="quran/[n]" options={{ title: L("Sourate") }} />
        <Stack.Screen name="quran/mushaf" options={{ title: L("Mushaf") }} />
        <Stack.Screen name="quran/hifz" options={{ title: L("Mémorisation") }} />
        <Stack.Screen name="quran/hifz-session" options={{ title: L("Session de mémorisation") }} />
        <Stack.Screen name="quran/hifz-recall" options={{ title: L("Rappel actif") }} />
        <Stack.Screen name="quran/hifz-repeat" options={{ title: L("Répéter la récitation") }} />
        <Stack.Screen name="quran/hifz-nktub" options={{ title: L("Nktub") }} />
        <Stack.Screen name="quran/bookmarks" options={{ title: L("Marque-pages et notes") }} />
        <Stack.Screen name="quran/khatma" options={{ title: L("Khatma") }} />
        <Stack.Screen name="quran/downloads" options={{ title: L("Téléchargements audio") }} />
        <Stack.Screen name="hadiths" options={{ title: L("Hadiths") }} />
        <Stack.Screen name="duas" options={{ title: L("Du‘as prophétiques") }} />
        <Stack.Screen name="adhkar" options={{ title: L("Adhkar du jour") }} />
        <Stack.Screen name="goals" options={{ title: L("Objectifs du jour") }} />
        <Stack.Screen name="constance" options={{ title: L("Constance") }} />
        <Stack.Screen name="abjad" options={{ title: L("Istikhraj") }} />
        <Stack.Screen name="names" options={{ title: L("Les 99 Noms d’Allah") }} />
        <Stack.Screen name="zikrs/index" options={{ title: L("Mes zikrs") }} />
        <Stack.Screen name="zikrs/edit" options={{ title: L("Composer un zikr") }} />
        <Stack.Screen name="zikrs/practice" options={{ title: L("Pratique") }} />
        <Stack.Screen name="zikrs/import" options={{ title: L("Importer un programme") }} />
        <Stack.Screen name="fiqh" options={{ title: L("Fiqh") }} />
        <Stack.Screen name="fiqh-aqida" options={{ title: L("Aqida (Ibn ʿĀshir)") }} />
        <Stack.Screen name="fiqh-aqida-read" options={{ title: L("Aqida (Ibn ʿĀshir)") }} />
        <Stack.Screen name="fiqh-akhdari" options={{ title: L("Matn d’al-Akhdarī") }} />
        <Stack.Screen name="fiqh-akhdari-read" options={{ title: L("Matn d’al-Akhdarī") }} />
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
        <Stack.Screen name="program/[id]" options={{ title: L("Programme de groupe") }} />
        <Stack.Screen name="discussion" options={{ title: L("Discussion") }} />
        <Stack.Screen name="lesson/[id]" options={{ title: L("Lecture partagée") }} />
        <Stack.Screen name="tv" options={{ headerShown: false }} />
        <Stack.Screen name="tijani-guide" options={{ title: L("Récitation guidée") }} />
      </Stack>
      <MacKeys />
      <WebKeys />
      {Platform.isTV ? null : <MiniPlayer path={path} />}
      <StorageAlert />
      </VisualEffectsProvider>
      {tvHome ? (
        <>
          <Redirect href={tvHome} />
          <TvHomeGate active />
        </>
      ) : null}
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
                <PremiumProvider>
                <CommunityProvider>
                  <GrowthProvider>
                    <RecitationProvider>
                      <AudioPrefetch />
                      <Root />
                    </RecitationProvider>
                  </GrowthProvider>
                </CommunityProvider>
                </PremiumProvider>
              </AuthProvider>
            </ZikrProvider>
          </DataProvider>
          </DispenseProvider>
        </SettingsProvider>
      </SafeAreaProvider>
    </AppErrorBoundary>
  );
}
