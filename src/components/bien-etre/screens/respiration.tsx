import { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Text } from '@/ui/Text';
import { announce, BEScreen, Choice, mmss, Panel, softHaptic, useClock, useReduceMotion } from '@/components/bien-etre/common';
import { useReaderKeepAwake } from '@/components/quran/keep-awake';
import { breathAt, DEFAULT_MINUTES, EMPTY_LOG, LEVELS, logSession, pairedFor, PATTERNS, phaseChanges, sessionMs, suggestedMinutes, type BreathLog, type BreathPairing, type Phase, type PatternId } from '@/lib/breath';
import { NAMES, NAMES_REF } from '@/lib/names';
import { usePersistentState } from '@/lib/storage';
import { arLang } from '@/ui/ar-lang';
import { ProgressBar } from '@/ui/ds';
import { Button, Toggle } from '@/ui/kit';
import { Arabic } from '@/ui/light';
import { alpha, brand as b } from '@/ui/theme';
import { L } from '@/lib/l10n';

type Prefs = { pattern: PatternId; minutes: number | null; dhikr: boolean; pair: BreathPairing };
const PREFS: Prefs = { pattern: 'coherence', minutes: null, dhikr: false, pair: { out: 'name:1' } };
const PHASE_LABEL: Record<Phase, string> = { in: 'Inspirez', holdIn: 'Retenez', out: 'Expirez', holdOut: 'Pause' };
const nameOf = (key?: string) => (key?.startsWith('name:') ? NAMES[Number(key.slice(5)) - 1] : undefined);

