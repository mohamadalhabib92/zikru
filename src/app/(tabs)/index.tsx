import { useRouter, type Href } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { formatHijri } from '@/lib/hijri';
import { isKahfTime } from '@/lib/kahf';
import { usePersistentState } from '@/lib/storage';
import { computeDay, countdown, hhmm, withStates } from '@/lib/prayer';
import { useSettings } from '@/lib/settings';
import { getWeather, wmo, type Weather } from '@/lib/weather';
import { Card, Eyebrow, H1, Ionicons, Muted, Row, Screen, Spacer, type IconName } from '@/ui/kit';
import { theme as t } from '@/ui/theme';

const LOCALE: Record<string, string> = { fr: 'fr-CH', en: 'en-GB', de: 'de-DE', 'de-CH': 'de-CH', ar: 'ar', ff: 'fr-CH', wo: 'fr-CH' };

/** Réflexions originales (rédigées pour Zikru) selon le moment de la journée. */
const REFLECTIONS: { from: number; title: string; text: string; icon: IconName }[] = [
  { from: 0, title: 'Cœur de la nuit', text: 'Le monde dort, la porte reste ouverte. Quelques mots sincères dans le silence valent plus qu’un long discours distrait.', icon: 'moon-outline' },
  { from: 4, title: 'Avant l’aube', text: 'Chaque aube est une page blanche. Commence-la par le souvenir d’Allah, et laisse ce souvenir écrire la suite.', icon: 'star-outline' },
  { from: 7, title: 'Le matin', text: 'Le travail aussi peut devenir dhikr : une intention juste transforme les gestes ordinaires en adoration.', icon: 'sunny-outline' },
  { from: 12, title: 'Midi', text: 'Au milieu des affaires, une pause pour la prière rappelle que le temps ne nous appartient pas : il nous est confié.', icon: 'partly-sunny-outline' },
  { from: 15, title: 'L’après-midi', text: 'Quand l’ombre s’allonge, fais le bilan avant qu’il ne soit fait pour toi. Un istighfar sincère allège le cœur.', icon: 'hourglass-outline' },
  { from: 18, title: 'Le soir', text: 'Le soleil se couche sans bruit. Remercie pour ce qui a été donné, pardonne ce qui t’a blessé, et confie demain à ton Seigneur.', icon: 'cloudy-night-outline' },
  { from: 21, title: 'La nuit', text: 'Avant de dormir, rends ton âme légère : un peu de salawat sur le Prophète ﷺ, et un cœur sans rancune.', icon: 'bed-outline' },
];

type Tile = { label: string; icon: IconName; href: Href; color?: string };

