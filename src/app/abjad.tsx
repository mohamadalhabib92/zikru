import * as Clipboard from 'expo-clipboard';
import { useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { PatternBg } from '@/components/zikru/Pattern';
import { ABJAD_EXAMPLES, DIFF_LETTERS, MAGHRIBI, MASHRIQI, ORDER_MASHRIQI, computeAbjad, type AbjadOptions, type AbjadSystem } from '@/lib/abjad';
import { useZikrs } from '@/lib/zikrs';
import { Ionicons, Screen } from '@/ui/kit';
import { Arabic, LCard, LMuted, LText, LTitle, Pill, SectionLabel } from '@/ui/light';
import { alpha, brand as b, isDark } from '@/ui/theme';

// Jetons émeraude / or (clair et sombre) : lus au rendu, car `brand` est réécrit par applyScheme.
const SYS: Record<AbjadSystem, { label: string; ar: string; color: string; fill: string; ink: string }> = {
  mashriqi: {
    label: 'Mashriqi (oriental)',
    ar: 'المشرقي',
    get color() {
      return b.green;
    },
    get fill() {
      return b.green;
    },
    get ink() {
      return '#FFFFFF';
    },
  },
  maghribi: {
    label: 'Maghribi (occidental)',
    ar: 'المغربي',
    get color() {
      return b.goldDeep;
    },
    get fill() {
      return b.hero;
    },
    get ink() {
      return b.gold;
    },
  },
};
const goldFill = () => (isDark() ? '#A8841F' : b.goldDeep);
const NORM_RULES: [string, string, string][] = [
  ['أ إ آ ٱ', 'ا', '= 1'],
  ['ى', 'ي', '= 10'],
  ['ؤ', 'و', '= 6'],
  ['ئ', 'ي', '= 10'],
  ['ة', 'ه / ت', '= 5 ou 400'],
  ['ء', 'ء', '= 1 ou 0'],
];
type View3 = 'both' | AbjadSystem;
type Prefs = { view: View3; ta: 'ha' | 'ta'; hamza: 1 | 0; words: boolean };

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: 10 }}>
      <LMuted style={{ fontWeight: '700', marginBottom: 6 }}>{label}</LMuted>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{children}</View>
    </View>
  );
}