/** Respiration guidée : cohérence (6 respirations/min) ou carrée, dhikr facultatif calé sur le souffle. */
export default function Respiration() {
  const [prefs, setPrefs] = usePersistentState<Prefs>('be-breath', PREFS);
  const [log, setLog] = usePersistentState<BreathLog>('be-breath-log', EMPTY_LOG);
  const reduce = useReduceMotion();
  const [state, setState] = useState<'idle' | 'run' | 'pause' | 'done'>('idle');
  const p = PATTERNS[prefs.pattern] ?? PATTERNS.coherence;
  const minutes = prefs.minutes ?? suggestedMinutes(log);
  const total = sessionMs(p, minutes);
  const pair = prefs.dhikr ? prefs.pair : null;
  const lastPhase = useRef<Phase>('in');
  const { t, reset } = useClock(state === 'run', (prev, now) => {
    for (const ph of phaseChanges(p, prev, now, total)) {
      lastPhase.current = ph;
      softHaptic(ph === 'in' ? 'medium' : 'light');
      const n = nameOf(pairedFor(pair, ph));
      announce(L(PHASE_LABEL[ph]) + (n ? ', ' + n.tr : ''));
    }
    if (prev < total && now >= total) {
      setState('done');
      setLog((l) => logSession(l, minutes));
      softHaptic('success');
      announce(L('Séance terminée'));
    }
  });
  const st = breathAt(p, t, total);
  useReaderKeepAwake(state === 'run', 'zikru-breath');

  const start = () => {
    reset();
    lastPhase.current = 'in';
    setState('run');
    softHaptic('medium');
    const n = nameOf(pairedFor(pair, 'in'));
    announce(L(PHASE_LABEL.in) + (n ? ', ' + n.tr : ''));
  };
  const onCircle = () => {
    if (state === 'idle' || state === 'done') start();
    else if (state === 'run') setState('pause');
    else setState('run');
  };
  const name = state === 'run' || state === 'pause' ? nameOf(pairedFor(pair, st.phase)) : undefined;
  const scale = reduce ? 1 : 0.62 + 0.38 * (state === 'idle' || state === 'done' ? 0.4 : st.level);
  const color = st.phase === 'in' || st.phase === 'holdIn' ? b.teal : b.indigo;
  const center =
    state === 'idle' ? L('Touchez pour commencer') : state === 'done' ? L('Séance terminée') : state === 'pause' ? L('En pause') : L(PHASE_LABEL[st.phase]);
  const nameOpts = useMemo(() => [{ label: 'Aucun', value: '' }, ...NAMES.map((x) => ({ label: x.tr, value: `name:${x.n}` }))], []);
  const setPair = (k: 'in' | 'out', v: string) => setPrefs((x) => ({ ...x, pair: { ...x.pair, [k]: v || undefined } }));

  return (
    <BEScreen title="Respirer" sub="Un geste pour commencer : touchez le cercle. Suivez-le des yeux, ou fermez-les et laissez-vous guider par les vibrations.">
      <View style={{ alignItems: 'center', paddingVertical: 8 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={state === 'run' ? L('Mettre en pause') : state === 'pause' ? L('Reprendre') : L('Commencer la séance de {n} min', { n: minutes })}
          accessibilityHint={L('Touchez le cercle pour commencer ou mettre en pause')}
          onPress={onCircle}
          style={{ width: 280, height: 280, alignItems: 'center', justifyContent: 'center' }}
        >
          <View style={{ position: 'absolute', width: 280, height: 280, borderRadius: 140, borderWidth: 2, borderColor: alpha(color, 0.25) }} />
          <View style={{ position: 'absolute', width: 280, height: 280, borderRadius: 140, backgroundColor: alpha(color, 0.16), transform: [{ scale }] }} />
          <View style={{ position: 'absolute', width: 280 * 0.62, height: 280 * 0.62, borderRadius: 140, backgroundColor: alpha(color, 0.22), transform: [{ scale }] }} />
          <Text maxFontSizeMultiplier={1.4} style={{ color: b.ink, fontSize: state === 'idle' ? 18 : 24, fontWeight: '900', textAlign: 'center', paddingHorizontal: 40 }}>{center}</Text>
          {name ? (
            <View style={{ alignItems: 'center', marginTop: 4 }}>
              <Arabic size={30} style={{ textAlign: 'center', lineHeight: 52 }}>
                <Text {...arLang}>{name.ar}</Text>
              </Arabic>
              <Text style={{ color: b.inkMuted, fontWeight: '700' }}>{name.tr}</Text>
            </View>
          ) : null}
          {state === 'run' || state === 'pause' ? <Text style={{ color: b.inkMuted, fontSize: 28, fontWeight: '300', marginTop: 4 }}>{st.secondsLeft}</Text> : null}
        </Pressable>
        {reduce && (state === 'run' || state === 'pause') ? (
          <View style={{ width: 240, marginTop: 8 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <ProgressBar progress={st.level} color={color} height={10} />
          </View>
        ) : null}
        {state === 'run' || state === 'pause' ? (
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 12, alignItems: 'center' }}>
            <Text style={{ color: b.inkMuted, fontVariant: ['tabular-nums'] }}>{L('Reste {t}', { t: mmss(st.remainingMs) })}</Text>
            <Button small variant="ghost" title="Terminer" onPress={() => setState('idle')} />
          </View>
        ) : null}
      </View>

      {state === 'done' ? (
        <Panel tint={b.teal}>
          <Text style={{ color: b.ink, fontWeight: '900', fontSize: 16 }}>{L('{n} min de respiration', { n: minutes })}</Text>
          <Text style={{ color: b.inkMuted }}>{L('Votre progression (privée) : {s} séance(s), {m} min au total.', { s: log.sessions, m: log.minutes })}</Text>
          {prefs.minutes == null && suggestedMinutes(log) > minutes ? <Text style={{ color: b.ink }}>{L('Prochaine séance proposée : {n} min.', { n: suggestedMinutes(log) })}</Text> : null}
        </Panel>
      ) : null}

      {state === 'idle' || state === 'done' ? (
        <>
          <Panel>
            <Text style={{ color: b.ink, fontWeight: '800' }}>Rythme</Text>
            <Choice
              label="Rythme"
              value={prefs.pattern}
              onChange={(v) => setPrefs((x) => ({ ...x, pattern: v }))}
              options={[
                { label: 'Cohérence', sub: '6 respirations/min · 5 s / 5 s', value: 'coherence' as const },
                { label: 'Carrée', sub: '4 s · 4 s · 4 s · 4 s', value: 'box' as const },
              ]}
            />
            <Text style={{ color: b.ink, fontWeight: '800', marginTop: 4 }}>Durée</Text>
            <Choice
              label="Durée"
              value={prefs.minutes ?? 0}
              onChange={(v) => setPrefs((x) => ({ ...x, minutes: v === 0 ? null : v }))}
              options={[{ label: L('Auto · {n} min', { n: suggestedMinutes(log) }), value: 0 }, ...LEVELS.map((m) => ({ label: L('{n} min', { n: m }), value: m as number }))]}
            />
            <Text style={{ color: b.inkMuted, fontSize: 12 }}>{L('« Auto » commence à {n} min et propose le palier suivant après trois séances.', { n: DEFAULT_MINUTES })}</Text>
          </Panel>
          <Panel>
            <Toggle label="Dhikr au souffle" hint="Un Nom d’Allah affiché et annoncé à l’inspiration et/ou à l’expiration." value={prefs.dhikr} onChange={(v) => setPrefs((x) => ({ ...x, dhikr: v }))} />
            {prefs.dhikr ? (
              <>
                {(['in', 'out'] as const).map((k) => (
                  <View key={k} style={{ gap: 6 }}>
                    <Text style={{ color: b.ink, fontWeight: '800' }}>{k === 'in' ? 'À l’inspiration' : 'À l’expiration'}</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                      <Choice label={k === 'in' ? 'À l’inspiration' : 'À l’expiration'} value={prefs.pair[k] ?? ''} onChange={(v) => setPair(k, v)} options={nameOpts.slice(0, 1)} />
                      {nameOpts.slice(1).map((o) => (
                        <Choice key={o.value} value={prefs.pair[k] ?? ''} onChange={(v) => setPair(k, v)} options={[o]} />
                      ))}
                    </ScrollView>
                  </View>
                ))}
                <Text style={{ color: b.inkMuted, fontSize: 12 }}>{NAMES_REF}</Text>
              </>
            ) : null}
          </Panel>
        </>
      ) : null}
      <Text style={{ color: b.inkMuted, fontSize: 12, lineHeight: 18 }}>Exercice de détente, sans visée médicale. Arrêtez si vous ressentez un inconfort.</Text>
    </BEScreen>
  );
}
