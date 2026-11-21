import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTv } from '@/lib/settings';
import { PRAYER_UI } from '@/lib/ui';
import { AR_NAMES, CITIES, METHODS, computeDay, hhmm, withStates, type MethodKey, type PrayerKey } from '@/lib/phone';
import { Focusable, Muted, Screen, Title, ink } from '@/ui/focus';

const METHOD_KEYS = Object.keys(METHODS) as MethodKey[];

export default function Prayers() {
  const { s, set, t, place, example } = useTv();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const names = PRAYER_UI[s.lang];
  const view = useMemo(() => {
    const today = computeDay(now, place, s.method, s.madhab);
    const tomorrow = computeDay(new Date(now.getTime() + 86_400_000), place, s.method, s.madhab);
    return withStates(today, now, tomorrow[0].time);
  }, [now, place, s.method, s.madhab]);
  const next = view.next;
  const remain = Math.max(0, next.time.getTime() - now.getTime());
  const mins = Math.round(remain / 60000);
  const cycle = <T,>(list: readonly T[], cur: T, dir: 1 | -1) => list[(list.indexOf(cur) + dir + list.length) % list.length];

  return (
    <Screen>
      <Text style={styles.kicker}>{t.next.toUpperCase()}</Text>
      <View style={styles.hero}>
        <View>
          <Title>{names[next.key]}</Title>
          <Text style={styles.ar}>{AR_NAMES[next.key]}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.clock}>{hhmm(next.time)}</Text>
          <Text style={styles.gold}>
            {t.in} {Math.floor(mins / 60) > 0 ? `${Math.floor(mins / 60)} h ${String(mins % 60).padStart(2, '0')}` : `${mins} min`}
          </Text>
        </View>
      </View>
      <Muted>
        {place.label}
        {example ? ` — ${t.example}` : ''} · {METHODS[s.method]}
      </Muted>
      <View style={styles.grid}>
        {view.rows.map((row) => (
          <View key={row.key} style={[styles.cell, row.state === 'next' && styles.cellNext]}>
            <Text style={styles.cellName}>{names[row.key as PrayerKey]}</Text>
            <Text style={styles.cellAr}>{AR_NAMES[row.key as PrayerKey]}</Text>
            <Text style={styles.cellTime}>{hhmm(row.time)}</Text>
            <Text style={styles.cellState}>{t[row.state === 'current' ? 'now' : row.state === 'past' ? 'past' : 'upcoming']}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.label}>{t.place}</Text>
      <View style={styles.row}>
        <Focusable onPress={() => set({ city: cycle(CITIES, CITIES.find((c) => c.label === place.label) ?? CITIES[0], -1).label, placeConfirmed: true })} style={styles.btn}>
          <Text style={styles.btnText}>‹</Text>
        </Focusable>
        <Text style={styles.value}>{place.label}</Text>
        <Focusable onPress={() => set({ city: cycle(CITIES, CITIES.find((c) => c.label === place.label) ?? CITIES[0], 1).label, placeConfirmed: true })} style={styles.btn}>
          <Text style={styles.btnText}>›</Text>
        </Focusable>
      </View>
      <Text style={styles.label}>{t.method}</Text>
      <View style={styles.row}>
        <Focusable onPress={() => set({ method: cycle(METHOD_KEYS, s.method, -1) })} style={styles.btn}>
          <Text style={styles.btnText}>‹</Text>
        </Focusable>
        <Text style={styles.value}>{METHODS[s.method]}</Text>
        <Focusable onPress={() => set({ method: cycle(METHOD_KEYS, s.method, 1) })} style={styles.btn}>
          <Text style={styles.btnText}>›</Text>
        </Focusable>
      </View>
      <Text style={styles.label}>{t.asr}</Text>
      <View style={styles.row}>
        <Focusable onPress={() => set({ madhab: s.madhab === 'shafi' ? 'hanafi' : 'shafi' })} style={styles.btnWide}>
          <Text style={styles.btnText}>{s.madhab === 'hanafi' ? t.hanafi : t.shafi}</Text>
        </Focusable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  kicker: { color: ink.gold, fontSize: 16, fontWeight: '800', letterSpacing: 1.4 },
  hero: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 8 },
  ar: { color: ink.gold, fontSize: 36, fontFamily: 'Amiri_400Regular', textAlign: 'left' },
  clock: { color: ink.text, fontSize: 64, fontVariant: ['tabular-nums'], fontWeight: '300' },
  gold: { color: ink.gold, fontSize: 24, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 22 },
  cell: { width: 220, backgroundColor: ink.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: ink.line },
  cellNext: { borderColor: ink.gold },
  cellName: { color: ink.text, fontSize: 22, fontWeight: '700' },
  cellAr: { color: ink.gold, fontFamily: 'Amiri_400Regular', fontSize: 22, textAlign: 'right' },
  cellTime: { color: ink.text, fontSize: 28, fontVariant: ['tabular-nums'], marginTop: 6 },
  cellState: { color: ink.muted, fontSize: 14, marginTop: 4 },
  label: { color: ink.muted, fontSize: 16, marginTop: 22, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  btn: { backgroundColor: ink.card, paddingVertical: 10, paddingHorizontal: 18 },
  btnWide: { backgroundColor: ink.card, paddingVertical: 14, paddingHorizontal: 18 },
  btnText: { color: ink.text, fontSize: 22 },
  value: { color: ink.text, fontSize: 20, flex: 1 },
});
