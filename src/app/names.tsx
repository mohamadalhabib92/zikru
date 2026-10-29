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
import { useLayout } from '@/ui/ds';
import { alpha, brand as b, isDark } from '@/ui/theme';
import { ProvenanceBadges } from '@/components/zikru/Provenance';

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
  const { cols } = useLayout();
  const goldFill = isDark() ? '#A8841F' : b.goldDeep;
  const list = useMemo(() => {
    const nq = norm(q.trim());
    if (!nq) return NAMES;
    const num = parseInt(nq, 10);
    return NAMES.filter((x) => (Number.isFinite(num) ? x.n === num || String(computeAbjad(nameBare(x.ar), repSys, opts).total) === nq : norm(`${x.tr} ${x.fr} ${x.ar}`).includes(nq)));
  }, [q, repSys, opts.taMarbuta, opts.hamza]);

  return (
    <Screen padded={false} bg={b.cream}>
      <PatternBg style={{ padding: 20, alignItems: 'center' }}>
        <Ionicons name="sparkles" size={26} color={b.gold} />
        <Text
          style={{
            color: b.gold,
            fontSize: 30,
            fontFamily: 'Amiri_700Bold',
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
          <Pill label="Les deux" active={prefs.view === 'both'} onPress={() => setPrefs({ view: 'both' })} color={b.hero} />
          <Pill label="Mashriqi" active={prefs.view === 'mashriqi'} onPress={() => setPrefs({ view: 'mashriqi' })} color={b.green} />
          <Pill label="Maghribi" active={prefs.view === 'maghribi'} onPress={() => setPrefs({ view: 'maghribi' })} color={goldFill} />
        </View>
        <LMuted style={{ marginBottom: 10, fontSize: 12 }}>Abjad calculé sur le Nom sans l’article ni « yā » (Laṭīf = 129), selon les options de l’écran Abjad.</LMuted>
        {q.trim() ? <LMuted style={{ marginBottom: 8, fontSize: 12, fontWeight: '700' }}>{`${list.length} / 99`}</LMuted> : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {list.map((x) => {
          const v = computeAbjad(nameBare(x.ar), repSys, opts).total;
          return (
            <LCard key={x.n} style={{ marginBottom: 0, width: cols > 1 ? `${100 / cols - 1.5}%` : '100%' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
                  <View style={{ position: 'absolute', width: 30, height: 30, borderRadius: 7, transform: [{ rotate: '45deg' }], backgroundColor: b.goldSoft, borderWidth: 1, borderColor: alpha(b.gold, 0.6) }} />
                  <Text style={{ color: b.goldDeep, fontWeight: '900', fontSize: 13 }}>{x.n}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: b.ink, fontWeight: '800', fontSize: 16 }}>{x.tr}</Text>
                  <LMuted style={{ fontSize: 13 }}>{x.fr}</LMuted>
                </View>
                <Arabic size={28} style={{ color: b.green }}>
                  {x.ar}
                </Arabic>
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
                        backgroundColor: b.green,
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
        </View>
        {!list.length ? <LMuted>Aucun résultat.</LMuted> : null}
        <LMuted
          style={{ marginTop: 8, fontSize: 12 }}
        >{`${NAMES_REF}. L’énumération des 99 Noms provient de la version d’at-Tirmidhī ; les savants en ont discuté l’authenticité (elle serait une insertion d’un rapporteur), d’autres listes existent. Sens en français indicatif.`}</LMuted>
        <ProvenanceBadges set="names" id="enumeration" />
      </View>
      <AddToZikrSheet item={draft} onClose={() => setDraft(null)} />
    </Screen>
  );
}
