import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/ui/Text';
import { BleStatusChip } from '@/components/BleStatusChip';
import { fmt } from '@/components/zikr/parts';
import { useData } from '@/lib/data';
import { haylalaCountable, haylalaWindow } from '@/lib/haylala-window';
import { computeDay, hhmm } from '@/lib/prayer';
import { useSettings } from '@/lib/settings';
import { uid, usePersistentState } from '@/lib/storage';
import { closeSession, type Tasbih } from '@/lib/tasbih-core';
import { advanceGuide, completeUncounted, guideProgress, guideSteps, practiceById, type GuideState } from '@/lib/tijani-guide';
import { practiceDoneKey } from '@/lib/tijani';
import { useFeatureFlags } from '@/lib/use-premium';
import { usePremium } from '@/lib/premium';
import { isPremiumActive } from '@/lib/premium-logic';
import { dayKey } from '@/lib/zikr';
import { Button, Ionicons, Screen } from '@/ui/kit';
import { Arabic, LCard, LMuted, LText } from '@/ui/light';
import { useVisualEffects } from '@/ui/effects';
import { raisedShadow } from '@/ui/glass';
import { brand as b, isGlass } from '@/ui/theme';
import { L, useUiLang } from '@/lib/l10n';

export default function TijaniGuide() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const practice = practiceById(String(id ?? ''));
  const router = useRouter();
  const lang = useUiLang();
  const { s } = useSettings();
  const flags = useFeatureFlags();
  const storePremium = usePremium();
  const guideOn = flags.tijaniGuide || isPremiumActive(storePremium.record);
  const { tasbih, setTasbih, increment, content, ready } = useData();
  const [, setDone] = usePersistentState<Record<string, number[]>>('tijani-done', {});
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const idt = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(idt);
  }, []);
  const prayerDay = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
  const times = useMemo(() => {
    const [y, m, d] = prayerDay.split('-').map(Number);
    return computeDay(new Date(y, m, d, 12, 0, 0), s.place, s.method, s.madhab);
  }, [prayerDay, s.place, s.method, s.madhab]);
  const hay = haylalaWindow(now, times.find((x) => x.key === 'asr')?.time ?? null, times.find((x) => x.key === 'maghrib')?.time ?? null);
  const steps = useMemo(() => (practice ? guideSteps(practice) : []), [practice]);
  const blocked = !practice ? 'missing' : practice.id === 'hailala' && !hay.shown ? 'not-friday' : practice.id === 'hailala' && !haylalaCountable(hay) ? 'outside' : !guideOn ? 'premium' : null;

  if (!practice) {
    return (
      <Screen bg={b.cream}>
        <LText>{L('Cette récitation est introuvable.')}</LText>
        <Button title="Tijaniyya" onPress={() => router.replace('/tijani')} />
      </Screen>
    );
  }

  return (
    <Screen bg={b.cream}>
      <Stack.Screen options={{ title: practice.name }} />
      <View style={{ alignSelf: 'flex-start', backgroundColor: b.goldSoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 }}>
        <Text style={{ color: b.goldDeep, fontWeight: '800', fontSize: 12 }}>{L('à vérifier')}</Text>
      </View>
      <LMuted style={{ marginTop: 8 }}>{L('Texte indicatif, à faire relire. Le compteur, la bague et les groupes restent disponibles sans ce parcours.')}</LMuted>
      {blocked === 'not-friday' ? <LText>{L('La Hailala n’est affichée que le vendredi, à l’heure de cet appareil.')}</LText> : null}
      {blocked === 'outside' && hay.shown ? (
        <LText>
          {hay.phase === 'before-asr' && hay.opensAt
            ? L('La Hailala s’ouvre après l’Asr ({h}).', { h: hhmm(hay.opensAt) })
            : hay.phase === 'after-maghrib'
              ? L('La fenêtre de cet après-midi est terminée.')
              : L('Vendredi, mais les horaires de prière ne permettent pas de confirmer la fenêtre.')}
        </LText>
      ) : null}
      {blocked === 'premium' ? (
        <LCard>
          <LText>{L('La récitation guidée est une fonction Premium. Le texte ci-dessous reste lisible.')}</LText>
        </LCard>
      ) : null}
      {blocked ? (
        <ReadOnly steps={steps} lang={lang} />
      ) : (
        <Counter
          practiceId={practice.id}
          steps={steps}
          lang={lang}
          tasbih={tasbih}
          setTasbih={setTasbih}
          increment={increment}
          ready={ready}
          contentIds={content.map((c) => c.id)}
          onFinished={() => {
            const key = practiceDoneKey(dayKey(now), practice.id);
            setDone((d) => ({ ...d, [key]: steps.map((_, i) => i) }));
          }}
          closesAt={practice.id === 'hailala' && hay.shown ? hay.closesAt : null}
          now={now}
        />
      )}
      {practice.todos?.map((t) => (
        <LMuted key={t} style={{ marginTop: 6 }}>{t}</LMuted>
      ))}
    </Screen>
  );
}

