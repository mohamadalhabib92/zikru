import { useState } from 'react';
import { Alert, Platform, Pressable, TextInput, View } from 'react-native';
import { Text } from '@/ui/Text';
import { PatternBg } from '@/components/zikru/Pattern';
import { dayKey, HABIT_PRESETS, streak, useGrowth, type Habit } from '@/lib/growth';
import { useDispense } from '@/lib/dispense-context';
import { Button, Ionicons, Screen, type IconName } from '@/ui/kit';
import { LCard, LMuted, LText, LTitle, SectionLabel } from '@/ui/light';
import { brand as b } from '@/ui/theme';
import { L } from '@/lib/l10n';

const TEAL = b.teal;
function confirm(msg: string, ok: () => void) {
  if (Platform.OS === 'web') {
    if (globalThis.confirm?.(msg)) ok();
  } else Alert.alert(msg, undefined, [{ text: L('Annuler'), style: 'cancel' }, { text: L('Supprimer'), style: 'destructive', onPress: ok }]);
}

function Plant({ n }: { n: number }) {
  const icon: IconName = n >= 30 ? 'flower' : n >= 7 ? 'leaf' : n >= 1 ? 'sparkles' : 'ellipse-outline';
  return <Ionicons name={icon} size={26} color={n ? TEAL : b.inkMuted} />;
}

export default function Habits() {
  const g = useGrowth();
  const today = dayKey();
  const [title, setTitle] = useState('');
  const [anchor, setAnchor] = useState('');
  const [tiny, setTiny] = useState('');
  const [adding, setAdding] = useState(false);
  const done = g.habits.filter((h) => h.done.includes(today)).length;
  const presets = HABIT_PRESETS.filter((p) => !g.habits.some((h) => h.title === p.title));
  const add = () => {
    if (!title.trim()) return;
    g.addHabit({ title: title.trim(), anchor: anchor.trim(), tiny: tiny.trim(), icon: 'leaf-outline' });
    setTitle('');
    setAnchor('');
    setTiny('');
    setAdding(false);
  };
  const { neutral } = useDispense();
  const st = (h: Habit) => streak((k) => h.done.includes(k), new Date(), neutral);
  return (
    <Screen padded={false} bg={b.cream}>
      <PatternBg color={TEAL} style={{ padding: 20 }}>
        <Text style={{ color: '#fff', fontSize: 24, fontWeight: '900' }}>Jardin des habitudes</Text>
        <Text style={{ color: 'rgba(255,255,255,0.9)', marginTop: 4 }}>
          {g.habits.length ? L('{a}/{b} arrosées aujourd’hui', { a: done, b: g.habits.length }) : 'Plantez de petites habitudes, attachées à un moment précis.'}
        </Text>
      </PatternBg>
      <View style={{ padding: 16 }}>
        {g.habits.map((h) => {
          const ok = h.done.includes(today);
          const s = st(h);
          return (
            <LCard key={h.id}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Plant n={s} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: b.ink, fontWeight: '800', fontSize: 16 }}>{h.title}</Text>
                  {h.anchor ? (
                    <LMuted>
                      {h.anchor}
                      {h.tiny ? `, ${h.tiny}.` : ''}
                    </LMuted>
                  ) : null}
                  <Text style={{ color: TEAL, fontWeight: '700', fontSize: 12, marginTop: 2 }}>
                    🔥 {s} j · {h.done.length} fois au total
                  </Text>
                </View>
                <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: ok }} accessibilityLabel={L('{x} fait aujourd’hui', { x: h.title })} onPress={() => g.toggleHabit(h.id)} style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: TEAL, backgroundColor: ok ? TEAL : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                  {ok ? <Ionicons name="checkmark" size={24} color="#fff" /> : null}
                </Pressable>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel={L('Supprimer {x}', { x: h.title })} onPress={() => confirm(L('Supprimer « {x} » ?', { x: h.title }), () => g.removeHabit(h.id))} style={{ alignSelf: 'flex-end', marginTop: 4, padding: 4 }}>
                <Text style={{ color: b.inkMuted, fontSize: 12 }}>Supprimer</Text>
              </Pressable>
            </LCard>
          );
        })}

        {adding ? (
          <LCard>
            <LTitle>Nouvelle habitude</LTitle>
            {[
              { v: title, set: setTitle, ph: 'Habitude (ex. Lire une page de Coran)', l: 'Titre' },
              { v: anchor, set: setAnchor, ph: 'Après… (ex. Après la prière d’Isha)', l: 'Moment déclencheur' },
              { v: tiny, set: setTiny, ph: 'Je… (version minuscule, ex. je lis un verset)', l: 'Version minuscule' },
            ].map((f) => (
              <TextInput key={f.l} value={f.v} onChangeText={f.set} placeholder={f.ph} placeholderTextColor={b.inkMuted} accessibilityLabel={f.l} style={{ borderWidth: 1, borderColor: b.line, borderRadius: 12, padding: 12, marginTop: 8, color: b.ink, backgroundColor: b.cream }} />
            ))}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
              <Button title="Planter" icon="leaf" onPress={add} disabled={!title.trim()} />
              <Button title="Annuler" variant="secondary" onPress={() => setAdding(false)} />
            </View>
          </LCard>
        ) : (
          <Button title="Créer ma propre habitude" icon="add" onPress={() => setAdding(true)} />
        )}

        {presets.length ? (
          <>
            <View style={{ height: 16 }} />
            <SectionLabel color={TEAL}>IDÉES À PLANTER</SectionLabel>
            {presets.map((p) => (
              <LCard key={p.title} onPress={() => g.addHabit(p)} label={L('Ajouter {x}', { x: L(p.title) })}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Ionicons name={p.icon as IconName} size={22} color={TEAL} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: b.ink, fontWeight: '800' }}>{p.title}</Text>
                    <LMuted>
                      {p.anchor}, {p.tiny}.
                    </LMuted>
                  </View>
                  <Ionicons name="add-circle" size={24} color={TEAL} />
                </View>
              </LCard>
            ))}
          </>
        ) : null}
        <LText style={{ marginTop: 8, color: b.inkMuted }}>
          Astuce : « L’action la plus aimée d’Allah est la plus régulière, même si elle est petite » (Bukhari 6464, Muslim 783). Commencez minuscule, puis grandissez.
        </LText>
      </View>
    </Screen>
  );
}
