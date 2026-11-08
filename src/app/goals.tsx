import { useRouter, type Href } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/ui/Text';
import { PatternBg } from '@/components/zikru/Pattern';
import { adhkarDays } from '@/lib/adhkar-store';
import { useDispense } from '@/lib/dispense-context';
import { allMet, dayValues, enabledGoals, gentleStreak, GOAL_KEYS, GRACE_PER_WEEK, met, newMilestones, TARGET_OPTIONS, WIRD_MILESTONE_DAYS, weekRecap, type GoalKey, type GoalSources } from '@/lib/goals';
import { goalPrefs, milestones } from '@/lib/goals-store';
import { dayKey, useGrowth } from '@/lib/growth';
import { L } from '@/lib/l10n';
import { khatma, pagesDay } from '@/lib/quran-store';
import { useShared } from '@/lib/shared-state';
import { usePersistentState } from '@/lib/storage';
import { PRACTICES } from '@/lib/tijani';
import { Ionicons, Screen, Segmented, Toggle, type IconName } from '@/ui/kit';
import { LCard, LMuted, LText, LTitle, SectionLabel } from '@/ui/light';
import { alpha, brand as b } from '@/ui/theme';

const META: Record<GoalKey, { title: string; unit: string; icon: IconName; href: Href; open: string; color: string }> = {
  prayers: { title: 'Prières', unit: 'prières cochées', icon: 'moon', href: '/prayers', open: 'Cocher mes prières', color: b.green },
  wird: { title: 'Wird', unit: 'wird ou adhkar terminés', icon: 'leaf', href: '/tijani', open: 'Ouvrir mon wird', color: b.wirdGreen },
  quran: { title: 'Pages de Coran', unit: 'pages terminées', icon: 'book', href: '/quran', open: 'Lire le Coran', color: b.teal },
  tasbih: { title: 'Tasbih', unit: 'comptes', icon: 'radio-button-on', href: '/tasbih', open: 'Ouvrir le tasbih', color: b.goldDeep },
};
const fmtDay = (k: string) => new Date(k + 'T12:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });

/** Objectifs du jour : privés, sans classement ni comparaison ; série douce (2 jours de grâce par semaine, dispense neutre). */
export default function Goals() {
  const router = useRouter();
  const g = useGrowth();
  const dispense = useDispense();
  const [prefs, setPrefs] = useShared(goalPrefs);
  const [pages] = useShared(pagesDay);
  const [adh] = useShared(adhkarDays);
  const [kh] = useShared(khatma);
  const [ms, setMs, msReady] = useShared(milestones);
  const [tijani] = usePersistentState<Record<string, number[]>>('tijani-done', {});
  const today = dayKey();
  const src: GoalSources = useMemo(
    () => ({ prayed: g.prayed, clicks: g.days, pages, tijani, adhkar: adh, practices: PRACTICES.map((p) => ({ id: p.id, steps: p.steps.length })) }),
    [g.prayed, g.days, pages, tijani, adh],
  );
  const values = (k: string) => dayValues(src, k);
  const v = values(today);
  const en = enabledGoals(prefs);
  const overall = gentleStreak((k) => allMet(values(k), prefs), new Date(), dispense.neutral);
  const wird = gentleStreak((k) => met('wird', values(k), prefs), new Date(), dispense.neutral);
  const recap = weekRecap(values, prefs, new Date(), dispense.neutral);
  const last = new Date();
  last.setDate(last.getDate() - 7);
  const recapPrev = weekRecap(values, prefs, last, dispense.neutral);

  useEffect(() => {
    if (!msReady) return;
    const add = newMilestones(ms, { khatma: kh, wird });
    if (add.length) setMs((x) => [...x, ...add]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msReady, kh?.finished, wird.days, wird.since]);

  const patch = (k: GoalKey, p: { on?: boolean; target?: number }) =>
    setPrefs((x) => ({ on: { ...x.on, [k]: p.on ?? x.on[k] }, target: { ...x.target, [k]: p.target ?? x.target[k] } }));

  return (
    <Screen padded={false} bg={b.cream}>
      <PatternBg color={b.green} style={{ padding: 20 }}>
        <Text style={{ color: '#fff', fontSize: 24, fontWeight: '900' }}>Objectifs du jour</Text>
        <Text style={{ color: 'rgba(255,255,255,0.92)', marginTop: 4 }}>Privés, sur cet appareil · aucune comparaison, aucun classement</Text>
      </PatternBg>
      <View style={{ padding: 16 }}>
        {dispense.neutral(today) ? (
          <LCard style={{ backgroundColor: alpha(b.teal, 0.08) }}>
            <LText>Jour en dispense : il est neutre, votre série reste intacte.</LText>
          </LCard>
        ) : null}

        <SectionLabel>Aujourd’hui</SectionLabel>
        {en.length === 0 ? (
          <LCard>
            <LMuted>Aucun objectif actif. Choisissez-en un ci-dessous, ou aucun : c’est tout à fait possible.</LMuted>
          </LCard>
        ) : null}
        {en.map((k) => {
          const m = META[k];
          const target = prefs.target[k];
          const ratio = Math.min(1, v[k] / target);
          const ok = v[k] >= target;
          return (
            <LCard key={k}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Ionicons name={ok ? 'checkmark-circle' : m.icon} size={24} color={m.color} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: b.ink, fontWeight: '900', fontSize: 16 }}>{L(m.title)}</Text>
                  <LMuted>
                    {Math.min(v[k], 99999)} / {target} · {L(m.unit)}
                  </LMuted>
                </View>
              </View>
              <View
                accessible
                accessibilityRole="progressbar"
                accessibilityLabel={L(m.title)}
                accessibilityValue={{ min: 0, max: target, now: Math.min(v[k], target) }}
                style={{ height: 8, borderRadius: 4, backgroundColor: b.line, marginTop: 10, overflow: 'hidden' }}
              >
                <View style={{ width: `${Math.round(ratio * 100)}%`, height: 8, backgroundColor: m.color }} />
              </View>
              <Pressable
                onPress={() => router.push(k === 'wird' && !v.wird ? ('/adhkar' as Href) : m.href)}
                accessibilityRole="button"
                accessibilityLabel={L(m.open)}
                style={{ minHeight: 44, justifyContent: 'center', marginTop: 6 }}
              >
                <Text style={{ color: b.teal, fontWeight: '800' }}>{L(m.open)} →</Text>
              </Pressable>
            </LCard>
          );
        })}

        <SectionLabel>Série douce</SectionLabel>
        <LCard>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {[
              { l: 'Jours complets', val: `${overall.days} j`, i: 'leaf' as IconName },
              { l: 'Grâce restante (semaine)', val: `${overall.graceLeft}/${GRACE_PER_WEEK}`, i: 'heart' as IconName },
            ].map((x) => (
              <View key={x.l} style={{ flex: 1, backgroundColor: b.paper, borderRadius: 16, borderWidth: 1, borderColor: b.line, padding: 12, alignItems: 'center' }}>
                <Ionicons name={x.i} size={20} color={b.green} />
                <Text style={{ color: b.ink, fontWeight: '900', fontSize: 20, marginTop: 4 }}>{x.val}</Text>
                <LMuted style={{ fontSize: 12, textAlign: 'center' }}>{L(x.l)}</LMuted>
              </View>
            ))}
          </View>
          <LMuted style={{ marginTop: 10 }}>
            Deux jours manqués par semaine ne cassent rien ; un jour en dispense est toujours neutre. La journée en cours ne compte qu’une fois accomplie.
          </LMuted>
        </LCard>

        <SectionLabel>Bilan privé de la semaine</SectionLabel>
        {[
          { t: 'Cette semaine', r: recap },
          { t: 'Semaine dernière', r: recapPrev },
        ].map(({ t, r }) => (
          <LCard key={t}>
            <LTitle>{L(t)}</LTitle>
            <LMuted style={{ marginBottom: 6 }}>
              {fmtDay(r.from)} → {fmtDay(r.to)}
              {r.neutral ? ` · ${L('{n} j en dispense (exclus)', { n: r.neutral })}` : ''}
            </LMuted>
            {GOAL_KEYS.filter((k) => prefs.on[k]).map((k) => (
              <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
                <LText>{L(META[k].title)}</LText>
                <LText style={{ fontWeight: '800' }}>
                  {L('{a}/{b} j', { a: r.goals[k].met, b: r.counted })} · {r.goals[k].total}
                </LText>
              </View>
            ))}
            {en.length === 0 ? <LMuted>Aucun objectif actif.</LMuted> : null}
          </LCard>
        ))}
        <LMuted style={{ marginBottom: 12 }}>Ce bilan reste sur votre appareil : il n’est ni envoyé, ni partagé, ni comparé.</LMuted>

        <SectionLabel>Étapes</SectionLabel>
        <LCard>
          {ms.length === 0 ? (
            <LMuted>{L('Les étapes apparaîtront ici : khatma terminée, {n} jours de wird.', { n: WIRD_MILESTONE_DAYS })}</LMuted>
          ) : (
            [...ms].reverse().map((x) => (
              <View key={x.id} style={{ flexDirection: 'row', gap: 10, alignItems: 'center', paddingVertical: 6 }}>
                <Ionicons name={x.kind === 'khatma' ? 'book' : 'leaf'} size={18} color={b.goldDeep} />
                <LText style={{ flex: 1 }}>{x.kind === 'khatma' ? L('Khatma terminée') : L('{n} jours de wird', { n: WIRD_MILESTONE_DAYS })}</LText>
                <LMuted>{fmtDay(x.at)}</LMuted>
              </View>
            ))
          )}
          {wird.days > 0 && wird.days < WIRD_MILESTONE_DAYS && prefs.on.wird ? (
            <LMuted style={{ marginTop: 6 }}>{L('Wird : {a} / {b} jours', { a: wird.days, b: WIRD_MILESTONE_DAYS })}</LMuted>
          ) : null}
        </LCard>

        <SectionLabel>Choisir mes objectifs</SectionLabel>
        <LCard>
          {GOAL_KEYS.map((k) => (
            <View key={k} style={{ marginBottom: 6 }}>
              <Toggle label={L(META[k].title)} value={prefs.on[k]} onChange={(on) => patch(k, { on })} />
              {prefs.on[k] && TARGET_OPTIONS[k].length > 1 ? (
                <Segmented label={L('Cible par jour')} options={TARGET_OPTIONS[k].map((n) => ({ label: String(n), value: n }))} value={prefs.target[k]} onChange={(target) => patch(k, { target })} />
              ) : null}
            </View>
          ))}
          <LMuted>Le wird compte une pratique tijani entièrement cochée, ou les adhkar du matin ou du soir terminés.</LMuted>
        </LCard>

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
          {[
            { t: 'Planificateur', h: '/planner' as Href, i: 'calendar' as IconName },
            { t: 'Mon parcours', h: '/journey' as Href, i: 'trending-up' as IconName },
          ].map((x) => (
            <Pressable
              key={x.t}
              onPress={() => router.push(x.h)}
              accessibilityRole="button"
              accessibilityLabel={L(x.t)}
              style={{ flex: 1, minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: b.line, backgroundColor: b.paper, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            >
              <Ionicons name={x.i} size={18} color={b.teal} />
              <Text style={{ color: b.ink, fontWeight: '800' }}>{L(x.t)}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </Screen>
  );
}
