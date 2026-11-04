import { Redirect, Tabs } from 'expo-router';
import { useWindowDimensions, View } from 'react-native';
import { hasSidebar, SIDEBAR_WIDTH } from '@/ui/ds';
import { Ionicons, type IconName } from '@/ui/kit';
import { useData } from '@/lib/data';
import { useFocus } from '@/lib/focus';
import { usePrayerReminders } from '@/lib/reminders';
import { useSettings } from '@/lib/settings';
import { theme as t } from '@/ui/theme';
import { Breathing } from '@/ui/motion';

export default function TabsLayout() {
  const { s, t: tr, ready } = useSettings();
  const { ready: dataReady } = useData();
  usePrayerReminders();
  // Mode Focus : onglets / barre latérale masqués pendant la séance (aucun « switch » en un geste).
  const focusOn = useFocus().active != null;
  const { width, fontScale } = useWindowDimensions();
  // Libellés d'onglets : suivent la taille de texte du système jusqu'à ×1,4, au-delà la barre déborderait.
  const tabFs = (n: number) => Math.round(n * Math.min(fontScale, 1.4));
  // iPad paysage / grand iPad / ordinateur : barre latérale ; iPhone, iPad portrait et Split View étroit : onglets en bas.
  const sidebar = hasSidebar(width);
  if (!ready || !dataReady)
    return (
      <View style={{ flex: 1, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center' }}>
        <Breathing color={t.primary}>
          <Ionicons name="moon-outline" size={28} color={t.primary} />
        </Breathing>
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
        tabBarStyle: focusOn
          ? { display: 'none' }
          : sidebar
          ? { backgroundColor: t.surface, borderColor: t.border, minWidth: SIDEBAR_WIDTH, width: SIDEBAR_WIDTH, paddingTop: 24 }
          : { backgroundColor: t.surface, borderTopColor: t.border, minHeight: 60 },
        tabBarActiveTintColor: sidebar ? t.onPrimary : t.primary,
        tabBarActiveBackgroundColor: sidebar ? t.primary : undefined,
        tabBarInactiveTintColor: t.muted,
        tabBarAllowFontScaling: false,
        tabBarLabelStyle: sidebar ? { fontSize: tabFs(15), fontWeight: '600' } : { fontSize: tabFs(11), fontWeight: '700' },
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
