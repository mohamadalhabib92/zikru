import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { AudioPlayer } from '@/components/AudioPlayer';
import { formatHijri } from '@/lib/hijri';
import { computeDay, countdown, hhmm, METHODS, withStates, type PrayerState } from '@/lib/prayer';
import { useSettings } from '@/lib/settings';
import { Badge, Button, Card, Eyebrow, H1, Ionicons, Muted, Notice, Row, Screen, Spacer } from '@/ui/kit';
import { theme as t } from '@/ui/theme';

const LOCALE: Record<string, string> = { fr: 'fr-CH', en: 'en-GB', de: 'de-DE', 'de-CH': 'de-CH', ar: 'ar', ff: 'fr-CH', wo: 'fr-CH' };

export default function Prayers() {
  const { s, t: tr } = useSettings();
  const router = useRouter();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  const dayKey = now.toDateString();
  const { rows, next } = useMemo(() => {
    const today = computeDay(now, s.place, s.method, s.madhab);
    const tomorrow = computeDay(new Date(now.getTime() + 86400000), s.place, s.method, s.madhab);
    return withStates(today, now, tomorrow[0].time);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayKey, Math.floor(now.getTime() / 60000), s.place, s.method, s.madhab]);

  let greg = now.toDateString();
  try {
    greg = now.toLocaleDateString(LOCALE[s.lang] ?? 'fr-CH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  } catch {}

  const stateLabel: Record<PrayerState, string> = { past: tr.past, current: tr.current, next: tr.next_prayer, upcoming: tr.upcoming };
  return (
    <Screen>
      <Eyebrow>{tr.today}</Eyebrow>
      <H1>{greg}</H1>
      <Text style={{ color: t.primary, fontSize: 17, marginTop: 4 }} accessibilityLabel={`Date hégirienne ${formatHijri(now, s.lang, s.hijriOffset)}`}>
        {formatHijri(now, s.lang, s.hijriOffset)}
      </Text>
      <Spacer h={16} />
      {s.place.source === 'example' ? (
        <>
          <Notice tone="warning" title={tr.example_location} text={`${s.place.label} (exemple)`} icon="location-outline" />
          <Spacer />
        </>
      ) : null}

      <Card style={{ backgroundColor: t.surfaceAlt, borderColor: t.primary }} accessibilityLabel={`${tr.next_prayer} ${tr[next.key]} ${hhmm(next.time)}`}>
        <Eyebrow style={{ color: t.primary }}>{tr.next_prayer}</Eyebrow>
        <Row style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <Text style={{ color: t.text, fontSize: 34, fontWeight: '800' }}>{tr[next.key]}</Text>
          <Text style={{ color: t.text, fontSize: 34, fontWeight: '300', fontVariant: ['tabular-nums'] }}>{hhmm(next.time)}</Text>
        </Row>
        <Muted>
          {tr.in} {countdown(next.time.getTime() - now.getTime())} · {s.place.label}
        </Muted>
      </Card>
      <Spacer />

      <View accessibilityRole="list" style={{ gap: 8 }}>
        {rows.map((p) => {
          const active = p.state === 'current' || p.state === 'next';
          return (
            <View
              key={p.key}
              accessible
              accessibilityLabel={`${tr[p.key]}, ${hhmm(p.time)}, ${stateLabel[p.state]}`}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                minHeight: 56,
                paddingHorizontal: 16,
                borderRadius: 14,
                backgroundColor: p.state === 'current' ? t.successBg : t.surface,
                borderWidth: 1,
                borderColor: p.state === 'next' ? t.primary : t.border,
                opacity: p.state === 'past' ? 0.55 : 1,
              }}
            >
              <Ionicons name={p.state === 'past' ? 'checkmark-circle' : p.state === 'current' ? 'radio-button-on' : p.key === 'sunrise' ? 'sunny-outline' : 'ellipse-outline'} size={20} color={active ? t.primary : t.muted} />
              <Text style={{ flex: 1, marginHorizontal: 12, color: t.text, fontSize: 17, fontWeight: active ? '700' : '500' }}>{tr[p.key]}</Text>
              {p.state === 'current' ? <Badge label={tr.current} tone="success" /> : p.state === 'next' ? <Badge label={tr.upcoming} tone="warning" /> : null}
              <Text style={{ color: t.text, fontSize: 17, marginLeft: 10, fontVariant: ['tabular-nums'] }}>{hhmm(p.time)}</Text>
            </View>
          );
        })}
      </View>
      <Spacer />
      <Muted>
        {METHODS[s.method]} · {s.madhab === 'hanafi' ? tr.hanafi : tr.shafi} · {tr.offline_ready}
      </Muted>
      <Spacer h={16} />
      <AudioPlayer />
      <Spacer />
      <Button title={tr.sources_title} variant="ghost" icon="library-outline" onPress={() => router.push('/sources')} />
    </Screen>
  );
}