function ReadOnly({ steps, lang }: { steps: ReturnType<typeof guideSteps>; lang: string }) {
  return (
    <View style={{ marginTop: 12, gap: 8 }}>
      {steps.map((s, i) => (
        <LCard key={s.formula + i}>
          <Text style={{ color: b.ink, fontWeight: '800' }}>{`${i + 1}. ${s.label}`}</Text>
          <Arabic size={s.ar.length > 180 ? 20 : 26}>{s.ar}</Arabic>
          <Text style={{ color: b.brownSoft, fontStyle: 'italic' }}>{s.tr}</Text>
          {lang === 'ar' ? null : <LMuted>{lang === 'en' ? s.en : s.fr}</LMuted>}
          <LMuted>{s.uncounted ? L('Sans nombre fixé') : L('Objectif {n}', { n: s.reps })}</LMuted>
          <Text style={{ color: b.goldDeep, fontWeight: '800', fontSize: 12 }}>{L('à vérifier')}</Text>
        </LCard>
      ))}
    </View>
  );
}

function Counter({
  practiceId,
  steps,
  lang,
  tasbih,
  setTasbih,
  increment,
  ready,
  contentIds,
  onFinished,
  closesAt,
  now,
}: {
  practiceId: string;
  steps: ReturnType<typeof guideSteps>;
  lang: string;
  tasbih: Tasbih;
  setTasbih: (f: (t: Tasbih) => Tasbih) => void;
  increment: () => void;
  ready: boolean;
  contentIds: string[];
  onFinished: () => void;
  closesAt: Date | null;
  now: Date;
}) {
  const fx = useVisualEffects();
  const [st, setSt] = useState<GuideState>({ step: 0, count: 0 });
  const [finished, setFinished] = useState(false);
  const stRef = useRef(st);
  const started = useRef(false);
  const finishedRef = useRef(false);
  const lastTotal = useRef(0);
  const prev = useRef({ dhikrId: 'subhanallah', target: 33 });
  const label = (k: number) => 'tijani:' + practiceId + ':' + (steps[k]?.label ?? '');
  const nowIso = () => new Date().toISOString();
  const aim = (t: Tasbih, k: number, count = 0): Tasbih => {
    const it = steps[k];
    if (!it) return { ...t, count: 0, deviceCount: 0, dhikrId: prev.current.dhikrId, target: prev.current.target };
    return {
      ...t,
      count,
      deviceCount: Math.min(t.deviceCount ?? 0, count),
      firstAt: count > 0 ? Date.now() : undefined,
      lastAt: count > 0 ? Date.now() : undefined,
      dhikrId: label(k),
      target: it.uncounted ? 0 : it.reps,
    };
  };

  useEffect(() => {
    if (started.current || !ready || !steps.length) return;
    started.current = true;
    const known = contentIds.includes(tasbih.dhikrId);
    prev.current = known ? { dhikrId: tasbih.dhikrId, target: tasbih.target } : { dhikrId: 'subhanallah', target: 33 };
    lastTotal.current = tasbih.total;
    setTasbih((t) => aim(closeSession(t, uid('s'), nowIso()), 0));
  }, [ready, practiceId]);

  useEffect(
    () => () => {
      if (!started.current || finishedRef.current) return;
      setTasbih((t) => ({ ...closeSession(t, uid('s'), nowIso()), dhikrId: prev.current.dhikrId, target: prev.current.target }));
    },
    [],
  );

  useEffect(() => {
    if (!started.current || finishedRef.current) return;
    const d = tasbih.total - lastTotal.current;
    lastTotal.current = tasbih.total;
    if (d <= 0) return;
    const r = advanceGuide(steps, stRef.current, d);
    stRef.current = r.state;
    setSt(r.state);
    if (r.completed.length) {
      setTasbih((t) => {
        let x = t;
        let dev = t.deviceCount ?? 0;
        const at = nowIso();
        for (const k of r.completed) {
          const reps = steps[k].reps;
          const dk = Math.min(dev, reps);
          dev -= dk;
          x = closeSession({ ...x, count: reps, deviceCount: dk, dhikrId: label(k), target: reps }, uid('s'), at);
        }
        return aim({ ...x, deviceCount: dev }, r.state.step, r.state.count);
      });
    }
    if (r.finished) {
      finishedRef.current = true;
      setFinished(true);
      onFinished();
    }
  }, [tasbih.total]);

  useEffect(() => {
    if (!closesAt || finishedRef.current) return;
    if (now.getTime() < closesAt.getTime()) return;
    const cur = steps[stRef.current.step];
    if (!cur?.uncounted) return;
    const r = completeUncounted(steps, stRef.current);
    stRef.current = r.state;
    setSt(r.state);
    if (r.finished) {
      finishedRef.current = true;
      setFinished(true);
      onFinished();
    }
  }, [closesAt, now]);

  const endStep = () => {
    const r = completeUncounted(steps, stRef.current);
    stRef.current = r.state;
    setSt(r.state);
    setTasbih((t) => aim(closeSession(t, uid('s'), nowIso()), r.state.step));
    if (r.finished) {
      finishedRef.current = true;
      setFinished(true);
      onFinished();
    }
  };

  const cur = steps[Math.min(st.step, steps.length - 1)];
  const g = guideProgress(steps, st.step, st.count);
  const raised = isGlass();

  if (finished) {
    return (
      <LCard style={{ marginTop: 14, alignItems: 'center' }}>
        <Ionicons name="checkmark-circle" size={56} color={b.green} />
        <Text style={{ color: b.ink, fontWeight: '900', fontSize: 20, marginTop: 6 }}>{L('Récitation terminée')}</Text>
        <LMuted>{L('Les étapes sont notées pour aujourd’hui. Le compteur de tasbih garde la séance.')}</LMuted>
      </LCard>
    );
  }

  return (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
        <Text style={{ color: b.green, fontWeight: '900' }}>{L('Étape {a} / {b}', { a: st.step + 1, b: steps.length })}</Text>
        <BleStatusChip showIdle />
      </View>
      <View style={{ marginTop: 8, height: 8, borderRadius: 4, backgroundColor: b.line, overflow: 'hidden' }}>
        <View style={{ width: `${Math.round(g.ratio * 100)}%`, height: '100%', backgroundColor: b.green }} />
      </View>
      <LMuted>{cur.uncounted ? L('{n} dans cette étape, sans total fixé', { n: st.count }) : L('{a} / {b} au total', { a: fmt(g.done), b: fmt(g.total) })}</LMuted>
      <LCard style={{ marginTop: 12 }}>
        <Text style={{ color: b.ink, fontWeight: '800' }}>{cur.label}</Text>
        <Arabic size={cur.ar.length > 180 ? 20 : 26}>{cur.ar}</Arabic>
        <Text style={{ color: b.brownSoft, fontStyle: 'italic' }}>{cur.tr}</Text>
        {lang === 'ar' ? null : <LMuted>{lang === 'en' ? cur.en : cur.fr}</LMuted>}
        <Text style={{ color: b.goldDeep, fontWeight: '800', fontSize: 12, marginTop: 6 }}>{L('à vérifier')}</Text>
      </LCard>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={cur.uncounted ? L('Compter. {n}', { n: st.count }) : L('Compter. {a} sur {b}', { a: st.count, b: cur.reps })}
        onPress={increment}
        style={({ pressed }) => [
          {
            alignSelf: 'center',
            marginTop: 18,
            width: 210,
            height: 210,
            borderRadius: 105,
            backgroundColor: b.green,
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          },
          raised ? raisedShadow(pressed, fx.motion) : { transform: pressed && fx.motion ? [{ scale: 0.97 }] : undefined },
        ]}
      >
        {raised ? <View pointerEvents="none" style={{ position: 'absolute', top: 18, left: 36, right: 36, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.22)' }} /> : null}
        <Text style={{ color: '#fff', fontSize: 52, fontWeight: '900' }}>{st.count}</Text>
        <Text style={{ color: 'rgba(255,255,255,0.9)', fontWeight: '800' }}>{cur.uncounted ? L('Sans nombre fixé') : `/ ${fmt(cur.reps)}`}</Text>
      </Pressable>
      <LMuted style={{ textAlign: 'center', marginTop: 8 }}>{L('Touchez le cercle ou utilisez votre compteur Bluetooth. La bague compte dans la même séance.')}</LMuted>
      {cur.uncounted ? <Button title="Terminer cette étape" onPress={endStep} /> : null}
    </>
  );
}
