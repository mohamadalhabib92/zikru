import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { Text } from '@/ui/Text';
import { PatternBg } from '@/components/zikru/Pattern';
import { adhkarDays } from '@/lib/adhkar-store';
import {
  addDays,
  bestGentle,
  goalStreak,
  heatGrid,
  milestoneViews,
  monthBars,
  quranWindow,
  rate,
  sourcesOf,
  weekBars,
  weekColumns,
  zikrStreak,
  type Bar,
  type HeatCell,
} from '@/lib/constance';
import { useDispense } from '@/lib/dispense-context';
import { DEFAULT_GOALS, normalizeGoals, type GoalPrefs } from '@/lib/goals';
import { goalPrefs } from '@/lib/goals-store';
import { dayKey, useGrowth } from '@/lib/growth';
import { L } from '@/lib/l10n';
import { usePremium } from '@/lib/premium';
import { pagesDay, readDays } from '@/lib/quran-store';
import { useShared } from '@/lib/shared-state';
import { usePersistentState } from '@/lib/storage';
import { PRACTICES } from '@/lib/tijani';
import { Button, Screen } from '@/ui/kit';
import { LCard, LMuted, LTitle } from '@/ui/light';
import { brand as b, isDark } from '@/ui/theme';

const LEVEL = ['#E4DDD0', '#C9E2D4', '#7FBF9A', '#2F8F62', '#0E5C40'];
const LEVEL_DARK = ['#24302B', '#1E4A38', '#1F6B4A', '#2F9A68', '#7DDCB0'];

function tone(level: number, dark: boolean) {
  return (dark ? LEVEL_DARK : LEVEL)[level] ?? LEVEL[0];
}

function Heat({ cells, weeks, dark, today }: { cells: HeatCell[]; weeks: number; dark: boolean; today: Date }) {
  const by = new Map(cells.map((c) => [c.key, c]));
  const cols = weekColumns(today, weeks);
  const size = weeks > 20 ? 8 : 14;
  const gap = 3;
  return (
    <Svg width={cols.length * (size + gap)} height={7 * (size + gap)} accessibilityRole="image" accessibilityLabel={L('Calendrier de régularité')}>
      {cols.map((start, x) =>
        Array.from({ length: 7 }, (_, y) => {
          const key = addDays(start, y);
          const day = by.get(key);
          if (!day) return null;
          return <Rect key={key} x={x * (size + gap)} y={y * (size + gap)} width={size} height={size} rx={2} fill={tone(day.level, dark)} stroke={day.objectiveMet ? b.goldDeep : 'transparent'} strokeWidth={day.objectiveMet ? 1.5 : 0} />;
        }),
      )}
    </Svg>
  );
}