export default function Home() {
  const { s, t: tr } = useSettings();
  const router = useRouter();
  const [now, setNow] = useState(() => new Date());
  const [weather, setWeather] = useState<Weather | null>(null);
  const [wErr, setWErr] = useState(false);
  const [kahfReminder] = usePersistentState('kahf-reminder', true);
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

  const h = now.getHours();
  const refl = [...REFLECTIONS].reverse().find((r) => h >= r.from) ?? REFLECTIONS[0];
  let greg = now.toDateString();
  try {
    greg = now.toLocaleDateString(LOCALE[s.lang] ?? 'fr-CH', { weekday: 'long', day: 'numeric', month: 'long' });
  } catch {}
  const kahfTime = kahfReminder && isKahfTime(now, maghrib);

  const sections: { title: string; tiles: Tile[] }[] = [
    {
      title: tr.sec_growth,
      tiles: [
        { label: tr.tijani, icon: 'leaf-outline', href: '/tijani' },
        { label: tr.wird, icon: 'repeat-outline', href: '/tijani?tab=wird' },
      ],
    },
    {
      title: tr.sec_knowledge,
      tiles: [
        { label: tr.sahw, icon: 'construct-outline', href: '/sahw' },
        { label: tr.adilla, icon: 'document-text-outline', href: '/tijani?tab=adilla' },
        { label: tr.sources_title, icon: 'library-outline', href: '/sources' },
      ],
    },
    {
      title: tr.sec_prayer,
      tiles: [
        { label: tr.prayer_times, icon: 'time-outline', href: '/prayers' },
        { label: tr.tab_qibla, icon: 'compass-outline', href: '/qibla' },
        { label: tr.tab_tasbih, icon: 'ellipse-outline', href: '/tasbih' },
        { label: tr.ring, icon: 'bluetooth-outline', href: '/ring' },
        { label: tr.tab_dhikr, icon: 'book-outline', href: '/dhikr' },
      ],
    },
    {
      title: tr.sec_songs,
      tiles: [
        { label: tr.songs, icon: 'musical-notes-outline', href: '/songs' },
        { label: tr.kahf, icon: 'headset-outline', href: '/kahf' },
      ],
    },
    {
      title: tr.sec_community,
      tiles: [
        { label: tr.community, icon: 'people-outline', href: '/community' },
        { label: 'Hijri', icon: 'calendar-outline', href: '/prayers' },
      ],
    },
  ];

  const wm = weather ? wmo(weather.code, weather.isDay) : null;
  return (
    <Screen>
      <Eyebrow>{greg}</Eyebrow>
      <H1>As-salāmu ‘alaykum</H1>
      <Text style={{ color: t.primary, fontSize: 16, marginTop: 4 }}>{formatHijri(now, s.lang, s.hijriOffset)}</Text>
      <Spacer />

      {/* Prochaine prière */}
      <Card onPress={() => router.push('/prayers')} style={{ backgroundColor: t.surfaceAlt, borderColor: t.primary }} accessibilityLabel={`${tr.next_prayer} ${tr[next.key]} ${hhmm(next.time)}`}>
        <Row style={{ justifyContent: 'space-between' }}>
          <View>
            <Eyebrow style={{ color: t.primary }}>{tr.next_prayer}</Eyebrow>
            <Text style={{ color: t.text, fontSize: 26, fontWeight: '800' }}>
              {tr[next.key]} · {hhmm(next.time)}
            </Text>
            <Muted>
              {tr.in} {countdown(next.time.getTime() - now.getTime())} · {s.place.label}
            </Muted>
          </View>
          <Ionicons name="chevron-forward" size={22} color={t.primary} />
        </Row>
      </Card>
      <Spacer />

      {/* Météo */}
      <Card accessibilityLabel={tr.weather}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Row gap={12}>
            <Ionicons name={(wm?.icon ?? 'cloud-outline') as IconName} size={34} color={t.accent} />
            <View>
              <Text style={{ color: t.text, fontSize: 24, fontWeight: '700' }}>{weather ? `${Math.round(weather.temp)}°C` : wErr ? '—' : '…'}</Text>
              <Muted>{weather ? `${wm?.label} · ${weather.city ?? s.place.label}` : wErr ? 'Météo indisponible hors ligne' : 'Chargement…'}</Muted>
            </View>
          </Row>
          {weather && weather.max != null && weather.min != null ? (
            <View style={{ alignItems: 'flex-end' }}>
              <Muted>
                ↑ {Math.round(weather.max)}° ↓ {Math.round(weather.min)}°
              </Muted>
              <Muted>{Math.round(weather.wind)} km/h</Muted>
            </View>
          ) : null}
        </Row>
        {s.place.source === 'example' ? <Muted style={{ marginTop: 6 }}>Lieu par défaut : {s.place.label}. Activez la localisation dans les réglages.</Muted> : null}
        <Muted style={{ fontSize: 11, marginTop: 4 }}>Open-Meteo</Muted>
      </Card>
      <Spacer />

      {/* Réflexion */}
      <Card>
        <Row gap={10}>
          <Ionicons name={refl.icon} size={20} color={t.primary} />
          <Eyebrow>
            {tr.reflection} · {refl.title}
          </Eyebrow>
        </Row>
        <Text style={{ color: t.text, fontSize: 16, lineHeight: 24, marginTop: 6 }}>{refl.text}</Text>
      </Card>
      {kahfTime ? (
        <>
          <Spacer />
          <Card onPress={() => router.push('/kahf')} style={{ borderColor: t.success }} accessibilityLabel={tr.kahf}>
            <Row gap={10}>
              <Ionicons name="book-outline" size={22} color={t.success} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: t.text, fontWeight: '700' }}>Jumu‘a mubaraka</Text>
                <Muted>Pensez à la sourate al-Kahf et à multiplier les salawat.</Muted>
              </View>
              <Ionicons name="chevron-forward" size={18} color={t.muted} />
            </Row>
          </Card>
        </>
      ) : null}

      {sections.map((sec) => (
        <View key={sec.title} style={{ marginTop: 20 }}>
          <Text style={{ color: t.muted, fontSize: 12, fontWeight: '800', letterSpacing: 1.2, marginBottom: 8 }}>{sec.title}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {sec.tiles.map((x) => (
              <Pressable
                key={x.label}
                accessibilityRole="button"
                accessibilityLabel={x.label}
                onPress={() => router.push(x.href)}
                style={({ pressed }) => ({
                  width: '31%',
                  flexGrow: 1,
                  minHeight: 88,
                  borderRadius: 16,
                  backgroundColor: pressed ? t.surfaceAlt : t.surface,
                  borderWidth: 1,
                  borderColor: t.border,
                  padding: 12,
                  justifyContent: 'space-between',
                })}
              >
                <Ionicons name={x.icon} size={24} color={t.primary} />
                <Text style={{ color: t.text, fontWeight: '600', fontSize: 14, marginTop: 8 }} numberOfLines={2}>
                  {x.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ))}
      <Spacer h={24} />
    </Screen>
  );
}
