import { useRouter, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Text } from '@/ui/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSettings } from '@/lib/settings';
import { Container, FadeIn, IconBadge, SectionHeader, tapHaptic, useLayout } from '@/ui/ds';
import { Ionicons, type IconName } from '@/ui/kit';
import { brand as b } from '@/ui/theme';
import { L } from '@/lib/l10n';

export type HubItem = { icon: IconName; title: string; sub?: string; href: Href; color: string };
export type HubSection = { title: string; items: HubItem[] };

/** Écran « hub » : titre, barre de recherche, sections de liens (2 colonnes sur iPad). */
export function Hub({ title, eyebrow, sections, top }: { title: string; eyebrow?: string; sections: HubSection[]; top?: ReactNode }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { tablet, desktop } = useLayout({ inTabs: true });
  const { t: tr } = useSettings();
  const cols = desktop ? 3 : tablet ? 2 : 1;
  return (
    <View style={{ flex: 1, backgroundColor: b.cream }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 40 + insets.bottom }}>
        <Container max={1100} style={{ paddingHorizontal: tablet ? 28 : 16 }}>
          {eyebrow ? <Text style={{ color: b.goldDeep, fontWeight: '800', fontSize: 12, letterSpacing: 1.4 }}>{L(eyebrow).toUpperCase()}</Text> : null}
          <Text accessibilityRole="header" style={{ color: b.ink, fontSize: 32, fontWeight: '800', letterSpacing: -0.6, marginBottom: 12 }}>
            {title}
          </Text>
          <Pressable
            accessibilityRole="search"
            accessibilityLabel={tr.search}
            onPress={() => router.push('/search')}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, paddingHorizontal: 14, borderRadius: 14, backgroundColor: b.paper, borderWidth: 1, borderColor: b.line, opacity: pressed ? 0.8 : 1 })}
          >
            <Ionicons name="search" size={18} color={b.inkMuted} />
            <Text style={{ color: b.inkMuted, fontSize: 15 }}>{tr.search_ph}</Text>
          </Pressable>
          {top}
          {sections.map((sec, si) => (
            <FadeIn key={sec.title} delay={si * 40}>
              <SectionHeader title={sec.title} />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5 }}>
                {sec.items.map((it) => (
                  <View key={it.title} style={{ width: `${100 / cols}%`, padding: 5 }}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={it.sub ? `${L(it.title)}. ${L(it.sub)}` : L(it.title)}
                      onPress={() => {
                        tapHaptic('select');
                        router.push(it.href);
                      }}
                      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, padding: 12, borderRadius: 16, backgroundColor: b.paper, borderWidth: 1, borderColor: b.line, transform: [{ scale: pressed ? 0.985 : 1 }] })}
                    >
                      <IconBadge icon={it.icon} color={it.color} size={40} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: b.ink, fontWeight: '700', fontSize: 15 }} numberOfLines={1}>
                          {it.title}
                        </Text>
                        {it.sub ? (
                          <Text style={{ color: b.inkMuted, fontSize: 13 }} numberOfLines={1}>
                            {it.sub}
                          </Text>
                        ) : null}
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={b.inkMuted} />
                    </Pressable>
                  </View>
                ))}
              </View>
            </FadeIn>
          ))}
        </Container>
      </ScrollView>
    </View>
  );
}
