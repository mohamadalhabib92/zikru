import { Amiri_400Regular } from '@expo-google-fonts/amiri';
import { useFonts } from 'expo-font';
import { router, Slot, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { TvSettingsProvider, useTv } from '@/lib/settings';
import { Focusable, ink } from '@/ui/focus';

const NAV = [
  { href: '/', key: 'prayers' as const },
  { href: '/quran', key: 'quran' as const },
  { href: '/adhan', key: 'adhan' as const },
  { href: '/dhikr', key: 'dhikr' as const },
];

function Rail() {
  const { t, s, set } = useTv();
  const path = usePathname();
  return (
    <View style={styles.rail}>
      <Text style={styles.mark}>Zikru</Text>
      {NAV.map((item, i) => {
        const on = item.href === '/' ? path === '/' : path.startsWith(item.href);
        return (
          <Focusable key={item.href} preferred={i === 0} onPress={() => router.push(item.href as never)} style={[styles.nav, on && styles.navOn]}>
            <Text style={[styles.navText, on && styles.navTextOn]}>{t[item.key]}</Text>
          </Focusable>
        );
      })}
      <View style={{ flex: 1 }} />
      <Focusable
        onPress={() => set({ lang: s.lang === 'fr' ? 'en' : 'fr' })}
        style={styles.lang}
      >
        <Text style={styles.langText}>{s.lang === 'fr' ? 'Français' : 'English ✎'}</Text>
      </Focusable>
      {s.lang === 'en' ? <Text style={styles.review}>{t.langReview}</Text> : null}
    </View>
  );
}

function Shell() {
  useFonts({ Amiri_400Regular });
  return (
    <View style={styles.root}>
      <StatusBar hidden />
      <Rail />
      <View style={styles.body}>
        <Slot />
      </View>
    </View>
  );
}

export default function Layout() {
  return (
    <TvSettingsProvider>
      <Shell />
    </TvSettingsProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row', backgroundColor: ink.bg },
  rail: { width: 280, padding: 28, paddingTop: 48, backgroundColor: ink.green, borderRightWidth: 1, borderRightColor: ink.line },
  mark: { color: ink.gold, fontSize: 32, fontWeight: '800', marginBottom: 28 },
  nav: { paddingVertical: 14, paddingHorizontal: 16, marginBottom: 8 },
  navOn: { backgroundColor: '#17382C' },
  navText: { color: ink.muted, fontSize: 24, fontWeight: '600' },
  navTextOn: { color: ink.text },
  lang: { paddingVertical: 12, paddingHorizontal: 8 },
  langText: { color: ink.gold, fontSize: 18 },
  review: { color: ink.muted, fontSize: 14, marginTop: 8 },
  body: { flex: 1 },
});
