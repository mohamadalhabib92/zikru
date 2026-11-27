import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { QBtn, QChoice } from '@/components/quran/Sheet';
import { useSurahUthmani } from '@/components/quran/data';
import { useReaderKeepAwake } from '@/components/quran/keep-awake';
import { readerPalette, type Pal } from '@/components/quran/palette';
import { WritePad, useInk } from '@/components/quran/WritePad';
import { L } from '@/lib/l10n';
import { nktubAvailable } from '@/lib/mac';
import { gIndex } from '@/lib/quran-nav';
import { gradeVerses, readerPrefs, startHifz } from '@/lib/quran-store';
import { useShared } from '@/lib/shared-state';
import type { Grade } from '@/lib/srs';
import { SURAHS } from '@/lib/surahs';
import { arLang } from '@/ui/ar-lang';
import { Button } from '@/ui/kit';
import { TVPressable as Pressable } from '@/ui/tv-pressable';
import { Text } from '@/ui/Text';
import { fontsAreReady } from '@/ui/fonts-ready';
import { alpha, fonts } from '@/ui/theme';

/** Premier mot, tel quel : seuls les blancs de tête sont écartés. */
function firstWord(verse: string): string {
  const t = verse.trimStart();
  const cut = t.search(/\s/);
  return cut < 0 ? t : t.slice(0, cut);
}

const GRADES: { g: Grade; label: string; sub: string; color: string }[] = [
  { g: 'hard', label: 'Difficile', sub: 'demain', color: '#C24D5C' },
  { g: 'medium', label: 'Moyen', sub: 'bientôt', color: '#D98A2B' },
  { g: 'easy', label: 'Facile', sub: 'plus tard', color: '#23946B' },
];

/**
 * Nktub (نكتب). Écrire de mémoire sur iPad, puis comparer au texte uthmani et se noter.
 * Gratuit, comme le reste de la mémorisation. Les notes passent par gradeVerses.
 * Hors iPad, la route revient en arrière.
 */
export default function HifzNktubRoute() {
  const router = useRouter();
  const p = useLocalSearchParams<{ s?: string; from?: string; to?: string }>();
  const ok = nktubAvailable();
  useEffect(() => {
    if (ok) return;
    if (router.canGoBack()) router.back();
    else router.replace('/quran/hifz');
  }, [ok, router]);
  if (!ok) return <View style={{ flex: 1 }} />;
  const key = `${p.s ?? ''}|${p.from ?? ''}|${p.to ?? ''}`;
  return <HifzNktub key={key} />;
}

