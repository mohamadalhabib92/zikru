import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { PatternBg } from '@/components/zikru/Pattern';
import { FIQH, type Madhab } from '@/lib/fiqh';
import { usePersistentState } from '@/lib/storage';
import { Ionicons, Screen, type IconName } from '@/ui/kit';
import { LCard, LMuted, LText, Pill } from '@/ui/light';
import { brand as b } from '@/ui/theme';

const COLOR = '#A0522D';
export default function Fiqh() {
  const router = useRouter();
  const [m, setM] = usePersistentState<Madhab>('fiqh-madhab', 'maliki');
  const [open, setOpen] = useState<string | null>('wudu');
  return (
    <Screen padded={false} bg={b.cream}>
      <PatternBg color={COLOR} style={{ padding: 20, alignItems: 'center' }}>
        <Ionicons name="scale" size={28} color="#fff" />
        <Text style={{ color: '#fff', fontSize: 26, marginTop: 4 }}>الفقه</Text>
        <Text style={{ color: '#fff', fontSize: 22, fontWeight: '900' }}>Fiqh pratique</Text>
        <Text style={{ color: 'rgba(255,255,255,0.85)' }}>Bases malikites & shafi‘ites</Text>
      </PatternBg>
      <View style={{ padding: 16 }}>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
          <Pill label="Maliki" active={m === 'maliki'} onPress={() => setM('maliki')} color={COLOR} />
          <Pill label="Shafi‘i" active={m === 'shafii'} onPress={() => setM('shafii')} color={COLOR} />
        </View>
        {FIQH[m].map((sec) => {
          const isOpen = open === sec.id;
          return (
            <LCard key={sec.id}>
              <Pressable accessibilityRole="button" accessibilityState={{ expanded: isOpen }} onPress={() => setOpen(isOpen ? null : sec.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: COLOR + '1F', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={sec.icon as IconName} size={20} color={COLOR} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: b.ink, fontWeight: '800', fontSize: 16 }}>{sec.title}</Text>
                  <Text style={{ color: b.brownSoft }}>{sec.ar}</Text>
                </View>
                <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color={b.inkMuted} />
              </Pressable>
              {isOpen ? (
                <View style={{ marginTop: 10 }}>
                  {sec.intro ? <LText style={{ marginBottom: 6 }}>{sec.intro}</LText> : null}
                  {sec.lists.map((l) => (
                    <View key={l.title} style={{ marginTop: 6 }}>
                      <Text style={{ color: COLOR, fontWeight: '800', marginBottom: 4 }}>{l.title}</Text>
                      {l.items.map((it, i) => (
                        <View key={i} style={{ flexDirection: 'row', gap: 8, marginBottom: 4 }}>
                          <Text style={{ color: COLOR, fontWeight: '800', width: 20 }}>{i + 1}.</Text>
                          <LText style={{ flex: 1 }}>{it}</LText>
                        </View>
                      ))}
                    </View>
                  ))}
                </View>
              ) : null}
            </LCard>
          );
        })}
        <LCard onPress={() => router.push('/sahw')} label="Sujud as-sahw">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Ionicons name="construct" size={22} color={COLOR} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: b.ink, fontWeight: '800' }}>Sujud as-sahw (prosternation de l’oubli)</Text>
              <LMuted>Que faire en cas d’oubli, d’ajout ou de doute dans la prière</LMuted>
            </View>
            <Ionicons name="chevron-forward" size={18} color={b.inkMuted} />
          </View>
        </LCard>
        <LMuted>Résumé pratique d’après les manuels de base de chaque école (Ibn ‘Ashir, ar-Risala ; Matn Abi Shuja‘, Safinat an-Naja). Pour les cas particuliers, consultez un imam ou un savant de confiance.</LMuted>
      </View>
    </Screen>
  );
}
