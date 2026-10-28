import { Redirect, Tabs } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { Ionicons, type IconName } from '@/ui/kit';
import { useData } from '@/lib/data';
import { usePrayerReminders } from '@/lib/reminders';
import { useSettings } from '@/lib/settings';
import { theme as t } from '@/ui/theme';

export default function TabsLayout() {
  const { s, t: tr, ready } = useSettings();
  const { ready: dataReady } = useData();
  usePrayerReminders();
  if (!ready || !dataReady)
    return (
      <View style={{ flex: 1, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={t.primary} />
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
        tabBarStyle: { backgroundColor: t.surface, borderTopColor: t.border, minHeight: 60 },
        tabBarActiveTintColor: t.primary,
        tabBarInactiveTintColor: t.muted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
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
