import { BleStatusChip } from '@/components/BleStatusChip';
import { PatternBg } from '@/components/zikru/Pattern';
import { useRouter, type Href } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import type { ReactNode } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { askBilal, BilalError } from '@/lib/bilal';
import { useData } from '@/lib/data';
import { dayKey, levelFor, streak, useGrowth } from '@/lib/growth';
import { formatHijri } from '@/lib/hijri';
import { isKahfTime } from '@/lib/kahf';
import { periodFor, PERIODS, REFLECTIONS } from '@/lib/reflections';
import { usePersistentState } from '@/lib/storage';
import { computeDay, countdown, hhmm, withStates } from '@/lib/prayer';
import { useSettings } from '@/lib/settings';
import { getWeather, wmo, type Weather } from '@/lib/weather';
import { Ionicons, type IconName } from '@/ui/kit';
import { LCard, LMuted, SectionLabel } from '@/ui/light';
import { brand as b } from '@/ui/theme';

const LOCALE: Record<string, string> = { fr: 'fr-CH', en: 'en-GB', de: 'de-DE', 'de-CH': 'de-CH', ar: 'ar', ff: 'fr-CH', wo: 'fr-CH' };
type Tile = { label: string; icon: IconName; href: Href; color?: string; sub?: string };
let aiUnavailable = false; // évite d'appeler la fonction à chaque rendu si l'IA n'est pas configurée

