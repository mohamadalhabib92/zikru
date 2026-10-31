import { useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { Text } from '@/ui/Text';
import { PatternBg } from '@/components/zikru/Pattern';
import { dayKey, useGrowth, type Block } from '@/lib/growth';
import { AR_NAMES, computeDay, hhmm } from '@/lib/prayer';
import { useSettings } from '@/lib/settings';
import { Ionicons, Screen } from '@/ui/kit';
import { LCard, LMuted } from '@/ui/light';
import { brand as b } from '@/ui/theme';
import { L } from '@/lib/l10n';

const PURPLE = b.violet;
const BLOCKS: { key: Block; fr: string; until: string }[] = [
  { key: 'fajr', fr: 'Après Fajr', until: 'dhuhr' },
  { key: 'dhuhr', fr: 'Après Dhuhr', until: 'asr' },
  { key: 'asr', fr: 'Après Asr', until: 'maghrib' },
  { key: 'maghrib', fr: 'Après Maghrib', until: 'isha' },
  { key: 'isha', fr: 'Après Isha', until: 'fajr' },
];

export default function Planner() {
  const { s } = useSettings();
  const g = useGrowth();
  const day = dayKey();
  const tasks = g.tasks[day] ?? [];
  const times = useMemo(() => Object.fromEntries(computeDay(new Date(), s.place, s.method, s.madhab, s.prayer).map((x) => [x.key, x.time])), [s.place, s.method, s.madhab, s.prayer]);
  const now = new Date();
  const currentBlock = [...BLOCKS].reverse().find((bl) => times[bl.key] <= now)?.key ?? 'isha';
  const [draft, setDraft] = useState<Record<string, string>>({});
  const done = tasks.filter((t) => t.done).length;
  return (
    <Screen padded={false} bg={b.cream}>
      <PatternBg color={PURPLE} style={{ padding: 20 }}>
        <Text style={{ color: '#fff', fontSize: 24, fontWeight: '900' }}>Planificateur du jour</Text>
        <Text style={{ color: 'rgba(255,255,255,0.9)', marginTop: 4 }}>Organisez votre journée autour des prières · {tasks.length ? L('{a}/{b} faites', { a: done, b: tasks.length }) : 'aucune tâche'}</Text>
      </PatternBg>
      <View style={{ padding: 16 }}>
        {BLOCKS.map((bl) => {
          const list = tasks.filter((t) => t.block === bl.key);
          const cur = bl.key === currentBlock;
          const add = () => {
            const v = (draft[bl.key] ?? '').trim();
            if (!v) return;
            g.addTask(v, bl.key);
            setDraft((d) => ({ ...d, [bl.key]: '' }));
          };
          return (
            <LCard key={bl.key} style={cur ? { borderColor: PURPLE, borderWidth: 2 } : undefined}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ color: b.ink, fontWeight: '900', fontSize: 16, flex: 1 }}>
                  {bl.fr} <Text style={{ color: b.brownSoft, fontWeight: '400' }}>{AR_NAMES[bl.key]}</Text>
                </Text>
                {cur ? (
                  <View style={{ backgroundColor: PURPLE, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 }}>
                    <Text style={{ color: '#fff', fontWeight: '800', fontSize: 11 }}>MAINTENANT</Text>
                  </View>
                ) : null}
                <LMuted>
                  {hhmm(times[bl.key])}
                  {bl.until !== 'fajr' ? `–${hhmm(times[bl.until])}` : ''}
                </LMuted>
              </View>
              {list.map((t) => (
                <View key={t.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 }}>
                  <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: t.done }} accessibilityLabel={t.title} onPress={() => g.toggleTask(t.id)} style={{ width: 28, height: 28, borderRadius: 8, borderWidth: 2, borderColor: PURPLE, backgroundColor: t.done ? PURPLE : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                    {t.done ? <Ionicons name="checkmark" size={18} color="#fff" /> : null}
                  </Pressable>
                  <Text style={{ flex: 1, color: t.done ? b.inkMuted : b.ink, textDecorationLine: t.done ? 'line-through' : 'none' }}>{t.title}</Text>
                  <Pressable accessibilityRole="button" accessibilityLabel={L('Supprimer {x}', { x: t.title })} onPress={() => g.removeTask(t.id)} style={{ padding: 6 }}>
                    <Ionicons name="close" size={18} color={b.inkMuted} />
                  </Pressable>
                </View>
              ))}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 8 }}>
                <TextInput value={draft[bl.key] ?? ''} onChangeText={(v) => setDraft((d) => ({ ...d, [bl.key]: v }))} onSubmitEditing={add} returnKeyType="done" placeholder={L("Ajouter une tâche…")} placeholderTextColor={b.inkMuted} accessibilityLabel={L('Ajouter une tâche {x}', { x: L(bl.fr) })} style={{ flex: 1, borderWidth: 1, borderColor: b.line, borderRadius: 10, paddingHorizontal: 10, minHeight: 40, color: b.ink, backgroundColor: b.cream }} />
                <Pressable accessibilityRole="button" accessibilityLabel={L("Ajouter")} onPress={add} style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: PURPLE, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="add" size={22} color="#fff" />
                </Pressable>
              </View>
            </LCard>
          );
        })}
        <LMuted>Les tâches sont enregistrées sur cet appareil, pour aujourd’hui.</LMuted>
      </View>
    </Screen>
  );
}
