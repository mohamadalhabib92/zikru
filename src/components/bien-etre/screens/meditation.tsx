import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/ui/Text';
import { announce, BEScreen, Choice, mmss, Panel, softHaptic, useClock, useUthmani } from '@/components/bien-etre/common';
import { useReaderKeepAwake } from '@/components/quran/keep-awake';
import { clampMinutes, DURATIONS, meditationAt, STEPS, THEMES, themeRefs, type MeditationKind, type ThemeId } from '@/lib/meditation';
import { gIndex } from '@/lib/quran-nav';
import { usePersistentState } from '@/lib/storage';
import { SURAHS } from '@/lib/surahs';
import { arLang } from '@/ui/ar-lang';
import { FadeIn, ProgressRing } from '@/ui/ds';
import { Button } from '@/ui/kit';
import { Arabic } from '@/ui/light';
import { brand as b } from '@/ui/theme';
import { L } from '@/lib/l10n';

type Prefs = { kind: MeditationKind; theme: ThemeId; minutes: number };
const PREFS: Prefs = { kind: 'tafakkur', theme: 'creation', minutes: 5 };

/** Tafakkur (contemplation d’un verset) et murāqaba (présence) : minuteur doux, consignes en fondu, texte Tanzil. */
export default function Meditation() {
  const router = useRouter();
  const [prefs, setPrefs] = usePersistentState<Prefs>('be-meditation', PREFS);
  const [done, setDone] = usePersistentState<number>('be-meditation-count', 0);
  const [state, setState] = useState<'idle' | 'run' | 'pause' | 'done'>('idle');
  const uth = useUthmani();
  const theme = THEMES.find((x) => x.id === prefs.theme && x.kind === prefs.kind) ?? THEMES.find((x) => x.kind === prefs.kind)!;
  const refs = themeRefs(theme);
  const minutes = clampMinutes(prefs.minutes);
  const { t, reset } = useClock(state === 'run', (prev, now) => {
    const a = meditationAt(prefs.kind, refs.length, minutes, prev);
    const z = meditationAt(prefs.kind, refs.length, minutes, now);
    if (z.done && !a.done) {
      setState('done');
      setDone((n) => n + 1);
      softHaptic('success');
      announce(L('Séance terminée'));
    } else if (z.step !== a.step) {
      softHaptic('light');
      announce(L(STEPS[prefs.kind][z.step]));
    }
  });
  const st = meditationAt(prefs.kind, refs.length, minutes, t);
  useReaderKeepAwake(state === 'run', 'zikru-meditation');

  const start = () => {
    reset();
    setState('run');
    softHaptic('medium');
    announce(L(STEPS[prefs.kind][0]));
  };
  const [s, a] = refs[st.verse] ?? refs[0];
  const verse = uth ? uth[gIndex(s, a)] : null;
  const refLabel = L('{s}, verset {a}', { s: SURAHS[s - 1][2], a });
  const running = state === 'run' || state === 'pause';

  return (
    <BEScreen title="Tafakkur & murāqaba" sub="Choisissez un thème et une durée, puis commencez. Les consignes s’effacent d’elles-mêmes ; il ne reste que le verset.">
      {!running ? (
        <Panel>
          <Choice
            label="Pratique"
            value={prefs.kind}
            onChange={(k) => setPrefs((x) => ({ ...x, kind: k, theme: THEMES.find((th) => th.kind === k)!.id }))}
            options={[
              { label: 'Tafakkur', sub: 'Contempler la création', value: 'tafakkur' as const },
              { label: 'Murāqaba', sub: 'Présence attentive', value: 'muraqaba' as const },
            ]}
          />
          {prefs.kind === 'tafakkur' ? (
            <Choice label="Thème" value={theme.id} onChange={(id) => setPrefs((x) => ({ ...x, theme: id }))} options={THEMES.filter((x) => x.kind === 'tafakkur').map((x) => ({ label: x.title, value: x.id }))} color={b.indigo} />
          ) : null}
          <Choice label="Durée" value={minutes} onChange={(m) => setPrefs((x) => ({ ...x, minutes: m }))} options={DURATIONS.map((m) => ({ label: L('{n} min', { n: m }), value: m as number }))} color={b.indigo} />
          <Button title={L('Commencer · {n} min', { n: minutes })} icon="play" onPress={start} />
        </Panel>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={running ? (state === 'run' ? L('Mettre en pause') : L('Reprendre')) : L('Commencer')}
        onPress={() => (state === 'run' ? setState('pause') : state === 'pause' ? setState('run') : start())}
        style={{ backgroundColor: b.paper, borderRadius: 24, borderWidth: 1, borderColor: b.line, padding: 20, gap: 14, alignItems: 'center' }}
      >
        {running ? (
          <ProgressRing size={84} stroke={4} progress={st.progress} color={b.indigo}>
            <Text style={{ color: b.inkMuted, fontVariant: ['tabular-nums'], fontWeight: '700' }}>{mmss(st.remainingMs)}</Text>
          </ProgressRing>
        ) : null}
        {running ? (
          <FadeIn key={st.step}>
            <Text style={{ color: b.ink, fontSize: 17, fontWeight: '700', textAlign: 'center', lineHeight: 24 }}>{L(STEPS[prefs.kind][st.step])}</Text>
          </FadeIn>
        ) : state === 'done' ? (
          <Text style={{ color: b.ink, fontSize: 17, fontWeight: '800', textAlign: 'center' }}>{L('Séance terminée · {n} au total (privé)', { n: done })}</Text>
        ) : null}
        <FadeIn key={`${s}:${a}`} style={{ alignSelf: 'stretch' }}>
          {verse ? (
            <Arabic quran size={26} style={{ textAlign: 'center' }}>
              <Text {...arLang}>{verse}</Text>
            </Arabic>
          ) : (
            <Text style={{ color: b.inkMuted, textAlign: 'center' }}>Chargement</Text>
          )}
        </FadeIn>
        <Text style={{ color: b.inkMuted, fontSize: 12 }}>{refLabel + ' · ' + L('texte Tanzil (uthmani)')}</Text>
      </Pressable>

      {running ? (
        <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'center' }}>
          <Button variant="secondary" title={state === 'run' ? 'Pause' : 'Reprendre'} icon={state === 'run' ? 'pause' : 'play'} onPress={() => setState(state === 'run' ? 'pause' : 'run')} />
          <Button variant="ghost" title="Terminer" onPress={() => setState('idle')} />
        </View>
      ) : (
        <Button variant="ghost" icon="book-outline" title="Ouvrir dans le lecteur" onPress={() => router.push({ pathname: '/quran/[n]', params: { n: String(s), a: String(a) } })} />
      )}
      <Text style={{ color: b.inkMuted, fontSize: 12, lineHeight: 18 }}>Versets cités d’après le texte Tanzil embarqué. Consignes pratiques Zikru, à relire.</Text>
    </BEScreen>
  );
}