export default function Home() {
  const { s, t: tr } = useSettings();
  const { tasbih } = useData();
  const g = useGrowth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [now, setNow] = useState(() => new Date());
  const [weather, setWeather] = useState<Weather | null>(null);
  const [wErr, setWErr] = useState(false);
  const [unit, setUnit] = usePersistentState<'C' | 'F'>('temp-unit', 'C');
  const [kahfReminder] = usePersistentState('kahf-reminder', true);
  const [reflIdx, setReflIdx] = useState(() => new Date().getDate());
  const [aiText, setAiText] = usePersistentState<{ key: string; text: string } | null>('bilal-reflection', null);
  const [aiBusy, setAiBusy] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    let alive = true;
    setWErr(false);
    getWeather(s.place.lat, s.place.lng, s.place.label)
      .then((w) => alive && setWeather(w))
      .catch(() => alive && setWErr(true));
    return () => {
      alive = false;
    };
  }, [s.place.lat, s.place.lng, s.place.label]);

  const { next, maghrib } = useMemo(() => {
    const today = computeDay(now, s.place, s.method, s.madhab);
    const tomorrow = computeDay(new Date(now.getTime() + 86400000), s.place, s.method, s.madhab);
    return { next: withStates(today, now, tomorrow[0].time).next, maghrib: today.find((x) => x.key === 'maghrib')?.time };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Math.floor(now.getTime() / 60000), s.place, s.method, s.madhab]);

  const period = periodFor(now);
  const pool = REFLECTIONS[period];
  const aiKey = `${dayKey(now)}-${period}`;
  const reflection = aiText?.key === aiKey ? aiText.text : pool[reflIdx % pool.length];

  const refresh = async (force = true) => {
    if (aiUnavailable || aiBusy) {
      setReflIdx((i) => i + 1);
      return;
    }
    setAiBusy(true);
    try {
      const text = await askBilal({ mode: 'reflection', period });
      setAiText({ key: aiKey, text });
    } catch (e) {
      if (e instanceof BilalError && (e.code === 'not_configured' || e.code === 'auth')) aiUnavailable = true;
      if (force) setReflIdx((i) => i + 1);
    } finally {
      setAiBusy(false);
    }
  };
  useEffect(() => {
    if (aiText?.key !== aiKey && !aiUnavailable) void refresh(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiKey]);

  let greg = now.toDateString();
  try {
    greg = now.toLocaleDateString(LOCALE[s.lang] ?? 'fr-CH', { weekday: 'long', day: 'numeric', month: 'long' });
  } catch {}
  const kahfTime = kahfReminder && isKahfTime(now, maghrib);
  const todayCount = g.days[dayKey(now)] ?? 0;
  const lvl = levelFor(tasbih.total);
  const st = streak((k) => (g.days[k] ?? 0) > 0);
  const habitsToday = g.habits.filter((h) => h.done.includes(dayKey(now))).length;
  const tasksToday = g.tasks[dayKey(now)] ?? [];

  const temp = (c: number) => Math.round(unit === 'C' ? c : (c * 9) / 5 + 32);
  const wm = weather ? wmo(weather.code, weather.isDay) : null;

  const more: { title: string; tiles: Tile[] }[] = [
    {
      title: 'TARIQA TIJANIYYA',
      tiles: [
        { label: tr.tijani, icon: 'leaf-outline', href: '/tijani', color: b.green },
        { label: tr.wird, icon: 'repeat-outline', href: '/tijani?tab=wird', color: b.wirdGreen },
        { label: tr.adilla, icon: 'document-text-outline', href: '/tijani?tab=adilla', color: b.goldDeep },
      ],
    },
    {
      title: tr.sec_prayer,
      tiles: [
        { label: tr.prayer_times, icon: 'time-outline', href: '/prayers', color: b.brown },
        { label: tr.tab_qibla, icon: 'compass-outline', href: '/qibla', color: b.teal },
        { label: tr.tab_tasbih, icon: 'ellipse-outline', href: '/tasbih', color: b.green },
        { label: tr.ring, icon: 'bluetooth-outline', href: '/ring', color: b.blue },
        { label: tr.tab_dhikr, icon: 'book-outline', href: '/dhikr', color: b.violet },
        { label: tr.sahw, icon: 'construct-outline', href: '/sahw', color: b.rust },
      ],
    },
    {
      title: tr.sec_songs,
      tiles: [
        { label: tr.songs, icon: 'musical-notes-outline', href: '/songs', color: b.purple },
        { label: tr.kahf, icon: 'headset-outline', href: '/kahf', color: b.greenSoft },
      ],
    },
    {
      title: tr.sec_community,
      tiles: [
        { label: tr.community, icon: 'people-outline', href: '/community', color: b.brownSoft },
        { label: tr.sources_title, icon: 'library-outline', href: '/sources', color: b.inkMuted },
      ],
    },
  ];

  const knowledge: Tile[] = [
    { label: 'Mes zikrs', sub: 'Composer · abjad · pratique', icon: 'albums', href: '/zikrs', color: '#7A4F9E' },
    { label: 'Noms d’Allah', sub: 'Les 99 Noms · abjad', icon: 'sparkles', href: '/names', color: '#B07D1A' },
    { label: "Qur'an", sub: '114 sourates', icon: 'book', href: '/quran', color: '#2E8B57' },
    { label: 'Hadiths', sub: 'Collection choisie', icon: 'library', href: '/hadiths', color: '#7C4DDB' },
    { label: "Du'as", sub: 'Prophétiques · 96 invocations', icon: 'hand-left', href: '/duas', color: '#2F7FD0' },
    { label: 'Fiqh', sub: 'Maliki & Shafi‘i', icon: 'scale', href: '/fiqh', color: '#A0522D' },
    { label: 'Abjad', sub: 'Mashriqi & Maghribi', icon: 'calculator', href: '/abjad', color: '#8A5A2B' },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: b.cream }}>
      <ScrollContainer>
        {/* En-tête brun à motif */}
        <PatternBg color={b.brown} style={{ paddingTop: insets.top + 14, paddingHorizontal: 20, paddingBottom: 34 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="moon" size={20} color={b.gold} />
              </View>
              <View>
                <Text style={{ color: '#FFF7EA', fontSize: 26, fontWeight: '900' }}>Zikru</Text>
                <Text style={{ color: '#E9D9C3', fontSize: 13 }}>
                  {todayCount.toLocaleString('fr-CH')} dhikr aujourd’hui · {tasbih.total.toLocaleString('fr-CH')} au total
                </Text>
              </View>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={tr.tab_settings} onPress={() => router.push('/settings')} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="settings-outline" size={22} color="#FFF7EA" />
            </Pressable>
          </View>
          <Text style={{ color: '#F3E6D2', marginTop: 12, fontSize: 13 }}>
            {greg} · <Text style={{ color: b.gold }}>{formatHijri(now, s.lang, s.hijriOffset)}</Text>
          </Text>
          <View style={{ marginTop: 8, alignSelf: 'flex-start' }}>
            <BleStatusChip />
          </View>
        </PatternBg>

        <View style={{ marginTop: -20, borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: b.cream, padding: 16, paddingTop: 18 }}>
          {/* Prochaine prière */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${tr.next_prayer} ${tr[next.key]} ${hhmm(next.time)}`}
            onPress={() => router.push('/prayers')}
            style={({ pressed }) => ({ backgroundColor: b.gold, borderRadius: 18, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14, opacity: pressed ? 0.9 : 1, marginBottom: 12 })}
          >
            <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(74,46,25,0.12)', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="time" size={24} color={b.brownDark} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: b.brownDark, fontSize: 12, fontWeight: '800', letterSpacing: 1 }}>{tr.next_prayer.toUpperCase()}</Text>
              <Text style={{ color: b.ink, fontSize: 24, fontWeight: '900' }}>
                {tr[next.key]} {hhmm(next.time)}
              </Text>
              <Text style={{ color: b.brownDark }}>
                {tr.in} {countdown(next.time.getTime() - now.getTime())} · {s.place.label}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color={b.brownDark} />
          </Pressable>

          {/* Météo */}
          <LCard label={tr.weather}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: '#EAF3FB', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={(wm?.icon?.replace('-outline', '') ?? 'cloud') as IconName} size={30} color={weather?.isDay === false ? '#5B6BB5' : '#E8A317'} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: b.ink, fontSize: 28, fontWeight: '800' }}>{weather ? `${temp(weather.temp)}°${unit}` : wErr ? '—' : '…'}</Text>
                <LMuted>
                  {weather
                    ? `${wm?.label} · ${weather.city ?? s.place.label}${weather.feels != null ? ` · ressenti ${temp(weather.feels)}°` : ''}`
                    : wErr
                      ? 'Météo indisponible hors ligne'
                      : 'Chargement…'}
                </LMuted>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 6 }}>
                <View style={{ flexDirection: 'row', borderRadius: 10, borderWidth: 1, borderColor: b.line, overflow: 'hidden' }}>
                  {(['C', 'F'] as const).map((u) => (
                    <Pressable key={u} accessibilityRole="button" accessibilityLabel={`°${u}`} onPress={() => setUnit(u)} style={{ paddingHorizontal: 10, paddingVertical: 5, backgroundColor: unit === u ? b.brown : b.paper }}>
                      <Text style={{ color: unit === u ? '#fff' : b.ink, fontWeight: '700', fontSize: 12 }}>°{u}</Text>
                    </Pressable>
                  ))}
                </View>
                {weather && weather.max != null && weather.min != null ? (
                  <Text style={{ color: b.inkMuted, fontSize: 13 }}>
                    <Text style={{ color: '#D9534F' }}>↑{temp(weather.max)}°</Text> <Text style={{ color: '#2F7FD0' }}>↓{temp(weather.min)}°</Text>
                  </Text>
                ) : null}
              </View>
            </View>
            {s.place.source === 'example' ? <LMuted style={{ marginTop: 6 }}>Lieu par défaut : {s.place.label}. Activez la localisation dans les réglages.</LMuted> : null}
          </LCard>

          {/* Réflexion — Bilal */}
          <View style={{ backgroundColor: b.purple, borderRadius: 18, padding: 16, marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800' }}>{PERIODS[period].title}</Text>
                <Text style={{ color: '#C9C3F5', fontSize: 12, marginTop: 2 }}>Un mot de Bilal · El Ghaly Bilal</Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Nouvelle réflexion" onPress={() => void refresh(true)} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                {aiBusy ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="refresh" size={20} color="#fff" />}
              </Pressable>
            </View>
            <Text style={{ color: '#F1EEFF', fontSize: 15, lineHeight: 23, marginTop: 10 }}>{reflection}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/bilal')}
              style={{ marginTop: 12, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 14, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="chatbubbles" size={18} color={b.gold} />
                <Text style={{ color: '#fff', fontWeight: '700' }}>Parler avec Bilal</Text>
              </View>
              <Text style={{ color: b.gold, fontWeight: '800' }}>Discuter →</Text>
            </Pressable>
          </View>

          {kahfTime ? (
            <LCard onPress={() => router.push('/kahf')} label={tr.kahf} style={{ borderColor: b.teal }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Ionicons name="book" size={22} color={b.teal} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: b.ink, fontWeight: '800' }}>Jumu‘a mubaraka</Text>
                  <LMuted>Pensez à la sourate al-Kahf et à multiplier les salawat.</LMuted>
                </View>
                <Ionicons name="chevron-forward" size={18} color={b.inkMuted} />
              </View>
            </LCard>
          ) : null}

          {/* Plateforme de progression */}
          <SectionLabel color={b.green}>{tr.sec_growth}</SectionLabel>
          <GrowthRow icon="trending-up" title="Mon parcours spirituel" sub={`${lvl.name} (${lvl.fr}) · ${tasbih.total.toLocaleString('fr-CH')} dhikr · série ${st} j`} badge={`NIV ${lvl.index}`} onPress={() => router.push('/journey')} />
          <GrowthRow icon="flower" title="Jardin des habitudes" sub={g.habits.length ? `${habitsToday}/${g.habits.length} aujourd’hui · séries & petites habitudes` : 'Habitudes islamiques · séries · méthode des petites habitudes'} onPress={() => router.push('/habits')} />
          <GrowthRow icon="sparkles" title="El Ghaly Bilal" sub="Coach comportemental islamique" badge="NOUVEAU" badgeColor={b.gold} onPress={() => router.push('/bilal')} />
          <GrowthRow icon="calendar" title="Planificateur du jour" sub={tasksToday.length ? `${tasksToday.filter((x) => x.done).length}/${tasksToday.length} tâches · entre les prières` : 'Productivité ancrée sur les prières · organiser sa vie entre les salat'} color={b.purpleDeep} onPress={() => router.push('/planner')} />

          {/* Savoir : 4 tuiles colorées */}
          <SectionLabel color={b.goldDeep}>{tr.sec_knowledge}</SectionLabel>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {knowledge.map((x) => (
              <Pressable
                key={x.label}
                accessibilityRole="button"
                accessibilityLabel={x.label}
                onPress={() => router.push(x.href)}
                style={({ pressed }) => ({ width: '47%', flexGrow: 1, minHeight: 112, borderRadius: 18, backgroundColor: x.color, padding: 14, justifyContent: 'space-between', opacity: pressed ? 0.88 : 1 })}
              >
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={x.icon} size={22} color="#fff" />
                </View>
                <View>
                  <Text style={{ color: '#fff', fontWeight: '800', fontSize: 17 }}>{x.label}</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12 }}>{x.sub}</Text>
                </View>
              </Pressable>
            ))}
          </View>

          {more.map((sec) => (
            <View key={sec.title}>
              <SectionLabel>{sec.title}</SectionLabel>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {sec.tiles.map((x) => (
                  <Pressable
                    key={x.label}
                    accessibilityRole="button"
                    accessibilityLabel={x.label}
                    onPress={() => router.push(x.href)}
                    style={({ pressed }) => ({ width: '31%', flexGrow: 1, minHeight: 88, borderRadius: 16, backgroundColor: b.paper, borderWidth: 1, borderColor: b.line, padding: 12, justifyContent: 'space-between', opacity: pressed ? 0.85 : 1 })}
                  >
                    <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: (x.color ?? b.green) + '1F', alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name={x.icon} size={20} color={x.color ?? b.green} />
                    </View>
                    <Text style={{ color: b.ink, fontWeight: '700', fontSize: 14, marginTop: 8 }} numberOfLines={2}>
                      {x.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ))}
          <View style={{ height: 24 + insets.bottom }} />
        </View>
      </ScrollContainer>
    </View>
  );
}

function ScrollContainer({ children }: { children: ReactNode }) {
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ maxWidth: 720, width: '100%', alignSelf: 'center' }}>
      {children}
    </ScrollView>
  );
}

function GrowthRow({ icon, title, sub, badge, badgeColor, color = b.green, onPress }: { icon: IconName; title: string; sub: string; badge?: string; badgeColor?: string; color?: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => ({ backgroundColor: color, borderRadius: 18, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10, opacity: pressed ? 0.9 : 1 })}
    >
      <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={22} color={b.gold} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800', flexShrink: 1 }}>{title}</Text>
          {badge ? (
            <View style={{ backgroundColor: badgeColor ?? 'rgba(255,255,255,0.18)', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 }}>
              <Text style={{ color: badgeColor ? b.ink : '#fff', fontSize: 10, fontWeight: '900' }}>{badge}</Text>
            </View>
          ) : null}
        </View>
        <Text style={{ color: 'rgba(255,255,255,0.78)', fontSize: 12, marginTop: 2 }}>{sub}</Text>
      </View>
      <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="arrow-forward" size={16} color="#fff" />
      </View>
    </Pressable>
  );
}
