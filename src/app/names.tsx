import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { AbjadBadge, AddToZikrSheet, nameItem, type DraftItem } from '@/components/zikr/parts';
import { PatternBg } from '@/components/zikru/Pattern';
import { computeAbjad } from '@/lib/abjad';
import { NAMES, NAMES_REF, nameBare, nameCallTr } from '@/lib/names';
import { useZikrs } from '@/lib/zikrs';
import { Ionicons, Screen } from '@/ui/kit';
import { Arabic, LCard, LMuted, Pill } from '@/ui/light';
import { brand as b } from '@/ui/theme';

const COLOR = '#B07D1A';
const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f\u064B-\u0652\u0670]/g, '')
    .replace(/[‘’ʿʾ'-]/g, '')
    .toLowerCase();

export default function Names() {
  const { prefs, setPrefs, opts, repSys } = useZikrs();
  const qp = useLocalSearchParams<{ q?: string }>();
  const [q, setQ] = useState(typeof qp.q === 'string' ? qp.q : '');
  const [draft, setDraft] = useState<DraftItem | null>(null);
  const list = useMemo(() => {
    const nq = norm(q.trim());
    if (!nq) return NAMES;
    const num = parseInt(nq, 10);
    return NAMES.filter((x) => (Number.isFinite(num) ? x.n === num || String(computeAbjad(nameBare(x.ar), repSys, opts).total) === nq : norm(`${x.tr} ${x.fr} ${x.ar}`).includes(nq)));
  }, [q, repSys, opts.taMarbuta, opts.hamza]);

  return (
    <Screen padded={false} bg={b.cream}>
      <PatternBg color={COLOR} style={{ padding: 20, alignItems: 'center' }}>
        <Ionicons name="sparkles" size={26} color="#fff" />
        <Text
          style={{
            color: '#fff',
            fontSize: 26,
            writingDirection: 'rtl',
            marginTop: 4,
          }}
        >
          الأسماء الحسنى
        </Text>
        <Text style={{ color: '#fff', fontSize: 22, fontWeight: '900' }}>Les 99 Noms d’Allah</Text>
        <Text
          style={{
            color: 'rgba(255,255,255,0.88)',
            textAlign: 'center',
            marginTop: 2,
          }}
        >
          Valeur abjad de chaque Nom · ajout direct à vos zikrs
        </Text>
      </PatternBg>
      <View style={{ padding: 16 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: b.paper,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: b.line,
            paddingHorizontal: 12,
            marginBottom: 10,
          }}
        >
          <Ionicons name="search" size={18} color={b.inkMuted} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Nom, sens, n° ou valeur abjad…"
            placeholderTextColor={b.inkMuted}
            style={{ flex: 1, minHeight: 44, color: b.ink, marginLeft: 8 }}
            accessibilityLabel="Rechercher un Nom"
            autoCorrect={false}
          />
          {q ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Effacer la recherche" onPress={() => setQ('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={b.inkMuted} />
            </Pressable>
          ) : null}
        </View>
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 8,
            marginBottom: 10,
          }}
        >
          <Pill label="Les deux" active={prefs.view === 'both'} onPress={() => setPrefs({ view: 'both' })} color={COLOR} />
          <Pill label="Mashriqi" active={prefs.view === 'mashriqi'} onPress={() => setPrefs({ view: 'mashriqi' })} color="#2F7FD0" />
          <Pill label="Maghribi" active={prefs.view === 'maghribi'} onPress={() => setPrefs({ view: 'maghribi' })} color="#2E8B57" />
        </View>
        <LMuted style={{ marginBottom: 10, fontSize: 12 }}>Abjad calculé sur le Nom sans l’article ni « yā » (Laṭīf = 129), selon les options de l’écran Abjad.</LMuted>
        {list.map((x) => {
          const v = computeAbjad(nameBare(x.ar), repSys, opts).total;
          return (
            <LCard key={x.n} style={{ marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: COLOR + '1C',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: COLOR, fontWeight: '900' }}>{x.n}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: b.ink, fontWeight: '800', fontSize: 16 }}>{x.tr}</Text>
                  <LMuted style={{ fontSize: 13 }}>{x.fr}</LMuted>
                </View>
                <Arabic size={26}>{x.ar}</Arabic>
              </View>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 8,
                  marginTop: 10,
                }}
              >
                <AbjadBadge ar={nameBare(x.ar)} />
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Ajouter ${nameCallTr(x.tr)} à un zikr, 1 fois`}
                    onPress={() => setDraft(nameItem(x, 1))}
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 4,
                      paddingHorizontal: 10,
                      minHeight: 34,
                      borderRadius: 17,
                      borderWidth: 1,
                      borderColor: b.line,
                      backgroundColor: b.paper,
                      opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    <Ionicons name="add" size={15} color={b.inkMuted} />
                    <Text style={{ color: b.ink, fontWeight: '700', fontSize: 12 }}>Zikr</Text>
                  </Pressable>
                  {v > 0 ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Ajouter ${nameCallTr(x.tr)} à un zikr, ${v} fois (valeur abjad)`}
                      onPress={() => setDraft(nameItem(x, v))}
                      style={({ pressed }) => ({
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 4,
                        paddingHorizontal: 10,
                        minHeight: 34,
                        borderRadius: 17,
                        backgroundColor: COLOR,
                        opacity: pressed ? 0.8 : 1,
                      })}
                    >
                      <Ionicons name="add" size={15} color="#fff" />
                      <Text
                        style={{
                          color: '#fff',
                          fontWeight: '800',
                          fontSize: 12,
                        }}
                      >{`× ${v}`}</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            </LCard>
          );
        })}
        {!list.length ? <LMuted>Aucun résultat.</LMuted> : null}
        <LMuted
          style={{ marginTop: 8, fontSize: 12 }}
        >{`${NAMES_REF}. L’énumération des 99 Noms provient de la version d’at-Tirmidhī ; les savants en ont discuté l’authenticité (elle serait une insertion d’un rapporteur), d’autres listes existent. Sens en français indicatif.`}</LMuted>
      </View>
      <AddToZikrSheet item={draft} onClose={() => setDraft(null)} />
    </Screen>
  );
}
