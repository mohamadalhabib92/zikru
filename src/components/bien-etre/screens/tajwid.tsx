import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/ui/Text';
import { BEScreen, Choice, Panel, softHaptic, useUthmani } from '@/components/bien-etre/common';
import { loadTajweedSurah, TAJWID_PREVIEW, tajwidVisible } from '@/components/bien-etre/tajwid-data';
import { rng, words } from '@/lib/learn-games';
import { gIndex } from '@/lib/quran-nav';
import { usePersistentState } from '@/lib/storage';
import { SURAHS } from '@/lib/surahs';
import { aligned, colouredWordQuiz, definitionQuiz, GROUP_COLOR, GROUP_LABEL, GROUPS, groupOf, LESSONS, TAJWID_REVIEW_NOTE, TAJWID_SOURCES, type RuleGroup, type Seg } from '@/lib/tajwid';
import { arLang } from '@/ui/ar-lang';
import { FadeIn } from '@/ui/ds';
import { Button, Notice, Toggle } from '@/ui/kit';
import { Arabic } from '@/ui/light';
import { brand as b, fonts, isDark } from '@/ui/theme';
import { L } from '@/lib/l10n';

const colorOf = (g: RuleGroup | null) => (g ? (isDark() ? GROUP_COLOR[g].dark : GROUP_COLOR[g].light) : b.ink);
const lessonTitle = (id: string) => LESSONS.find((l) => l.id === id)?.title ?? id;

/** Segments colorés (aucune lettre ajoutée ni retirée : le texte affiché est exactement le texte Tanzil). */
function Coloured({ segs, size = 26 }: { segs: Seg[]; size?: number }) {
  return (
    <Text {...arLang} style={{ fontFamily: fonts.quran, fontSize: size, lineHeight: Math.round(size * 2.1), textAlign: 'right', writingDirection: 'rtl', color: b.ink }}>
      {segs.map((s, i) => (
        <Text key={i} style={s.code ? { color: colorOf(groupOf(s)) } : undefined}>{s.t}</Text>
      ))}
    </Text>
  );
}

