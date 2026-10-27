import { useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { PatternBg } from '@/components/zikru/Pattern';
import { usePersistentState } from '@/lib/storage';
import { SURAHS } from '@/lib/surahs';
import { Ionicons } from '@/ui/kit';
import { LMuted } from '@/ui/light';
import { brand as b } from '@/ui/theme';

const GREEN = '#2E8B57';
export default function QuranList() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [last] = usePersistentState<{ n: number; ayah: number } | null>('quran-last', null);
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const list = SURAHS.filter((s) => !q || String(s[0]) === q.trim() || norm(s[2] + s[3]).includes(norm(q)) || s[1].includes(q.trim()));
  return (
    <View style={{ flex: 1, backgroundColor: b.cream }}>
      <FlatList
        data={list}
        keyExtractor={(s) => String(s[0])}
        contentContainerStyle={{ maxWidth: 720, width: '100%', alignSelf: 'center', paddingBottom: 40 }}
        ListHeaderComponent={
          <View>
            <PatternBg color={GREEN} style={{ padding: 20, alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 28 }}>القرآن الكريم</Text>
              <Text style={{ color: '#fff', fontSize: 22, fontWeight: '900' }}>Le Noble Coran</Text>
              <Text style={{ color: 'rgba(255,255,255,0.85)' }}>114 sourates · texte et traduction</Text>
            </PatternBg>
            <View style={{ padding: 16, paddingBottom: 4 }}>
              {last ? (
                <Pressable accessibilityRole="button" onPress={() => router.push(`/quran/${last.n}`)} style={{ backgroundColor: b.gold, borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <Ionicons name="bookmark" size={20} color={b.brownDark} />
                  <Text style={{ color: b.ink, fontWeight: '800', flex: 1 }}>
                    Reprendre : {SURAHS[last.n - 1][2]} · verset {last.ayah}
                  </Text>
                  <Ionicons name="chevron-forward" size={18} color={b.brownDark} />
                </Pressable>
              ) : null}
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: b.paper, borderRadius: 14, borderWidth: 1, borderColor: b.line, paddingHorizontal: 12 }}>
                <Ionicons name="search" size={18} color={b.inkMuted} />
                <TextInput value={q} onChangeText={setQ} placeholder="Nom ou numéro de sourate…" placeholderTextColor={b.inkMuted} style={{ flex: 1, minHeight: 44, color: b.ink, marginLeft: 8 }} accessibilityLabel="Rechercher une sourate" />
              </View>
            </View>
          </View>
        }
        renderItem={({ item: s }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Sourate ${s[0]}, ${s[2]}`}
            onPress={() => router.push(`/quran/${s[0]}`)}
            style={({ pressed }) => ({ marginHorizontal: 16, marginTop: 8, backgroundColor: pressed ? '#F3EEE4' : b.paper, borderRadius: 14, borderWidth: 1, borderColor: b.line, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 })}
          >
            <View style={{ width: 38, height: 38, borderRadius: 10, transform: [{ rotate: '45deg' }], borderWidth: 2, borderColor: GREEN, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: GREEN, fontWeight: '900', transform: [{ rotate: '-45deg' }] }}>{s[0]}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: b.ink, fontWeight: '800', fontSize: 16 }}>{s[2]}</Text>
              <LMuted>
                {s[3]} · {s[4]} versets · {s[5] === 'M' ? 'mecquoise' : 'médinoise'}
              </LMuted>
            </View>
            <Text style={{ color: GREEN, fontSize: 18 }}>{s[1].replace(/^سُورَةُ\s*/, '')}</Text>
          </Pressable>
        )}
        ListFooterComponent={<LMuted style={{ margin: 16 }}>Texte et traductions : api.alquran.cloud (service public gratuit). Les sourates lues restent disponibles hors-ligne.</LMuted>}
      />
    </View>
  );
}
