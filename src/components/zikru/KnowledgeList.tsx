import { useMemo, useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import type { Text3 } from '@/lib/knowledge';
import { Ionicons, Screen, type IconName } from '@/ui/kit';
import { Arabic, LCard, LMuted, LText, Pill } from '@/ui/light';
import { brand as b } from '@/ui/theme';
import { PatternBg } from './Pattern';

export function KnowledgeList({ items, title, ar, sub, color, icon, note }: { items: Text3[]; title: string; ar: string; sub: string; color: string; icon: IconName; note: string }) {
  const [q, setQ] = useState('');
  const [topic, setTopic] = useState<string | null>(null);
  const topics = useMemo(() => [...new Set(items.map((x) => x.topic))], [items]);
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const list = items.filter((x) => (!topic || x.topic === topic) && (!q || norm(x.fr + ' ' + x.ref + ' ' + (x.tr ?? '') + ' ' + x.topic).includes(norm(q))));
  return (
    <Screen padded={false} bg={b.cream}>
      <PatternBg color={color} style={{ padding: 20, alignItems: 'center' }}>
        <Ionicons name={icon} size={28} color="#fff" />
        <Text style={{ color: '#fff', fontSize: 26, writingDirection: 'rtl', marginTop: 4 }}>{ar}</Text>
        <Text style={{ color: '#fff', fontSize: 22, fontWeight: '900' }}>{title}</Text>
        <Text style={{ color: 'rgba(255,255,255,0.85)' }}>{sub}</Text>
      </PatternBg>
      <View style={{ padding: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: b.paper, borderRadius: 14, borderWidth: 1, borderColor: b.line, paddingHorizontal: 12, marginBottom: 10 }}>
          <Ionicons name="search" size={18} color={b.inkMuted} />
          <TextInput value={q} onChangeText={setQ} placeholder="Rechercher (mot, thème, référence)…" placeholderTextColor={b.inkMuted} style={{ flex: 1, minHeight: 44, color: b.ink, marginLeft: 8 }} accessibilityLabel="Rechercher" />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} style={{ marginBottom: 12 }}>
          <Pill label="Tout" active={!topic} onPress={() => setTopic(null)} color={color} />
          {topics.map((tp) => (
            <Pill key={tp} label={tp} active={topic === tp} onPress={() => setTopic(tp)} color={color} />
          ))}
        </ScrollView>
        {list.map((x) => (
          <LCard key={x.id}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
              <Text style={{ color, fontWeight: '800', fontSize: 12 }}>{x.topic.toUpperCase()}</Text>
              {x.when ? <LMuted style={{ fontSize: 12 }}>{x.when}</LMuted> : null}
            </View>
            <Arabic size={21}>{x.ar}</Arabic>
            {x.tr ? <Text style={{ color: b.brownSoft, fontStyle: 'italic', marginTop: 4 }}>{x.tr}</Text> : null}
            <LText style={{ marginTop: 6 }}>{x.fr}</LText>
            <Text style={{ color: b.brown, fontWeight: '800', marginTop: 8, fontSize: 13 }}>{x.ref}</Text>
          </LCard>
        ))}
        {!list.length ? <LMuted>Aucun résultat.</LMuted> : null}
        <LMuted style={{ marginTop: 8 }}>{note}</LMuted>
      </View>
    </Screen>
  );
}