/** Tajwid : leçons par règle (à relire par un enseignant), quiz ; mushaf coloré masqué tant que la licence n’est pas confirmée. */
export default function Tajwid() {
  const router = useRouter();
  const uth = useUthmani();
  const [open, setOpen] = useState<string | null>(null);
  const [seed, setSeed] = useState(1);
  const [answer, setAnswer] = useState<string | null>(null);
  const q = useMemo(() => definitionQuiz(rng(seed * 7919)), [seed]);
  const visible = tajwidVisible();

  return (
    <BEScreen title="Tajwid" sub="Les règles de lecture de la riwāya Ḥafṣ ‘an ‘Āṣim, une à une, avec un exemple du Coran.">
      <Notice tone="warning" title={L(TAJWID_REVIEW_NOTE)} text={L('Ces leçons sont un aide-mémoire. Zikru n’écoute pas et ne corrige pas votre récitation : apprenez auprès d’un enseignant.')} />

      <Text accessibilityRole="header" style={{ color: b.ink, fontWeight: '900', fontSize: 18 }}>Leçons</Text>
      {LESSONS.map((l) => {
        const on = open === l.id;
        const v = uth ? uth[gIndex(l.ex.s, l.ex.a)] : null;
        const ex = v ? words(v).slice(l.ex.w[0], l.ex.w[1] + 1).join(' ') : '';
        const c = l.group === 'izhar' || l.group === 'qamariyya' ? b.ink : colorOf(l.group);
        return (
          <View key={l.id} style={{ backgroundColor: b.paper, borderRadius: 18, borderWidth: 1, borderColor: b.line, overflow: 'hidden' }}>
            <Pressable accessibilityRole="button" accessibilityState={{ expanded: on }} accessibilityLabel={l.title} onPress={() => { softHaptic('select'); setOpen(on ? null : l.id); }} style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c }} />
              <Text style={{ flex: 1, color: b.ink, fontWeight: '800', fontSize: 15 }}>{l.title}</Text>
              <Text {...arLang} style={{ fontFamily: fonts.arabic, color: b.inkMuted, fontSize: 16 }}>{l.ar}</Text>
            </Pressable>
            {on ? (
              <FadeIn style={{ paddingHorizontal: 16, paddingBottom: 16, gap: 8 }}>
                <Text style={{ color: b.ink, lineHeight: 21 }}>{L(l.text)}</Text>
                <Text style={{ color: b.inkMuted, fontSize: 12, fontWeight: '800' }}>Exemple</Text>
                <Arabic quran size={30} style={{ textAlign: 'center' }}>
                  <Text {...arLang}>{ex}</Text>
                </Arabic>
                <Arabic quran size={18} style={{ color: b.inkMuted }}>
                  <Text {...arLang}>{v ?? ''}</Text>
                </Arabic>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <Text style={{ color: b.inkMuted, fontSize: 12, flex: 1 }}>{L('{s}, verset {a}', { s: SURAHS[l.ex.s - 1][2], a: l.ex.a }) + ' · ' + L(TAJWID_REVIEW_NOTE)}</Text>
                  <Button small variant="ghost" title="Lire" icon="book-outline" onPress={() => router.push({ pathname: '/quran/[n]', params: { n: String(l.ex.s), a: String(l.ex.a) } })} />
                </View>
              </FadeIn>
            ) : null}
          </View>
        );
      })}

      <Text accessibilityRole="header" style={{ color: b.ink, fontWeight: '900', fontSize: 18, marginTop: 6 }}>Quiz : quelle règle ?</Text>
      <Panel>
        <Text style={{ color: b.ink, lineHeight: 21 }}>{L(q.prompt.text)}</Text>
        <View style={{ gap: 8 }}>
          {q.options.map((o) => {
            const st = answer == null ? null : o === q.answer ? 'ok' : o === answer ? 'bad' : null;
            return (
              <Pressable
                key={o}
                accessibilityRole="button"
                accessibilityState={{ selected: answer === o, disabled: answer != null }}
                onPress={() => {
                  if (answer != null) return;
                  setAnswer(o);
                  softHaptic(o === q.answer ? 'success' : 'medium');
                }}
                style={{ minHeight: 48, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 14, borderWidth: st ? 2 : 1, borderColor: st === 'ok' ? b.green : st === 'bad' ? b.rust : b.line, backgroundColor: b.paper }}
              >
                <Text style={{ color: b.ink, fontWeight: '700' }}>{lessonTitle(o) + (st === 'ok' ? ' ✓' : '')}</Text>
              </Pressable>
            );
          })}
        </View>
        {answer != null ? <Button title="Question suivante" icon="arrow-forward" onPress={() => { setAnswer(null); setSeed((s) => s + 1); }} /> : null}
      </Panel>

      {visible ? <ColouredSection /> : null}

      <Text accessibilityRole="header" style={{ color: b.ink, fontWeight: '900', fontSize: 16, marginTop: 6 }}>Sources et licences</Text>
      <Text style={{ color: b.inkMuted, fontSize: 12, lineHeight: 18 }}>{L('Exemples tirés du texte Tanzil Uthmani embarqué. Mushaf coloré : en attente de la licence des données tajwid.')}</Text>
      {TAJWID_SOURCES.map((s) => (
        <Text key={s.id} style={{ color: b.inkMuted, fontSize: 12, lineHeight: 18 }}>{`• ${s.name} — ${s.licence}`}</Text>
      ))}
    </BEScreen>
  );
}

