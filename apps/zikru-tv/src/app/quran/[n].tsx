import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { HAMIDULLAH, MUYASSAR, PICKTHALL, SURAHS, type QuranEdition } from '@/lib/phone';
import { readSurah, type Ayah } from '@/lib/read-surah';
import { useTv } from '@/lib/settings';
import { Arabic, Focusable, Muted, Screen, Title, ink } from '@/ui/focus';

const EDITIONS: QuranEdition[] = [HAMIDULLAH, PICKTHALL, MUYASSAR];

export default function Surah() {
  const { n: raw } = useLocalSearchParams<{ n: string }>();
  const n = Number(raw);
  const { t, s } = useTv();
  const meta = SURAHS[n - 1];
  const edition = EDITIONS.find((e) => e.id === s.edition) ?? HAMIDULLAH;
  const [ayahs, setAyahs] = useState<Ayah[] | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    let live = true;
    setAyahs(null);
    setErr(false);
    if (!meta) return;
    void readSurah(n, edition.id)
      .then((rows) => {
        if (live) setAyahs(rows);
      })
      .catch(() => {
        if (live) setErr(true);
      });
    return () => {
      live = false;
    };
  }, [n, edition.id, meta]);

  if (!meta) {
    return (
      <Screen>
        <Title>{t.error}</Title>
      </Screen>
    );
  }
  return (
    <Screen>
      <Focusable onPress={() => router.push('/quran')} style={styles.back}>
        <Text style={styles.backText}>{t.back}</Text>
      </Focusable>
      <Title>
        {meta[0]}. {meta[2]}
      </Title>
      <Arabic size={36}>{meta[1]}</Arabic>
      <Muted>{edition.citation}</Muted>
      {edition.status !== 'verified' ? <Muted>{t.licenseTodo}</Muted> : null}
      <Muted>{t.edition} · {edition.label}</Muted>
      {err ? <Text style={styles.err}>{t.error}</Text> : null}
      {!ayahs && !err ? <Muted>{t.loading}</Muted> : null}
      {ayahs?.map((a) => (
        <View key={a.n} style={styles.ayah}>
          <Text style={styles.num}>{a.n}</Text>
          <Arabic size={34}>{a.ar}</Arabic>
          {a.tr ? <Text style={styles.tr}>{a.tr}</Text> : null}
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { alignSelf: 'flex-start', marginBottom: 12, paddingVertical: 8, paddingHorizontal: 4 },
  backText: { color: ink.gold, fontSize: 18 },
  ayah: { marginTop: 22, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: ink.line },
  num: { color: ink.gold, fontSize: 16, fontWeight: '700' },
  tr: { color: ink.muted, fontSize: 22, lineHeight: 32, marginTop: 8 },
  err: { color: '#E7B3A8', fontSize: 20, marginTop: 16 },
});
