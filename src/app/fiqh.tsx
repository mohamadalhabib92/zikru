import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { PatternBg } from '@/components/zikru/Pattern';
import { RulingSource } from '@/components/zikru/RulingSource';
import { FIQH, FIQH_GAPS, SCHOOLS, SCHOOL_LABEL } from '@/lib/fiqh';
import { useMadhab } from '@/lib/madhab';
import { Ionicons, Screen, type IconName } from '@/ui/kit';
import { LCard, LMuted, LText, Pill } from '@/ui/light';
import { brand as b } from '@/ui/theme';

const COLOR = '#A0522D';
export default function Fiqh() {
  const router = useRouter();
  const [m, setM] = useMadhab();
  const [open, setOpen] = useState<string | null>('wudu');
  const gaps = FIQH_GAPS.filter((g) => g.school === m);
  return (
    <Screen padded={false} bg={b.cream}>
      <PatternBg color={COLOR} style={{ padding: 20, alignItems: 'center' }}>
        <Ionicons name="scale" size={28} color="#fff" />
        <Text style={{ color: '#fff', fontSize: 26, marginTop: 4 }}>الفقه</Text>
        <Text style={{ color: '#fff', fontSize: 22, fontWeight: '900' }}>Fiqh pratique</Text>
        <Text style={{ color: 'rgba(255,255,255,0.85)' }}>Les quatre écoles · sources citées</Text>
      </PatternBg>
      <View style={{ padding: 16 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          {SCHOOLS.map((s) => (
            <Pill key={s} label={SCHOOL_LABEL[s].fr} active={m === s} onPress={() => setM(s)} color={COLOR} />
          ))}
        </View>
        <LMuted style={{ marginBottom: 10 }}>
          Chaque liste indique son école, son livre, son chapitre et sa page. Tout est « à valider » par une personne de savoir. Ce réglage est partagé avec les Réglages et le Sujud as-sahw.
        </LMuted>
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
                  <Text style={{ color: b.brownSoft }}>
                    {sec.ar} · {SCHOOL_LABEL[m].fr}
                  </Text>
                </View>
                <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color={b.inkMuted} />
              </Pressable>
              {isOpen ? (
                <View style={{ marginTop: 10 }}>
                  {sec.intro ? (
                    <View style={{ marginBottom: 8 }}>
                      <LText>{sec.intro.items[0]}</LText>
                      <RulingSource r={sec.intro} />
                    </View>
                  ) : null}
                  {sec.lists.map((l) => (
                    <View key={l.id} style={{ marginTop: 10 }}>
                      <Text style={{ color: COLOR, fontWeight: '800', marginBottom: 4 }}>{l.title.fr}</Text>
                      {l.items.map((it, i) => (
                        <View key={i} style={{ flexDirection: 'row', gap: 8, marginBottom: 4 }}>
                          <Text style={{ color: COLOR, fontWeight: '800', width: 20 }}>{i + 1}.</Text>
                          <LText style={{ flex: 1 }}>{it}</LText>
                        </View>
                      ))}
                      <RulingSource r={l} />
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
        {gaps.length ? (
          <LCard>
            <Text style={{ color: b.ink, fontWeight: '800', marginBottom: 4 }}>Non couvert pour cette école (faute de source citée)</Text>
            {gaps.map((g, i) => (
              <LMuted key={i} style={{ marginTop: 2 }}>
                • {g.what}
              </LMuted>
            ))}
          </LCard>
        ) : null}
        <LMuted>
          Résumés pratiques traduits depuis les manuels de base de chaque école (Ibn ‘Ashir via Mayyara, ar-Risala ; Safinat an-Naja, Matn Abi Shuja‘, Minhaj ; Nur al-Idah ; ‘Umdat al-Fiqh). Pour les cas particuliers, consultez un imam ou un savant de confiance.
        </LMuted>
      </View>
    </Screen>
  );
}
