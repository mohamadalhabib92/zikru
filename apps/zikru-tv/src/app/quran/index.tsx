import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { HAMIDULLAH, MUYASSAR, PICKTHALL, SURAHS, type QuranEdition } from '@/lib/phone';
import { useTv } from '@/lib/settings';
import { Focusable, Muted, Screen, Title, ink } from '@/ui/focus';

const EDITIONS: QuranEdition[] = [HAMIDULLAH, PICKTHALL, MUYASSAR];

export default function SurahList() {
  const { t, s, set } = useTv();
  const edition = EDITIONS.find((e) => e.id === s.edition) ?? HAMIDULLAH;
  return (
    <Screen>
      <Title>{t.surahs}</Title>
      <Muted>{edition.citation}</Muted>
      {edition.status !== 'verified' ? <Muted>{t.licenseTodo}</Muted> : null}
      <View style={styles.row}>
        {EDITIONS.map((e) => (
          <Focusable key={e.id} onPress={() => set({ edition: e.id })} style={[styles.ed, s.edition === e.id && styles.edOn]}>
            <Text style={styles.edText}>{e.label}</Text>
          </Focusable>
        ))}
      </View>
      <View style={styles.grid}>
        {SURAHS.map((surah) => (
          <Focusable key={surah[0]} onPress={() => router.push(`/quran/${surah[0]}`)} style={styles.card}>
            <Text style={styles.n}>{surah[0]}</Text>
            <Text style={styles.ar}>{surah[1]}</Text>
            <Text style={styles.name}>{surah[2]}</Text>
            <Text style={styles.meta}>{surah[4]}</Text>
          </Focusable>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginVertical: 16 },
  ed: { backgroundColor: ink.card, paddingVertical: 12, paddingHorizontal: 16 },
  edOn: { borderColor: ink.gold },
  edText: { color: ink.text, fontSize: 18 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: { width: 280, backgroundColor: ink.card, padding: 16, borderRadius: 16 },
  n: { color: ink.gold, fontSize: 14, fontWeight: '700' },
  ar: { color: ink.text, fontFamily: 'Amiri_400Regular', fontSize: 28, textAlign: 'right', lineHeight: 48 },
  name: { color: ink.text, fontSize: 18, marginTop: 4 },
  meta: { color: ink.muted, fontSize: 14 },
});