function HifzNktub() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height: winH } = useWindowDimensions();
  const p = useLocalSearchParams<{ s?: string; from?: string; to?: string }>();
  const surah = Math.min(114, Math.max(1, +(p.s ?? 1) || 1));
  const meta = SURAHS[surah - 1];
  const from = Math.min(meta[4], Math.max(1, +(p.from ?? 1) || 1));
  const to = Math.min(meta[4], Math.max(from, +(p.to ?? from) || from));
  const ayahs = useMemo(() => {
    const out: number[] = [];
    for (let a = from; a <= to; a++) out.push(a);
    return out;
  }, [from, to]);
  const lines = useSurahUthmani(surah);
  const [rp] = useShared(readerPrefs);
  const pal = readerPalette(rp.theme);
  useReaderKeepAwake(rp.keepAwake, 'hifz-nktub');
  const [mode, setMode] = useState<'verse' | 'range'>('verse');
  const [hint, setHint] = useState(false);
  const [step, setStep] = useState(0);
  const [checked, setChecked] = useState(false);
  const [done, setDone] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
  const ink = useInk();
  const grading = useRef(false);
  const verseMode = mode === 'verse';
  const current = ayahs[Math.min(step, Math.max(0, ayahs.length - 1))] ?? from;
  const shown = verseMode ? [current] : ayahs;
  const chooseMode = (next: 'verse' | 'range') => {
    if (next === mode) return;
    setMode(next);
    setStep(0);
    setChecked(false);
    setDone(false);
    grading.current = false;
    ink.reset();
  };

  const grade = (g: Grade) => {
    if (grading.current) return;
    grading.current = true;
    const keys = shown.map((a) => gIndex(surah, a));
    const lo = keys[0];
    const hi = keys[keys.length - 1] + 1;
    startHifz(lo, hi);
    gradeVerses(keys, g);
    if (!verseMode || step + 1 >= ayahs.length) {
      setDone(true);
      return;
    }
    setStep((n) => n + 1);
    setChecked(false);
    ink.reset();
    grading.current = false;
  };

  const paper = pal.dark ? '#141C18' : '#FBF6EA';
  const rule = pal.dark ? 'rgba(230,225,211,0.2)' : 'rgba(70,100,150,0.28)';
  const margin = pal.dark ? 'rgba(217,120,120,0.7)' : 'rgba(176,72,82,0.55)';
  const inkColor = pal.dark ? '#F3EDE0' : '#1A2744';
  const quran = {
    color: pal.ink,
    fontFamily: fontsAreReady() ? fonts.quran : undefined,
    fontSize: 28,
    lineHeight: 52,
    textAlign: 'right' as const,
    writingDirection: 'rtl' as const,
  };
  const paperH = verseMode ? Math.max(420, Math.round(winH * 0.62)) : Math.max(560, ayahs.length * 56);
  const side = checked && width >= 740;

  if (!ayahs.length) {
    return (
      <View style={{ flex: 1, backgroundColor: pal.bg, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 }}>
        <Text style={{ color: pal.ink, fontSize: 18, textAlign: 'center' }}>{L('Rien à écrire dans cette plage.')}</Text>
        <Button title={L('Mémorisation')} onPress={() => router.back()} />
      </View>
    );
  }

  if (done) {
    return (
      <View style={{ flex: 1, backgroundColor: pal.bg, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 14 }}>
        <Stack.Screen options={{ title: L('Nktub'), headerStyle: { backgroundColor: pal.bg }, headerTintColor: pal.ink, headerTitleStyle: { color: pal.ink } }} />
        <Text {...arLang} style={{ color: pal.accent, fontFamily: fontsAreReady() ? fonts.quran : undefined, fontSize: 28, lineHeight: 48 }}>نكتب</Text>
        <Text style={{ color: pal.ink, fontSize: 22, fontWeight: '900', textAlign: 'center' }}>{L('C’est noté. Les cartes de mémorisation sont à jour.')}</Text>
        <Text style={{ color: pal.muted }}>{L('à vérifier')}</Text>
        <Button title={L('Mémorisation')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/quran/hifz'))} />
      </View>
    );
  }

  const reveal = (
    <View style={{ flex: 1, minWidth: side ? 300 : undefined, gap: 10 }}>
      <Text style={{ color: pal.ink, fontWeight: '900', fontSize: 16 }}>{L('Texte uthmani')}</Text>
      <Text style={{ color: pal.muted, fontSize: 13 }}>{L('Comparez votre écriture avec le texte. Vous notez vous-même.')}</Text>
      <Text style={{ color: pal.muted, fontSize: 12 }}>{L('à vérifier')}</Text>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 16, paddingBottom: 8 }}>
        {shown.map((a) => (
          <View key={a} style={{ gap: 4 }}>
            <Text style={{ color: pal.muted, fontWeight: '800' }}>{`${surah}:${a}`}</Text>
            <Text {...arLang} style={quran}>{lines?.[a - 1] ?? ''}</Text>
          </View>
        ))}
      </ScrollView>
      <GradeRow pal={pal} onGrade={grade} />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: pal.bg }}>
      <Stack.Screen options={{ title: L('Nktub'), headerStyle: { backgroundColor: pal.bg }, headerTintColor: pal.ink, headerTitleStyle: { color: pal.ink } }} />
      <View style={{ paddingHorizontal: 16, paddingTop: 8, gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: pal.ink, fontWeight: '900', fontSize: 18 }}>{meta[2]}</Text>
            <Text style={{ color: pal.muted, fontSize: 13 }}>
              {verseMode ? L('Verset {i} sur {n}', { i: step + 1, n: ayahs.length }) : L('{n} versets', { n: ayahs.length })}
            </Text>
          </View>
          <Text {...arLang} style={{ color: pal.accent, fontFamily: fontsAreReady() ? fonts.quran : undefined, fontSize: 22, lineHeight: 40 }}>{meta[1]}</Text>
        </View>
        <Text style={{ color: pal.muted, fontSize: 13 }}>{L('Écrire les versets de mémoire, au crayon ou au doigt.')}</Text>
        <Text style={{ color: pal.muted, fontSize: 12 }}>{L('Écriture libre, sans reconnaissance de l’écriture.')}</Text>
        <QChoice
          pal={pal}
          value={mode}
          onChange={chooseMode}
          options={[
            { label: L('Verset par verset'), value: 'verse', a11y: 'Verset par verset' },
            { label: L('Toute la plage'), value: 'range', a11y: 'Toute la plage' },
          ]}
        />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <QBtn icon={hint ? 'eye' : 'eye-off-outline'} label={hint ? L('Masquer l’indice') : L('Afficher l’indice')} a11y={hint ? 'Masquer l’indice' : 'Afficher l’indice'} active={hint} onPress={() => setHint((v) => !v)} pal={pal} />
          {checked ? null : (
            <>
              <QBtn icon="pencil" label={L('Crayon')} a11y="Crayon" active={tool === 'pen'} onPress={() => setTool('pen')} pal={pal} />
              <QBtn icon="backspace-outline" label={L('Gomme')} a11y="Gomme" active={tool === 'eraser'} onPress={() => setTool('eraser')} pal={pal} />
              <QBtn icon="arrow-undo-outline" a11y="Annuler le trait" onPress={ink.undo} pal={pal} disabled={!ink.canUndo} />
              <QBtn icon="trash-outline" a11y="Effacer la page" onPress={ink.clearPage} pal={pal} disabled={!ink.strokes.length} />
            </>
          )}
        </View>
        {hint && !checked && lines ? (
          <ScrollView style={{ maxHeight: 132 }} contentContainerStyle={{ gap: 2 }}>
            {shown.map((a) => (
              <View key={a} style={{ flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 10 }}>
                <Text style={{ color: pal.muted, fontWeight: '800' }}>{`${surah}:${a}`}</Text>
                <Text {...arLang} style={{ ...quran, fontSize: 22, lineHeight: 40 }}>{firstWord(lines[a - 1] ?? '')}</Text>
              </View>
            ))}
          </ScrollView>
        ) : null}
      </View>
      <View style={{ flex: 1, flexDirection: side ? 'row' : 'column', padding: 12, gap: 12 }}>
        <ScrollView style={{ flex: 1 }} scrollEnabled={!drawing} contentContainerStyle={{ flexGrow: 1 }}>
          <WritePad
            key={`${mode}:${step}:${surah}:${from}:${to}`}
            height={paperH}
            strokes={ink.strokes}
            eraser={tool === 'eraser'}
            enabled={!checked}
            ink={inkColor}
            rule={rule}
            margin={margin}
            paper={paper}
            label={L('Écrire ici')}
            onPenStart={ink.penStart}
            onPenMove={ink.penMove}
            onErase={ink.erase}
            onEraseEnd={ink.eraseEnd}
            onActive={setDrawing}
          />
        </ScrollView>
        {checked ? reveal : null}
      </View>
      {checked ? null : (
        <View style={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: Math.max(insets.bottom, 12) }}>
          <Button title={L('Vérifier')} icon="checkmark-circle-outline" disabled={!lines} onPress={() => setChecked(true)} />
        </View>
      )}
      {checked ? <View style={{ height: Math.max(insets.bottom, 8) }} /> : null}
    </View>
  );
}

function GradeRow({ pal, onGrade }: { pal: Pal; onGrade: (g: Grade) => void }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {GRADES.map((x) => (
        <Pressable
          key={x.g}
          accessibilityRole="button"
          accessibilityLabel={L('{x} : prochaine révision {s}', { x: L(x.label), s: L(x.sub) })}
          onPress={() => onGrade(x.g)}
          style={({ pressed }) => ({ flex: 1, minHeight: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: alpha(x.color, pressed ? 0.3 : 0.15), borderWidth: 1, borderColor: alpha(x.color, 0.5) })}
        >
          <Text style={{ color: pal.dark ? '#fff' : x.color, fontWeight: '900' }}>{L(x.label)}</Text>
          <Text style={{ color: pal.muted, fontSize: 11 }}>{L(x.sub)}</Text>
        </Pressable>
      ))}
    </View>
  );
}