function Bars({ rows, field }: { rows: Bar[]; field: 'zikr' | 'rate' }) {
  const vals = rows.map((r) => (field === 'zikr' ? r.zikr : rate(r)));
  const max = Math.max(1, ...vals);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 96, gap: 6, marginTop: 8 }}>
      {rows.map((r, i) => (
        <View key={r.key} accessible accessibilityLabel={field === 'zikr' ? L('{n} dhikr', { n: r.zikr }) : L('{a}/{b} jours d’objectifs', { a: r.met, b: r.counted })} style={{ flex: 1, alignItems: 'center' }}>
          <View style={{ width: '70%', height: Math.max(2, (vals[i] / max) * 80), backgroundColor: field === 'zikr' ? b.green : b.teal, borderRadius: 4 }} />
          <Text style={{ color: b.inkMuted, fontSize: 8, marginTop: 4 }} numberOfLines={1} maxFontSizeMultiplier={1.2}>
            {r.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

export default function Constance() {
  const router = useRouter();
  const g = useGrowth();
  const premium = usePremium();
  const full = premium.ready && premium.canCreate;
  const dark = isDark();
  const dispense = useDispense();
  const [rawPrefs] = useShared(goalPrefs);
  const prefs: GoalPrefs = normalizeGoals(rawPrefs ?? DEFAULT_GOALS);
  const [pages] = useShared(pagesDay);
  const [daysRead] = useShared(readDays);
  const [adh] = useShared(adhkarDays);
  const [tijani] = usePersistentState<Record<string, number[]>>('tijani-done', {});
  const readSet = useMemo(() => new Set(daysRead), [daysRead]);
  const values = useMemo(
    () =>
      sourcesOf({
        prayed: g.prayed,
        clicks: g.days,
        pages,
        tijani,
        adhkar: adh,
        practices: PRACTICES.map((p) => ({ id: p.id, steps: p.steps.length })),
      }),
    [g.prayed, g.days, pages, tijani, adh],
  );
  const neutral = dispense.neutral;
  const now = useMemo(() => new Date(), []);
  const zikr = useMemo(() => zikrStreak(values, now, neutral), [values, now, neutral]);
  const goals = useMemo(() => goalStreak(values, prefs, now, neutral), [values, prefs, now, neutral]);
  const today = dayKey(now);
  // Lecture seule, bornée : au-delà de onze ans le calcul s’arrête (la série récente reste exacte).
  const cap = addDays(today, -3990);
  const earliest = Object.keys(g.days)
    .filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k))
    .sort()[0];
  const from = !earliest || earliest > cap ? earliest ?? today : cap;
  const bestZ = useMemo(() => bestGentle((k) => (values(k).tasbih || 0) > 0, from, today, neutral), [values, from, today, neutral]);
  const grid = useMemo(() => heatGrid(values, prefs, { today: now, weeks: 12, neutral, read: (k) => readSet.has(k) }), [values, prefs, now, neutral, readSet]);
  const year = useMemo(() => (full ? heatGrid(values, prefs, { today: now, weeks: 53, neutral, read: (k) => readSet.has(k) }) : []), [full, values, prefs, now, neutral, readSet]);
  const weeks = useMemo(() => weekBars(values, prefs, now, 12, neutral), [values, prefs, now, neutral]);
  const months = useMemo(() => (full ? monthBars(values, prefs, now, 12, neutral) : []), [full, values, prefs, now, neutral]);
  const quran = useMemo(() => quranWindow(values, (k) => readSet.has(k), now, full ? 84 : 28, neutral), [values, readSet, now, full, neutral]);
  const marks = milestoneViews(Math.max(zikr.days, bestZ));

  return (
    <Screen padded={false} bg={b.cream}>
      <PatternBg color={b.green} style={{ padding: 20 }}>
        <Text accessibilityRole="header" style={{ color: '#fff', fontSize: 24, fontWeight: '900' }}>
          {L('Constance')}
        </Text>
        <Text style={{ color: 'rgba(255,255,255,0.92)', marginTop: 4 }}>{L('Privé, sur cet appareil. Aucune comparaison.')}</Text>
      </PatternBg>
      <View style={{ padding: 16 }}>
        <LCard>
          <LTitle>{L('Série de dhikr')}</LTitle>
          <Text style={{ color: b.ink, fontSize: 28, fontWeight: '900' }}>{L('{n} jours', { n: zikr.days })}</Text>
          <LMuted>{L('Meilleure série : {n} jours', { n: Math.max(bestZ, zikr.days) })}</LMuted>
          <LMuted style={{ marginTop: 8 }}>
            {L('Un jour manqué par semaine est une grâce : il ne casse pas la série. Un deuxième jour manqué la même semaine l’arrête. Un jour en dispense ne compte pas. Aujourd’hui ne casse rien tant qu’il n’est pas fini.')}
          </LMuted>
          <LMuted>{L('Grâce restante cette semaine : {n}', { n: zikr.graceLeft })}</LMuted>
        </LCard>
        <LCard>
          <LTitle>{L('Série d’objectifs')}</LTitle>
          <Text style={{ color: b.ink, fontSize: 22, fontWeight: '900' }}>{L('{n} jours', { n: goals.days })}</Text>
          <LMuted>{L('Ce n’est pas le nombre de dhikr : seulement les jours où chaque objectif actif a été atteint.')}</LMuted>
        </LCard>

        <LCard>
          <LTitle>{L('Douze semaines')}</LTitle>
          <LMuted>{L('La teinte suit le volume de dhikr. Le liseré doré marque un jour d’objectifs atteints. Les deux ne s’additionnent pas.')}</LMuted>
          <View
            style={{ marginTop: 12 }}
            accessibilityLabel={`${L('Calendrier de douze semaines')}. ${L('{n} dhikr', { n: grid.reduce((s, c) => s + c.zikr, 0) })}. ${L('{a}/{b} jours d’objectifs', { a: grid.filter((c) => c.objectiveMet).length, b: grid.length })}`}
          >
            <Heat cells={grid} weeks={12} dark={dark} today={now} />
          </View>
          {grid.slice(-7).map((c) => (
            <LMuted key={c.key}>
              {L('{day} : {n} dhikr, {p} pages', { day: c.key, n: c.zikr, p: c.pages })}
              {c.objectiveMet ? ` ${L('objectifs atteints')}` : ''}
            </LMuted>
          ))}
        </LCard>

        <LCard>
          <LTitle>{L('Dhikr par semaine')}</LTitle>
          <Bars rows={weeks} field="zikr" />
          <LTitle style={{ marginTop: 12 }}>{L('Jours d’objectifs par semaine')}</LTitle>
          <Bars rows={weeks} field="rate" />
        </LCard>

        <LCard>
          <LTitle>{L('Coran')}</LTitle>
          <LMuted>{L('Pages terminées par jour. Un jour de lecture est noté à part : le nombre de versets n’est pas enregistré, nous ne l’inventons pas.')}</LMuted>
          {quran.filter((d) => d.pages > 0 || d.read).slice(-12).map((d) => (
            <View key={d.key} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
              <Text style={{ color: b.ink }}>{d.key}</Text>
              <Text style={{ color: b.ink, fontWeight: '700' }}>{d.pages > 0 ? L('{n} pages', { n: d.pages }) : L('Lecture')}</Text>
            </View>
          ))}
          {quran.every((d) => !d.pages && !d.read) ? <LMuted>{L('Aucune lecture notée sur cette période.')}</LMuted> : null}
        </LCard>

        <LCard>
          <LTitle>{L('Jalons')}</LTitle>
          <LMuted>{L('Des repères discrets, pas une compétition. Al-ḥamdu li-llāh.')}</LMuted>
          {marks.map((m) => (
            <Text key={m.days} style={{ color: m.reached ? b.ink : b.inkMuted, paddingVertical: 4, fontWeight: m.reached ? '800' : '400' }}>
              {m.reached ? '· ' : '○ '}
              {L('{n} jours de présence', { n: m.days })}
            </Text>
          ))}
        </LCard>

        {full ? (
          <LCard>
            <LTitle>{L('L’année')}</LTitle>
            <ScrollView horizontal accessibilityLabel={L('Calendrier de l’année')}>
              <Heat cells={year} weeks={53} dark={dark} today={now} />
            </ScrollView>
            <LTitle style={{ marginTop: 12 }}>{L('Dhikr par mois')}</LTitle>
            <Bars rows={months} field="zikr" />
          </LCard>
        ) : (
          <LCard>
            <LTitle>{L('L’année complète')}</LTitle>
            <LMuted>{L('La série et les douze semaines restent gratuites. L’historique d’un an est dans Premium.')}</LMuted>
            <Button title={L('Voir Premium')} variant="secondary" onPress={() => router.push('/premium')} />
          </LCard>
        )}
        <Pressable accessibilityRole="button" accessibilityLabel={L('Objectifs du jour')} onPress={() => router.push('/goals')} style={{ minHeight: 44, justifyContent: 'center' }}>
          <Text style={{ color: b.teal, fontWeight: '800' }}>{L('Objectifs du jour')} →</Text>
        </Pressable>
      </View>
    </Screen>
  );
}
