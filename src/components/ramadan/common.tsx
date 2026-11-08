import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Text } from '@/ui/Text';
import { softHaptic } from '@/components/bien-etre/common';
import { Badge, Ionicons, type IconName } from '@/ui/kit';
import { Arabic } from '@/ui/light';
import { arLang } from '@/ui/ar-lang';
import { DUAS_LIST } from '@/lib/duas';
import { duaView } from '@/lib/i18n-content';
import { alpha, brand as b } from '@/ui/theme';
import { computeDay } from '@/lib/prayer';
import { useSettings } from '@/lib/settings';
import { useUiLang, L } from '@/lib/l10n';
import { fromKey } from '@/lib/ramadan';

/** Date courte localisée d’une clé AAAA-MM-JJ (« mardi 9 février »). */
export function useFmtDay() {
  const lang = useUiLang();
  const loc = lang === 'ar' ? 'ar' : lang === 'en' ? 'en-GB' : lang === 'de' ? 'de-CH' : 'fr-CH';
  return (k: string, long = true) => fromKey(k).toLocaleDateString(loc, long ? { weekday: 'long', day: 'numeric', month: 'long' } : { day: 'numeric', month: 'short' });
}
export function useHm() {
  const lang = useUiLang();
  const loc = lang === 'ar' ? 'ar' : lang === 'en' ? 'en-GB' : 'fr-CH';
  return (d: Date) => d.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' });
}

/** Horaires du jour et du lendemain (mêmes réglages que l’accueil) et heure courante, rafraîchie chaque seconde. */
export function usePrayerDays(tickMs = 1000) {
  const { s } = useSettings();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), tickMs);
    return () => clearInterval(id);
  }, [tickMs]);
  const day = now.toDateString();
  const rows = useMemo(() => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
    const t = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 12);
    try {
      return { today: computeDay(d, s.place, s.method, s.madhab, s.prayer), tomorrow: computeDay(t, s.place, s.method, s.madhab, s.prayer) };
    } catch {
      return { today: [], tomorrow: [] };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day, s.place, s.method, s.madhab, s.prayer]);
  return { now, ...rows };
}

/** Entrée de menu (cible ≥ 44 pt). */
export function NavItem({ icon, title, sub, href, color }: { icon: IconName; title: string; sub: string; href: Href; color: string }) {
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={L(title) + ', ' + L(sub)}
      onPress={() => {
        softHaptic('light');
        router.push(href);
      }}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 64, padding: 14, borderRadius: 20, backgroundColor: b.paper, borderWidth: 1, borderColor: b.line, opacity: pressed ? 0.85 : 1 })}
    >
      <View style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: alpha(color, 0.14) }}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: b.ink, fontWeight: '900', fontSize: 16 }}>{title}</Text>
        <Text style={{ color: b.inkMuted, fontSize: 13, marginTop: 2 }}>{sub}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={b.inkMuted} />
    </Pressable>
  );
}

/** Grille de jours (30 cases max), chaque case ≥ 44 pt. */
export function DayGrid({ days, render, selected, onSelect, label }: { days: string[]; render: (k: string, i: number) => { mark?: ReactNode; color?: string; a11y: string }; selected?: string; onSelect: (k: string) => void; label: string }) {
  return (
    <View accessibilityLabel={L(label)} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {days.map((k, i) => {
        const r = render(k, i);
        const on = k === selected;
        return (
          <Pressable
            key={k}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={r.a11y}
            onPress={() => {
              softHaptic('select');
              onSelect(k);
            }}
            style={{ width: 48, height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: on ? 2 : 1, borderColor: on ? b.ink : b.line, backgroundColor: r.color ? alpha(r.color, 0.16) : b.paper }}
          >
            <Text maxFontSizeMultiplier={1.2} style={{ color: b.ink, fontWeight: '800', fontSize: 14 }}>
              {String(i + 1)}
            </Text>
            {r.mark ?? <View style={{ height: 14 }} />}
          </Pressable>
        );
      })}
    </View>
  );
}

/** Du‘a du catalogue sourcé (src/lib/duas.ts) : arabe inchangé, translittération, sens, référence. Sinon « Source à compléter ». */
export function SourcedDua({ id }: { id: string }) {
  const lang = useUiLang();
  const d = DUAS_LIST.find((x) => x.id === id);
  if (!d) return <Badge tone="warning" label="Source à compléter" />;
  const v = duaView(d, lang);
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: b.ink, fontWeight: '900' }}>{v.title}</Text>
      <Arabic size={26} style={{ lineHeight: 50 }}>
        <Text {...arLang}>{d.ar}</Text>
      </Arabic>
      {d.tr ? <Text style={{ color: b.inkMuted, fontStyle: 'italic', lineHeight: 20 }}>{d.tr}</Text> : null}
      {v.meaning ? <Text style={{ color: b.ink, lineHeight: 21 }}>{v.meaning}</Text> : null}
      {v.note ? <Text style={{ color: b.inkMuted, fontSize: 12 }}>{v.note}</Text> : null}
      <Text style={{ color: b.inkMuted, fontSize: 12 }}>{L('Source : {r}', { r: d.ref })}</Text>
      {v.translation ? <Badge tone="warning" label={v.translation} /> : null}
    </View>
  );
}
