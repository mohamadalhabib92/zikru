import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useUthmani } from '@/components/quran/data';
import { readerPalette } from '@/components/quran/palette';
import { dayKey } from '@/lib/dates';
import { buildDrill, recallKeys, surahSlice, type RecallDrill } from '@/lib/hifz-wave';
import { gradeOf, orderStepOk, rng } from '@/lib/learn-games';
import { L } from '@/lib/l10n';
import { fromIndex } from '@/lib/quran-nav';
import { gradeVerses, hifzCards, startHifz } from '@/lib/quran-store';
import { useShared } from '@/lib/shared-state';
import { Button } from '@/ui/kit';
import { TVPressable as Pressable } from '@/ui/tv-pressable';
import { Text } from '@/ui/Text';
import { fonts, brand as b } from '@/ui/theme';

function drillTitle(kind: RecallDrill['kind']): string {
  if (kind === 'order') return L('Remettre dans l’ordre');
  if (kind === 'cloze') return L('Mot manquant');
  if (kind === 'continue') return L('Suite du verset');
  return L('Quel verset vient ensuite ?');
}

/** Rappel actif. Les notes passent par gradeVerses, dans les mêmes cartes que la télé. */
export default function HifzRecall() {
  const router = useRouter();
  const params = useLocalSearchParams<{ keys?: string }>();
  const [cards] = useShared(hifzCards);
  const all = useUthmani();
  const today = dayKey();
  const lesson = useMemo(() => (params.keys ?? '').split(',').map(Number).filter((n) => Number.isFinite(n) && n >= 0), [params.keys]);
  const keys = useMemo(() => recallKeys(cards, today, lesson), [cards, today, lesson]);
  const [i, setI] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [picked, setPicked] = useState<string[]>([]);
  const [revealed, setRevealed] = useState(false);
  const pal = readerPalette('auto');
  const k = keys[i];
  const drill = useMemo(() => {
    if (k == null || !all) return null;
    const slice = surahSlice(all, k);
    return buildDrill(i, slice.verse, slice.next, slice.pool, rng(k * 1000 + i + 1));
  }, [all, i, k]);

  const finish = (g: ReturnType<typeof gradeOf>) => {
    if (k == null) return;
    startHifz(k, k + 1);
    gradeVerses([k], g);
    setI((n) => n + 1);
    setMistakes(0);
    setPicked([]);
    setRevealed(false);
  };
  const wrong = () => setMistakes((n) => n + 1);

  if (!all) return <View style={{ flex: 1, backgroundColor: pal.bg }} />;
  if (!keys.length || i >= keys.length) {
    return (
      <View style={{ flex: 1, backgroundColor: pal.bg, padding: 24, alignItems: 'center', justifyContent: 'center', gap: 14 }}>
        <Text style={{ color: pal.ink, fontSize: 22, fontWeight: '900', textAlign: 'center' }}>{keys.length ? L('C’est noté. Les cartes sont à jour, y compris sur la télé.') : L('Rien à rappeler pour l’instant. Faites une leçon, puis revenez.')}</Text>
        <Text style={{ color: pal.muted }}>{L('à vérifier')}</Text>
        <Button title={L('Mémorisation')} onPress={() => router.back()} />
      </View>
    );
  }
  if (!drill) return <View style={{ flex: 1, backgroundColor: pal.bg }} />;
  const [surah, ayah] = fromIndex(k);
  const stuck = revealed || mistakes >= 3;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: pal.bg }} contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}>
      <Text style={{ color: pal.muted, fontWeight: '700' }}>{drillTitle(drill.kind)} · {surah}:{ayah} · {i + 1}/{keys.length}</Text>
      <Prompt drill={drill} picked={picked} revealed={stuck} palInk={pal.ink} />
      {stuck ? (
        <Button title={L('Continuer')} onPress={() => finish('hard')} />
      ) : (
        <Choices
          drill={drill}
          picked={picked}
          onPick={(ok) => {
            if (!ok) {
              wrong();
              return;
            }
            if (drill.kind === 'order') {
              const word = drill.p.words[picked.length];
              const next = [...picked, word];
              setPicked(next);
              if (next.length === drill.p.words.length) finish(gradeOf(mistakes, false));
              return;
            }
            finish(gradeOf(mistakes, false));
          }}
        />
      )}
      {!stuck ? <Button title={L('Révéler')} variant="secondary" onPress={() => setRevealed(true)} /> : null}
    </ScrollView>
  );
}

function Prompt({ drill, picked, revealed, palInk }: { drill: RecallDrill; picked: string[]; revealed: boolean; palInk: string }) {
  const arabic = { color: palInk, fontFamily: fonts.quran, fontSize: 28, lineHeight: 52, textAlign: 'right' as const, writingDirection: 'rtl' as const };
  if (drill.kind === 'order') {
    const show = revealed ? drill.p.words.join(' ') : picked.join(' ');
    return <Text style={arabic}>{show || '…'}</Text>;
  }
  if (drill.kind === 'cloze') {
    const hole = revealed ? drill.p.answer : '……';
    return <Text style={arabic}>{[...drill.p.before, hole, ...drill.p.after].join(' ')}</Text>;
  }
  if (drill.kind === 'continue') return <Text style={arabic}>{revealed ? `${drill.p.start} ${drill.p.answer}` : drill.p.start}</Text>;
  return <Text style={arabic}>{revealed ? drill.p.answer : drill.p.prompt}</Text>;
}

function Choices({ drill, picked, onPick }: { drill: RecallDrill; picked: string[]; onPick: (ok: boolean) => void }) {
  const options = drill.kind === 'order' ? drill.p.shuffled.filter((w) => picked.filter((x) => x === w).length < drill.p.words.filter((x) => x === w).length) : drill.kind === 'next' ? drill.p.options : drill.p.options;
  return (
    <View style={{ gap: 8 }}>
      {options.map((op, n) => {
        const ok = drill.kind === 'order' ? orderStepOk(drill.p, picked, op) : drill.kind === 'next' ? op === drill.p.answer : op === drill.p.answer;
        return (
          <Pressable key={`${n}-${op.slice(0, 12)}`} accessibilityRole="button" onPress={() => onPick(ok)} style={{ backgroundColor: b.paper, borderRadius: 14, borderWidth: 1, borderColor: b.line, padding: 12, minHeight: 48, justifyContent: 'center' }}>
            <Text style={{ color: b.ink, fontFamily: fonts.quran, fontSize: 22, lineHeight: 40, textAlign: 'right', writingDirection: 'rtl' }}>{op}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
