import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { AbjadBadge, AddToZikrSheet, type DraftItem } from '@/components/zikr/parts';
import { BASMALA, getSurah, translationFor, type SurahText } from '@/lib/quran';
import { useSettings } from '@/lib/settings';
import { usePersistentState } from '@/lib/storage';
import { SURAHS } from '@/lib/surahs';
import { Button, Ionicons } from '@/ui/kit';
import { Arabic, LMuted, LText } from '@/ui/light';
import { brand as b } from '@/ui/theme';

const GREEN = '#2E8B57';
export default function SurahReader() {
  const { n: raw } = useLocalSearchParams<{ n: string }>();
  const n = Math.min(114, Math.max(1, parseInt(raw ?? '1', 10) || 1));
  const meta = SURAHS[n - 1];
  const router = useRouter();
  const { s } = useSettings();
  const tr = translationFor(s.lang);
  const [data, setData] = useState<SurahText | null>(null);
  const [err, setErr] = useState(false);
  const [showTr, setShowTr] = usePersistentState('quran-show-tr', true);
  const [size, setSize] = usePersistentState('quran-size', 26);
  const [last, setLast] = usePersistentState<{ n: number; ayah: number } | null>('quran-last', null);
  const [attempt, setAttempt] = useState(0);
  const [draft, setDraft] = useState<DraftItem | null>(null);
  useEffect(() => {
    let alive = true;
    setData(null);
    setErr(false);
    getSurah(n, tr.id)
      .then((d) => alive && setData(d))
      .catch(() => alive && setErr(true));
    return () => {
      alive = false;
    };
  }, [n, tr.id, attempt]);
  return (
    <View style={{ flex: 1, backgroundColor: b.cream }}>
      <Stack.Screen options={{ title: `${n}. ${meta[2]}` }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderBottomWidth: 1, borderBottomColor: b.line, backgroundColor: b.paper }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Afficher / masquer la traduction" onPress={() => setShowTr(!showTr)} style={{ paddingHorizontal: 12, minHeight: 36, justifyContent: 'center', borderRadius: 18, backgroundColor: showTr ? GREEN : b.cream }}>
          <Text style={{ color: showTr ? '#fff' : b.ink, fontWeight: '700' }}>Traduction</Text>
        </Pressable>
        <View style={{ flex: 1 }} />
        <Pressable accessibilityRole="button" accessibilityLabel="Texte plus petit" onPress={() => setSize(Math.max(18, size - 2))} style={{ width: 40, height: 36, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: b.ink, fontWeight: '800' }}>A−</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Texte plus grand" onPress={() => setSize(Math.min(40, size + 2))} style={{ width: 40, height: 36, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: b.ink, fontWeight: '800', fontSize: 18 }}>A+</Text>
        </Pressable>
      </View>
      {!data ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          {err ? (
            <>
              <LText style={{ textAlign: 'center' }}>Impossible de charger la sourate (connexion requise la première fois).</LText>
              <View style={{ height: 12 }} />
              <Button title="Réessayer" icon="refresh" onPress={() => setAttempt((a) => a + 1)} />
            </>
          ) : (
            <ActivityIndicator color={GREEN} />
          )}
        </View>
      ) : (
        <FlatList
          data={data.ayahs}
          keyExtractor={(a) => String(a.n)}
          contentContainerStyle={{ maxWidth: 760, width: '100%', alignSelf: 'center', padding: 16, paddingBottom: 40 }}
          ListHeaderComponent={
            <View style={{ alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ color: GREEN, fontSize: 28 }}>{meta[1]}</Text>
              <LMuted>
                {meta[3]} · {meta[4]} versets · {meta[5] === 'M' ? 'mecquoise' : 'médinoise'}
              </LMuted>
              {n !== 1 && n !== 9 ? <Arabic size={24} style={{ textAlign: 'center', marginTop: 10 }}>{BASMALA}</Arabic> : null}
            </View>
          }
          renderItem={({ item: a }) => {
            const marked = last?.n === n && last.ayah === a.n;
            return (
              <Pressable accessibilityRole="button" accessibilityLabel={`Verset ${a.n}, marquer comme dernière lecture`} onLongPress={() => setLast({ n, ayah: a.n })} onPress={() => setLast({ n, ayah: a.n })} style={{ backgroundColor: marked ? b.goldSoft : b.paper, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: marked ? b.gold : b.line }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ backgroundColor: GREEN + '1F', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 }}>
                    <Text style={{ color: GREEN, fontWeight: '800' }}>
                      {n}:{a.n}
                    </Text>
                  </View>
                  {marked ? <Ionicons name="bookmark" size={16} color={b.goldDeep} /> : null}
                </View>
                <Arabic size={size} style={{ marginTop: 6 }}>
                  {a.ar}
                </Arabic>
                {showTr ? <LText style={{ marginTop: 6 }}>{a.tr}</LText> : null}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 8 }}>
                  <AbjadBadge ar={a.ar} compact />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Ajouter le verset ${n}:${a.n} à un zikr`}
                    hitSlop={6}
                    onPress={() => setDraft({ kind: 'verse', ref: `Coran ${n}:${a.n}`, label: `${meta[2]} ${n}:${a.n}`, ar: a.ar, fr: a.tr, reps: 1 })}
                    style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, minHeight: 30, borderRadius: 15, borderWidth: 1, borderColor: b.line, opacity: pressed ? 0.7 : 1 })}
                  >
                    <Ionicons name="albums-outline" size={14} color={b.inkMuted} />
                    <Text style={{ color: b.ink, fontSize: 12, fontWeight: '700' }}>Zikr</Text>
                  </Pressable>
                </View>
              </Pressable>
            );
          }}
          ListFooterComponent={
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
              {n > 1 ? <Button title="← Précédente" variant="secondary" onPress={() => router.replace(`/quran/${n - 1}`)} /> : null}
              <View style={{ flex: 1 }} />
              {n < 114 ? <Button title="Suivante →" variant="secondary" onPress={() => router.replace(`/quran/${n + 1}`)} /> : null}
            </View>
          }
          ListFooterComponentStyle={{ paddingBottom: 8 }}
        />
      )}
      {data ? <LMuted style={{ textAlign: 'center', padding: 6, fontSize: 11 }}>Traduction : {tr.label} · api.alquran.cloud · touchez un verset pour le marquer</LMuted> : null}
      <AddToZikrSheet item={draft} onClose={() => setDraft(null)} />
    </View>
  );
}
