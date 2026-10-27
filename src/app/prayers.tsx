import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { AudioPlayer } from '@/components/AudioPlayer';
import { PatternBg } from '@/components/zikru/Pattern';
import { SkyArc } from '@/components/zikru/SkyArc';
import { dayKey as dk, useGrowth } from '@/lib/growth';
import { formatHijri } from '@/lib/hijri';
import { AR_NAMES, computeDay, countdown, hhmm, METHODS, withStates, type PrayerKey, type PrayerState } from '@/lib/prayer';
import { useSettings } from '@/lib/settings';
import { Button, Ionicons, Screen, Spacer } from '@/ui/kit';
import { LCard, LMuted, LTitle } from '@/ui/light';
import { brand as b } from '@/ui/theme';

const LOCALE: Record<string, string> = { fr: 'fr-CH', en: 'en-GB', de: 'de-DE', 'de-CH': 'de-CH', ar: 'ar', ff: 'fr-CH', wo: 'fr-CH' };
const ICONS: Record<PrayerKey, string> = { fajr: 'partly-sunny', sunrise: 'sunny', dhuhr: 'sunny', asr: 'partly-sunny', maghrib: 'cloudy-night', isha: 'moon' };

export default function Prayers() {
  const { s, t: tr } = useSettings();
  const g = useGrowth();
  const router = useRouter();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  const day = now.toDateString();
  const { rows, next, list } = useMemo(() => {
    const today = computeDay(now, s.place, s.method, s.madhab);
    const tomorrow = computeDay(new Date(now.getTime() + 86400000), s.place, s.method, s.madhab);
    return { ...withStates(today, now, tomorrow[0].time), list: today };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day, Math.floor(now.getTime() / 60000), s.place, s.method, s.madhab]);

  let greg = now.toDateString();
  try {
    greg = now.toLocaleDateString(LOCALE[s.lang] ?? 'fr-CH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  } catch {}
  const prayedToday = g.prayed[dk(now)] ?? [];
  const names = Object.fromEntries(list.map((p) => [p.key, tr[p.key]])) as Record<PrayerKey, string>;
  const stateLabel: Record<PrayerState, string> = { past: tr.past, current: tr.current, next: tr.next_prayer, upcoming: tr.upcoming };
  const fard = rows.filter((r) => r.key !== 'sunrise');
  const doneCount = fard.filter((r) => prayedToday.includes(r.key)).length;

  return (
    <Screen padded={false} bg={b.cream}>
      <PatternBg color={b.brown} style={{ padding: 20, paddingBottom: 26 }}>
        <Text style={{ color: '#E9D9C3', fontSize: 12, fontWeight: '800', letterSpacing: 1.2 }}>{tr.next_prayer.toUpperCase()}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <View>
            <Text style={{ color: '#FFF7EA', fontSize: 34, fontWeight: '900' }}>{tr[next.key]}</Text>
            <Text style={{ color: b.gold, fontSize: 22 }}>{AR_NAMES[next.key]}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ color: '#FFF7EA', fontSize: 34, fontWeight: '300', fontVariant: ['tabular-nums'] }}>{hhmm(next.time)}</Text>
            <Text style={{ color: '#F3E6D2' }}>
              {tr.in} {countdown(next.time.getTime() - now.getTime())}
            </Text>
          </View>
        </View>
        <Text style={{ color: '#E9D9C3', marginTop: 10, fontSize: 13 }}>
          {greg} · <Text style={{ color: b.gold }}>{formatHijri(now, s.lang, s.hijriOffset)}</Text> · {s.place.label}
          {s.place.source === 'example' ? ' (exemple)' : ''}
        </Text>
      </PatternBg>

      <View style={{ padding: 16 }}>
        <SkyArc list={list} now={now} names={names} />
        <Spacer />
        {/* Grille de 6 horaires */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {rows.map((p) => {
            const hi = p.state === 'current' || p.state === 'next';
            return (
              <View key={p.key} style={{ width: '31%', flexGrow: 1, borderRadius: 14, padding: 10, alignItems: 'center', backgroundColor: hi ? b.gold : b.paper, borderWidth: 1, borderColor: hi ? b.goldDeep : b.line }}>
                <Ionicons name={ICONS[p.key] as 'sunny'} size={18} color={hi ? b.brownDark : b.brownSoft} />
                <Text style={{ color: b.ink, fontWeight: '800', marginTop: 4 }}>{tr[p.key]}</Text>
                <Text style={{ color: b.ink, fontVariant: ['tabular-nums'] }}>{hhmm(p.time)}</Text>
              </View>
            );
          })}
        </View>
        <Spacer h={16} />
        <LCard>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <LTitle>Horaires du jour</LTitle>
            <Text style={{ color: b.green, fontWeight: '800' }}>{doneCount}/5 priées</Text>
          </View>
          {rows.map((p, i) => {
            const isSun = p.key === 'sunrise';
            const done = prayedToday.includes(p.key);
            const hi = p.state === 'current' || p.state === 'next';
            return (
              <View
                key={p.key}
                accessible={isSun}
                accessibilityLabel={`${tr[p.key]}, ${hhmm(p.time)}, ${stateLabel[p.state]}`}
                style={{ flexDirection: 'row', alignItems: 'center', minHeight: 54, paddingHorizontal: 10, borderRadius: 12, marginTop: i ? 4 : 0, backgroundColor: isSun ? '#FFF4D6' : hi ? '#EEF6F0' : 'transparent' }}
              >
                {isSun ? (
                  <View style={{ width: 44, alignItems: 'center' }}>
                    <Ionicons name="sunny" size={22} color="#E8A317" />
                  </View>
                ) : (
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: done }}
                    accessibilityLabel={`${tr[p.key]} ${hhmm(p.time)} — ${done ? 'priée' : 'marquer comme priée'}`}
                    onPress={() => g.togglePrayed(p.key)}
                    style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Ionicons name={done ? 'checkmark-circle' : 'ellipse-outline'} size={26} color={done ? b.wirdGreen : b.inkMuted} />
                  </Pressable>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={{ color: b.ink, fontSize: 16, fontWeight: hi ? '800' : '600' }}>{tr[p.key]}</Text>
                  {p.state === 'current' ? <Text style={{ color: b.wirdGreen, fontSize: 12, fontWeight: '700' }}>{tr.current}</Text> : p.state === 'next' ? <Text style={{ color: b.goldDeep, fontSize: 12, fontWeight: '700' }}>{tr.next_prayer}</Text> : null}
                </View>
                <Text style={{ color: b.brownSoft, fontSize: 18, marginRight: 12 }}>{AR_NAMES[p.key]}</Text>
                <Text style={{ color: b.ink, fontSize: 17, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{hhmm(p.time)}</Text>
              </View>
            );
          })}
          <LMuted style={{ marginTop: 8 }}>Touchez le cercle pour cocher une prière accomplie (enregistré sur cet appareil).</LMuted>
        </LCard>
        <LMuted>
          {METHODS[s.method]} · {s.madhab === 'hanafi' ? tr.hanafi : tr.shafi} · {tr.offline_ready}
        </LMuted>
        <Spacer h={16} />
        <AudioPlayer />
        <Spacer />
        <Button title={tr.sources_title} variant="secondary" icon="library-outline" onPress={() => router.push('/sources')} />
      </View>
    </Screen>
  );
}