export default function Abjad() {
  const [text, setText] = useState(ABJAD_EXAMPLES[0]);
  const { prefs: p, setPrefs } = useZikrs();
  const [copied, setCopied] = useState(false);
  const opts: AbjadOptions = { taMarbuta: p.ta, hamza: p.hamza };
  const res = useMemo(() => ({ mashriqi: computeAbjad(text, 'mashriqi', opts), maghribi: computeAbjad(text, 'maghribi', opts) }), [text, p.ta, p.hamza]);
  const shown: AbjadSystem[] = p.view === 'both' ? ['mashriqi', 'maghribi'] : [p.view];
  const set = (patch: Partial<Prefs>) => setPrefs(patch);
  const fmt = (n: number) => n.toLocaleString('fr-CH');

  const copy = async () => {
    const lines = shown.map((s) => `${SYS[s].label} : ${res[s].total} (racine ${res[s].root})`);
    try {
      await Clipboard.setStringAsync(`${text.trim()}\n${lines.join('\n')}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* indisponible */
    }
  };

  const m = res.mashriqi;
  const g = res.maghribi;

  return (
    <Screen padded={false} bg={b.cream}>
      <PatternBg style={{ padding: 20, alignItems: 'center' }}>
        <Ionicons name="calculator" size={28} color="#fff" />
        <Text style={{ color: '#fff', fontSize: 26, writingDirection: 'rtl', marginTop: 4 }}>حساب الجُمَّل</Text>
        <Text style={{ color: '#fff', fontSize: 22, fontWeight: '900' }}>Calculateur abjad</Text>
        <Text style={{ color: 'rgba(255,255,255,0.85)', textAlign: 'center' }}>Valeurs numériques des lettres · Mashriqi & Maghribi</Text>
      </PatternBg>

      <View style={{ padding: 16 }}>
        <LCard>
          <LMuted style={{ fontWeight: '700', marginBottom: 6 }}>Texte arabe</LMuted>
          <TextInput
            value={text}
            onChangeText={setText}
            multiline
            placeholder="اكتب هنا…"
            placeholderTextColor={b.inkMuted}
            accessibilityLabel="Texte arabe à calculer"
            autoCorrect={false}
            style={{ minHeight: 70, fontSize: 24, lineHeight: 40, color: b.ink, textAlign: 'right', writingDirection: 'rtl', backgroundColor: b.cream, borderRadius: 12, borderWidth: 1, borderColor: b.line, padding: 10 }}
          />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
            {ABJAD_EXAMPLES.map((ex) => (
              <Pressable key={ex} accessibilityRole="button" accessibilityLabel={`Exemple ${ex}`} onPress={() => setText(ex)} style={({ pressed }) => ({ paddingHorizontal: 12, minHeight: 36, justifyContent: 'center', borderRadius: 18, borderWidth: 1, borderColor: b.line, backgroundColor: text === ex ? alpha(b.gold, 0.22) : b.paper, opacity: pressed ? 0.8 : 1 })}>
                <Text style={{ color: b.ink, fontSize: 16, writingDirection: 'rtl' }}>{ex}</Text>
              </Pressable>
            ))}
            {text ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Effacer" onPress={() => setText('')} style={{ paddingHorizontal: 12, minHeight: 36, justifyContent: 'center' }}>
                <Text style={{ color: b.inkMuted, fontWeight: '700' }}>Effacer</Text>
              </Pressable>
            ) : null}
          </View>
        </LCard>

        <LCard>
          <LTitle style={{ fontSize: 16 }}>Système et règles</LTitle>
          <Row label="Affichage">
            <Pill label="Les deux" active={p.view === 'both'} onPress={() => set({ view: 'both' })} color={b.hero} />
            <Pill label="Mashriqi" active={p.view === 'mashriqi'} onPress={() => set({ view: 'mashriqi' })} color={SYS.mashriqi.color} />
            <Pill label="Maghribi" active={p.view === 'maghribi'} onPress={() => set({ view: 'maghribi' })} color={goldFill()} />
          </Row>
          <Row label="Tā’ marbūṭa (ة)">
            <Pill label="5 · comme ه" active={p.ta === 'ha'} onPress={() => set({ ta: 'ha' })} color={b.green} />
            <Pill label="400 · comme ت" active={p.ta === 'ta'} onPress={() => set({ ta: 'ta' })} color={b.green} />
          </Row>
          <Row label="Hamza isolée (ء)">
            <Pill label="= 1" active={p.hamza === 1} onPress={() => set({ hamza: 1 })} color={b.green} />
            <Pill label="= 0" active={p.hamza === 0} onPress={() => set({ hamza: 0 })} color={b.green} />
          </Row>
          <Row label="Détail">
            <Pill label="Somme par mot" active={p.words} onPress={() => set({ words: !p.words })} color={b.green} />
          </Row>
          <LMuted style={{ marginTop: 10, fontSize: 12 }}>Normalisation appliquée avant le calcul : voyelles (tashkīl), shadda, sukūn, alif suscrit et tatwīl sont ignorés (une lettre avec shadda compte une fois, comme dans l’usage classique).</LMuted>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
            {NORM_RULES.map(([from, to, v]) => (
              <View key={from} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, backgroundColor: b.cream, borderWidth: 1, borderColor: b.line }}>
                <Text style={{ color: b.ink, fontSize: 18 }}>{from}</Text>
                <Ionicons name="arrow-forward" size={12} color={b.inkMuted} />
                <Text style={{ color: b.ink, fontSize: 18 }}>{to}</Text>
                <Text style={{ color: b.inkMuted, fontSize: 12 }}>{v}</Text>
              </View>
            ))}
          </View>
        </LCard>

        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
          {shown.map((s) => (
            <View key={s} style={{ flex: 1, backgroundColor: SYS[s].fill, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: s === 'maghribi' ? alpha(b.gold, 0.5) : SYS[s].fill }}>
              <Text style={{ color: 'rgba(255,255,255,0.9)', fontWeight: '800', fontSize: 12 }}>{SYS[s].label.toUpperCase()}</Text>
              <Text style={{ color: '#fff', fontSize: 14, writingDirection: 'rtl' }}>{SYS[s].ar}</Text>
              <Text accessibilityLabel={`Total ${SYS[s].label} : ${res[s].total}`} style={{ color: SYS[s].ink, fontSize: 38, fontWeight: '900', marginTop: 4, fontVariant: ['tabular-nums'] }}>
                {fmt(res[s].total)}
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.9)' }}>{`Racine numérique : ${res[s].root}`}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12 }}>{`${res[s].letters.length} lettres · ${res[s].words.length} mot${res[s].words.length > 1 ? 's' : ''}`}</Text>
            </View>
          ))}
        </View>
        {p.view === 'both' && m.total !== g.total ? <LMuted style={{ marginBottom: 10 }}>{`Écart entre les deux systèmes : ${fmt(Math.abs(g.total - m.total))} — dû aux lettres à cadre doré ci-dessous.`}</LMuted> : null}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 4 }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Copier le résultat" onPress={copy} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36, paddingHorizontal: 12, borderRadius: 18, borderWidth: 1, borderColor: b.line, backgroundColor: b.paper, opacity: pressed ? 0.8 : 1 })}>
            <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={16} color={copied ? b.green : b.inkMuted} />
            <Text style={{ color: b.ink, fontWeight: '700', fontSize: 13 }}>{copied ? 'Copié' : 'Copier le résultat'}</Text>
          </Pressable>
        </View>
        {m.ignored.length ? <LMuted style={{ marginTop: 6 }}>{`Caractères ignorés : ${m.ignored.join(' ')}`}</LMuted> : null}

        {p.words && m.words.length ? (
          <>
            <SectionLabel color={b.gold}>SOMME PAR MOT</SectionLabel>
            <LCard>
              {m.words.map((w, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: i < m.words.length - 1 ? 1 : 0, borderBottomColor: b.line }}>
                  <View style={{ flex: 1, flexDirection: 'row', gap: 14 }}>
                    {shown.map((s) => (
                      <Text key={s} style={{ color: SYS[s].color, fontWeight: '800', fontSize: 16 }}>
                        {fmt(res[s].words[i]?.total ?? 0)}
                      </Text>
                    ))}
                  </View>
                  <Text style={{ color: b.ink, fontSize: 20, writingDirection: 'rtl' }}>{w.word}</Text>
                </View>
              ))}
            </LCard>
          </>
        ) : null}

        {m.letters.length ? (
          <>
            <SectionLabel color={b.gold}>DÉTAIL PAR LETTRE</SectionLabel>
            <LCard>
              <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 6 }}>
                {m.letters.map((l, i) => {
                  const diff = DIFF_LETTERS.includes(l.ch);
                  return (
                    <View key={i} style={{ minWidth: 52, alignItems: 'center', paddingVertical: 6, paddingHorizontal: 6, borderRadius: 10, borderWidth: 1, borderColor: diff ? b.gold : b.line, backgroundColor: diff ? b.gold + '1A' : b.cream }}>
                      <Text style={{ color: b.ink, fontSize: 22 }}>{l.ch}</Text>
                      {shown.map((s) => (
                        <Text key={s} style={{ color: SYS[s].color, fontWeight: '800', fontSize: 12 }}>
                          {res[s].letters[i]?.value}
                        </Text>
                      ))}
                    </View>
                  );
                })}
              </View>
              {p.view === 'both' ? <LMuted style={{ marginTop: 8, fontSize: 12 }}>Bleu : mashriqi · vert : maghribi · cadre doré : lettre dont la valeur diffère.</LMuted> : null}
            </LCard>
          </>
        ) : null}

        <SectionLabel color={b.gold}>TABLE DES VALEURS</SectionLabel>
        <LCard>
          <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 6 }}>
            {ORDER_MASHRIQI.map((ch) => {
              const diff = DIFF_LETTERS.includes(ch);
              return (
                <View key={ch} style={{ width: 58, alignItems: 'center', paddingVertical: 5, borderRadius: 10, borderWidth: 1, borderColor: diff ? b.gold : b.line, backgroundColor: diff ? b.gold + '1A' : b.paper }}>
                  <Text style={{ color: b.ink, fontSize: 20 }}>{ch}</Text>
                  <Text style={{ color: SYS.mashriqi.color, fontWeight: '800', fontSize: 12 }}>{MASHRIQI[ch]}</Text>
                  {diff ? <Text style={{ color: SYS.maghribi.color, fontWeight: '800', fontSize: 12 }}>{MAGHRIBI[ch]}</Text> : null}
                </View>
              );
            })}
          </View>
          <LMuted style={{ marginTop: 8, fontSize: 12 }}>
            Ordre mashriqi : abjad, hawwaz, ḥuṭṭī, kalaman, sa‘faṣ, qarashat, thakhadh, ḍaẓagh. Seules six lettres changent en maghribi : ص 60, ض 90, س 300, ظ 800, غ 900, ش 1000 (valeur verte).
          </LMuted>
        </LCard>

        <SectionLabel color={b.gold}>REPÈRE HISTORIQUE</SectionLabel>
        <LCard>
          <Arabic size={18}>أَبْجَدْ هَوَّزْ حُطِّي كَلَمَنْ</Arabic>
          <LText style={{ marginTop: 6 }}>
            Le ḥisāb al-jummal attribue à chaque lettre une valeur numérique selon l’ordre ancien de l’alphabet sémitique (abjad), que l’arabe partage avec l’araméen, l’hébreu et le grec. Avant la diffusion des chiffres indo-arabes, il servait à noter des nombres ; il est ensuite resté en usage pour numéroter des listes et composer des chronogrammes, où la somme des lettres d’un vers donne une date (construction, naissance, décès, achèvement d’un ouvrage).
          </LText>
          <LText style={{ marginTop: 6 }}>
            Deux ordres coexistent : l’ordre oriental (mashriqi), répandu du Proche-Orient à l’Asie, et l’ordre occidental (maghribi), employé au Maghreb, en al-Andalus et en Afrique de l’Ouest, qui ne diffère que sur six lettres.
          </LText>
          <LMuted style={{ marginTop: 8 }}>Outil de calcul linguistique et historique : ce calcul ne constitue ni une preuve ni une source de jugement religieux.</LMuted>
        </LCard>
      </View>
    </Screen>
  );
}
