import { Redirect, Tabs } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, useWindowDimensions, View } from 'react-native';
import { hasSidebar, SIDEBAR_WIDTH } from '@/ui/ds';
import { Button, Ionicons, Muted, type IconName } from '@/ui/kit';
import { useData } from '@/lib/data';
import { usePrayerReminders } from '@/lib/reminders';
import { useSettings } from '@/lib/settings';
import { theme as t } from '@/ui/theme';
import { Text } from '@/ui/Text';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/RouteErrorBoundary';

export default function TabsLayout() {
  const { s, t: tr, ready } = useSettings();
  const { ready: dataReady } = useData();
  usePrayerReminders();
  const { width } = useWindowDimensions();
  const [bootAttempt, setBootAttempt] = useState(0);
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (ready && dataReady) return;
    const id = setTimeout(() => setSlow(true), 8000);
    return () => clearTimeout(id);
  }, [ready, dataReady, bootAttempt]);
  // iPad paysage / grand iPad / ordinateur : barre latérale ; iPhone, iPad portrait et Split View étroit : onglets en bas.
  const sidebar = hasSidebar(width);
  if (!ready || !dataReady)
    return (
      <View style={{ flex: 1, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 }}>
        {slow ? (
          <>
            <Text style={{ color: t.text, fontSize: 18, fontWeight: '700', textAlign: 'center' }}>Le chargement prend trop de temps</Text>
            <Muted style={{ textAlign: 'center' }}>Vos données restent sur l’appareil. Réessayez, ou fermez puis rouvrez Zikru.</Muted>
            <Button title="Réessayer" onPress={() => { setSlow(false); setBootAttempt((n) => n + 1); }} />
          </>
        ) : (
          <ActivityIndicator color={t.primary} />
        )}
      </View>
    );
  if (!s.onboarded) return <Redirect href="/onboarding" />;
  const icon = (name: IconName, active: IconName) =>
    function TabIcon({ color, size, focused }: { color: unknown; size: number; focused: boolean }) {
      return <Ionicons name={focused ? active : name} color={typeof color === 'string' ? color : undefined} size={size - 1} />;
    };
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: t.bg },
        headerTintColor: t.text,
        headerTitleStyle: { fontWeight: '700', fontSize: 17 },
        headerShadowVisible: false,
        tabBarPosition: sidebar ? 'left' : 'bottom',
        tabBarLabelPosition: sidebar ? 'beside-icon' : undefined,
        tabBarStyle: sidebar
          ? { backgroundColor: t.surface, borderColor: t.border, minWidth: SIDEBAR_WIDTH, width: SIDEBAR_WIDTH, paddingTop: 24 }
          : { backgroundColor: t.surface, borderTopColor: t.border, minHeight: 60 },
        tabBarActiveTintColor: sidebar ? t.onPrimary : t.primary,
        tabBarActiveBackgroundColor: sidebar ? t.primary : undefined,
        tabBarInactiveTintColor: t.muted,
        // Les libellés d'onglets ne grossissent pas au-delà de la barre (iOS affiche la grande vignette d'accessibilité à l'appui long).
        tabBarAllowFontScaling: false,
        tabBarLabelStyle: sidebar ? { fontSize: 15, fontWeight: '600' } : { fontSize: 11, fontWeight: '700' },
        sceneStyle: { backgroundColor: t.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ headerShown: false, title: tr.tab_home, tabBarIcon: icon('home-outline', 'home') }} />
      <Tabs.Screen name="prayers" options={{ title: tr.prayer_times, tabBarLabel: tr.tab_prayers, tabBarIcon: icon('time-outline', 'time') }} />
      <Tabs.Screen name="tasbih" options={{ title: tr.tab_tasbih, tabBarIcon: icon('ellipse-outline', 'radio-button-on') }} />
      <Tabs.Screen name="read" options={{ headerShown: false, title: tr.tab_read, tabBarIcon: icon('book-outline', 'book') }} />
      <Tabs.Screen name="more" options={{ headerShown: false, title: tr.tab_more, tabBarIcon: icon('grid-outline', 'grid') }} />
    </Tabs>
  );
}
