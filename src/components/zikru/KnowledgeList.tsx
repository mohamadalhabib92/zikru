import { useMemo, useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import { Text } from '@/ui/Text';
import type { Text3 } from '@/lib/knowledge';
import type { ProvenanceSet } from '@/lib/provenance-types';
import { Ionicons, Screen, type IconName } from '@/ui/kit';
import { Arabic, LCard, LMuted, LText, Pill } from '@/ui/light';
import { brand as b } from '@/ui/theme';
import { PatternBg } from './Pattern';
import { ProvenanceBadges } from './Provenance';
import { L, useUiLang } from '@/lib/l10n';

export function KnowledgeList({ items, title, ar, sub, color, icon, note, set, i18n }: { i18n?: Record<string, { topic: [string, string]; en: string }>; items: Text3[]; title: string; ar: string; sub: string; color: string; icon: IconName; note: string; set?: ProvenanceSet }) {
  const lang = useUiLang();
  const topicL = (fr: string) => { if (lang !== 'en' && lang !== 'ar') return fr; const hit = items.find((x) => x.topic === fr && i18n?.[x.id]); return hit ? i18n![hit.id].topic[lang === 'en' ? 0 : 1] : fr; };
  const meaning = (x: Text3) => (lang === 'ar' ? undefined : lang === 'en' && i18n?.[x.id] ? i18n[x.id].en : x.fr);
  const [q, setQ] = useState('');
  const [topic, setTopic] = useState<string | null>(null);
  const topics = useMemo(() => [...new Set(items.map((x) => x.topic))], [items]);
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const list = items.filter((x) => (!topic || x.topic === topic) && (!q || norm(x.fr + ' ' + (meaning(x) ?? '') + ' ' + x.ar + ' ' + x.ref + ' ' + (x.tr ?? '') + ' ' + x.topic + ' ' + topicL(x.topic)).includes(norm(q))));
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
          <TextInput value={q} onChangeText={setQ} placeholder={L("Rechercher (mot, thème, référence)…")} placeholderTextColor={b.inkMuted} style={{ flex: 1, minHeight: 44, color: b.ink, marginLeft: 8 }} accessibilityLabel={L("Rechercher")} />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} style={{ marginBottom: 12 }}>
          <Pill label="Tout" active={!topic} onPress={() => setTopic(null)} color={color} />
          {topics.map((tp) => (
            <Pill key={tp} label={topicL(tp)} active={topic === tp} onPress={() => setTopic(tp)} color={color} />
          ))}
        </ScrollView>
        {list.map((x) => (
          <LCard key={x.id}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
              <Text style={{ color, fontWeight: '800', fontSize: 12 }}>{topicL(x.topic).toUpperCase()}</Text>
              {x.when ? <LMuted style={{ fontSize: 12 }}>{x.when}</LMuted> : null}
            </View>
            <Arabic size={21}>{x.ar}</Arabic>
            {x.tr ? <Text style={{ color: b.brownSoft, fontStyle: 'italic', marginTop: 4 }}>{x.tr}</Text> : null}
            {meaning(x) ? <LText style={{ marginTop: 6 }}>{meaning(x)}</LText> : null}
            {lang === 'en' && i18n?.[x.id] ? <Text style={{ alignSelf: 'flex-start', marginTop: 4, fontSize: 11, fontWeight: '700', color: b.brown }}>{L('Traduction Zikru — à relire')}</Text> : null}
            <Text style={{ color: b.brown, fontWeight: '800', marginTop: 8, fontSize: 13 }}>{x.ref}</Text>
            {set ? <ProvenanceBadges set={set} id={x.id} /> : null}
          </LCard>
        ))}
        {!list.length ? <LMuted>Aucun résultat.</LMuted> : null}
        <LMuted style={{ marginTop: 8 }}>{note}</LMuted>
      </View>
    </Screen>
  );
}
