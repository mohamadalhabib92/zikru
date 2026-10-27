import { Redirect, Tabs } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { Ionicons, type IconName } from '@/ui/kit';
import { useData } from '@/lib/data';
import { useSettings } from '@/lib/settings';
import { theme as t } from '@/ui/theme';

export default function TabsLayout() {
  const { s, t: tr, ready } = useSettings();
  const { ready: dataReady } = useData();
  if (!ready || !dataReady)
    return (
      <View style={{ flex: 1, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={t.primary} />
      </View>
    );
  if (!s.onboarded) return <Redirect href="/onboarding" />;
  const icon = (name: IconName) =>
    function TabIcon({ color, size }: { color: unknown; size: number }) {
      return <Ionicons name={name} color={typeof color === "string" ? color : undefined} size={size} />;
    };
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: t.bg },
        headerTintColor: t.text,
        headerShadowVisible: false,
        tabBarStyle: { backgroundColor: t.surface, borderTopColor: t.border, minHeight: 60 },
        tabBarActiveTintColor: t.primary,
        tabBarInactiveTintColor: t.muted,
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        sceneStyle: { backgroundColor: t.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: tr.tab_prayers, tabBarIcon: icon('time-outline') }} />
      <Tabs.Screen name="qibla" options={{ title: tr.tab_qibla, tabBarIcon: icon('compass-outline') }} />
      <Tabs.Screen name="tasbih" options={{ title: tr.tab_tasbih, tabBarIcon: icon('ellipse-outline') }} />
      <Tabs.Screen name="dhikr" options={{ title: tr.tab_dhikr, tabBarIcon: icon('book-outline') }} />
      <Tabs.Screen name="settings" options={{ title: tr.tab_settings, tabBarIcon: icon('options-outline') }} />
    </Tabs>
  );
}