/** Mushaf coloré (désactivé par défaut) + jeu « quelle règle sur ce mot coloré ? ». */
function ColouredSection() {
  const uth = useUthmani();
  const [on, setOn] = usePersistentState<boolean>('be-tajwid-colours', false);
  const [surah, setSurah] = useState(112);
  const [got, setGot] = useState<{ n: number; v: string[] | null } | null>(null);
  const src = on && got?.n === surah ? got.v : null;
  const [seed, setSeed] = useState(1);
  const [answer, setAnswer] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (on) void loadTajweedSurah(surah).then((v) => alive && setGot({ n: surah, v }));
    return () => {
      alive = false;
    };
  }, [on, surah]);
  const n = SURAHS[surah - 1][4] as number;
  const rows = useMemo(() => (uth && src ? Array.from({ length: n }, (_, i) => ({ a: i + 1, tanzil: uth[gIndex(surah, i + 1)], segs: src[i] ? aligned(src[i], uth[gIndex(surah, i + 1)]) : null })) : []), [uth, src, surah, n]);
  const quiz = useMemo(() => colouredWordQuiz(rows.flatMap((r) => (r.segs ? [r.segs] : [])), rng(seed * 104729)), [rows, seed]);
  return (
    <>
      <Text accessibilityRole="header" style={{ color: b.ink, fontWeight: '900', fontSize: 18, marginTop: 6 }}>Mushaf coloré</Text>
      {TAJWID_PREVIEW ? <Notice tone="info" title={L('Aperçu de développement')} text={L('Données d’essai, licence non confirmée : jamais activé en production.')} /> : null}
      <Panel>
        <Toggle label="Afficher les couleurs du tajwid" value={on} onChange={setOn} hint="Désactivé par défaut. Un verset n’est coloré que si les annotations correspondent lettre pour lettre au texte Tanzil." />
        {on ? (
          <>
            <Choice label="Sourate" value={surah} onChange={setSurah} options={[1, 108, 112, 113, 114].map((s) => ({ label: `${s}. ${SURAHS[s - 1][2]}`, value: s }))} color={b.rust} />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {GROUPS.map((g) => (
                <View key={g} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: colorOf(g) }} />
                  <Text style={{ color: colorOf(g), fontWeight: '800', fontSize: 13 }}>{L(GROUP_LABEL[g])}</Text>
                </View>
              ))}
            </View>
            {!src ? <Text style={{ color: b.inkMuted }}>Chargement</Text> : null}
            {rows.map((r) => (
              <View key={r.a} style={{ gap: 2 }}>
                {r.segs ? <Coloured segs={r.segs} /> : <Arabic quran size={26}><Text {...arLang}>{r.tanzil}</Text></Arabic>}
                <Text style={{ color: b.inkMuted, fontSize: 11 }}>{`${surah}:${r.a}` + (r.segs ? '' : ' · ' + L('sans couleur (annotation différente du texte Tanzil)'))}</Text>
              </View>
            ))}
          </>
        ) : null}
      </Panel>
      {on && quiz ? (
        <Panel>
          <Text style={{ color: b.ink, fontWeight: '800' }}>Quelle règle sur ce mot coloré ?</Text>
          <View style={{ alignItems: 'center' }}>
            <Coloured segs={quiz.prompt.segs} size={40} />
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {quiz.options.map((o) => {
              const st = answer == null ? null : o === quiz.answer ? 'ok' : o === answer ? 'bad' : null;
              return (
                <Pressable key={o} accessibilityRole="button" onPress={() => { if (answer == null) { setAnswer(o); softHaptic(o === quiz.answer ? 'success' : 'medium'); } }} style={{ minHeight: 48, minWidth: 120, flexGrow: 1, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 14, borderWidth: st ? 2 : 1, borderColor: st === 'ok' ? b.green : st === 'bad' ? b.rust : b.line }}>
                  <Text style={{ color: b.ink, fontWeight: '700', textAlign: 'center' }}>{L(GROUP_LABEL[o as RuleGroup]) + (st === 'ok' ? ' ✓' : '')}</Text>
                </Pressable>
              );
            })}
          </View>
          {answer != null ? <Button title="Mot suivant" icon="arrow-forward" onPress={() => { setAnswer(null); setSeed((s) => s + 1); }} /> : null}
        </Panel>
      ) : null}
    </>
  );
}
