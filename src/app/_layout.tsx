import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '@/lib/community/auth';
import { CommunityProvider } from '@/lib/community/sync';
import { DataProvider } from '@/lib/data';
import { isRTL } from '@/lib/i18n';
import { SettingsProvider, useSettings } from '@/lib/settings';
import { theme as t } from '@/ui/theme';
import { AppErrorBoundary, ErrorScreen } from '@/components/AppErrorBoundary';

// Écran d'erreur Expo Router pour les erreurs de rendu des routes.
export function ErrorBoundary({ error, retry }: { error: Error; retry: () => Promise<void> }) {
  return <ErrorScreen error={error} retry={() => void retry()} />;
}

function Root() {
  const { s, t: tr } = useSettings();
  return (
    <View style={{ flex: 1, backgroundColor: t.bg, direction: isRTL(s.lang) ? 'rtl' : 'ltr' }}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: t.bg },
          headerTintColor: t.text,
          headerTitleStyle: { fontWeight: '700' },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: t.bg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="sources" options={{ title: tr.sources_title }} />
        <Stack.Screen name="ring" options={{ title: tr.ring }} />
        <Stack.Screen name="prayers" options={{ title: tr.prayer_times }} />
        <Stack.Screen name="tijani" options={{ title: tr.tijani }} />
        <Stack.Screen name="sahw" options={{ title: tr.sahw }} />
        <Stack.Screen name="kahf" options={{ title: tr.kahf }} />
        <Stack.Screen name="songs" options={{ title: tr.songs }} />
        <Stack.Screen name="community" options={{ title: tr.community }} />
        <Stack.Screen name="config" options={{ title: tr.config_missing }} />
        <Stack.Screen name="content-admin" options={{ title: tr.content_admin }} />
        <Stack.Screen name="audit" options={{ title: tr.audit }} />
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
            <AuthProvider>
              <CommunityProvider>
                <Root />
              </CommunityProvider>
            </AuthProvider>
          </DataProvider>
        </SettingsProvider>
      </SafeAreaProvider>
    </AppErrorBoundary>
  );
}
