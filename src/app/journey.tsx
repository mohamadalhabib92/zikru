import { View } from 'react-native';
import { Text } from '@/ui/Text';
import { GoalsLink } from '@/components/GoalsLink';
import { PatternBg } from '@/components/zikru/Pattern';
import { useData } from '@/lib/data';
import { bestStreak, dayKey, LEVELS, levelFor, streak, useGrowth } from '@/lib/growth';
import { useDispense } from '@/lib/dispense-context';
import { Ionicons, Screen, type IconName } from '@/ui/kit';
import { LCard, LMuted, LTitle, SectionLabel } from '@/ui/light';
import { alpha, brand as b } from '@/ui/theme';
import { L } from '@/lib/l10n';

export default function Journey() {
  const { tasbih } = useData();
  const g = useGrowth();
  const total = tasbih.total;
  const lvl = levelFor(total);
  const active = Object.keys(g.days).filter((k) => (g.days[k] ?? 0) > 0);
  const { neutral } = useDispense();
  const cur = streak((k) => (g.days[k] ?? 0) > 0, new Date(), neutral);
  const best = Math.max(cur, bestStreak(active, neutral));
  const today = g.days[dayKey()] ?? 0;
  const last = (n: number) =>
    Array.from({ length: n }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (n - 1 - i));
      return { d, v: g.days[dayKey(d)] ?? 0 };
    });
  const week = last(7);
  const month = last(30);
  const max = Math.max(1, ...week.map((x) => x.v));
  const monthSum = month.reduce((a, x) => a + x.v, 0);
  const monthActive = month.filter((x) => x.v > 0).length;
  const prayedDays = Object.values(g.prayed).filter((p) => p.filter((k) => k !== 'sunrise').length >= 5).length;

  const milestones: { icon: IconName; title: string; ok: boolean }[] = [
    { icon: 'sparkles', title: '100 dhikr', ok: total >= 100 },
    { icon: 'star', title: '1 000 dhikr', ok: total >= 1000 },
    { icon: 'trophy', title: '10 000 dhikr', ok: total >= 10000 },
    { icon: 'flame', title: 'Série de 7 jours', ok: best >= 7 },
    { icon: 'ribbon', title: 'Série de 30 jours', ok: best >= 30 },
    { icon: 'moon', title: '5 prières cochées en un jour', ok: prayedDays >= 1 },
  ];

  return (
    <Screen padded={false} bg={b.cream}>
      <PatternBg color={b.brown} style={{ padding: 20 }}>
        <Text style={{ color: b.gold, fontWeight: '800' }}>NIVEAU {lvl.index}</Text>
        <Text style={{ color: '#fff', fontSize: 28, fontWeight: '900' }}>
          {lvl.name} · {lvl.fr}
        </Text>
        <Text style={{ color: 'rgba(255,255,255,0.85)', marginTop: 2 }}>{total.toLocaleString('fr-CH')} dhikr au total</Text>
        <View style={{ height: 10, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.2)', marginTop: 12, overflow: 'hidden' }}>
          <View style={{ width: `${Math.round(lvl.progress * 100)}%`, height: '100%', backgroundColor: b.gold }} />
        </View>
        <Text style={{ color: 'rgba(255,255,255,0.85)', marginTop: 6, fontSize: 12 }}>
          {lvl.next ? L('{n} dhikr avant {name} ({fr})', { n: (lvl.next.min - total).toLocaleString('fr-CH'), name: lvl.next.name, fr: L(lvl.next.fr) }) : 'Palier maximal atteint — al-hamdu lillah'}
        </Text>
      </PatternBg>
      <View style={{ padding: 16 }}>
        <GoalsLink />
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
          {[
            { l: 'Aujourd’hui', v: today.toLocaleString('fr-CH'), i: 'today' as IconName, c: b.green },
            { l: 'Série', v: `${cur} j`, i: 'flame' as IconName, c: b.rust },
            { l: 'Record', v: `${best} j`, i: 'trophy' as IconName, c: b.goldDeep },
          ].map((x) => (
            <View key={x.l} style={{ flex: 1, backgroundColor: b.paper, borderRadius: 16, borderWidth: 1, borderColor: b.line, padding: 12, alignItems: 'center' }}>
              <Ionicons name={x.i} size={20} color={x.c} />
              <Text style={{ color: b.ink, fontWeight: '900', fontSize: 20, marginTop: 4 }}>{x.v}</Text>
              <LMuted style={{ fontSize: 12 }}>{x.l}</LMuted>
            </View>
          ))}
        </View>

        <LCard>
          <LTitle>7 derniers jours</LTitle>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 110, gap: 8, marginTop: 10 }}>
            {week.map((x) => (
              <View key={x.d.toISOString()} style={{ flex: 1, alignItems: 'center' }}>
                <Text style={{ color: b.inkMuted, fontSize: 10 }}>{x.v || ''}</Text>
                <View style={{ width: '70%', height: Math.max(4, (x.v / max) * 80), borderRadius: 6, backgroundColor: x.v ? b.greenSoft : b.line }} />
                <Text style={{ color: b.inkMuted, fontSize: 11, marginTop: 4 }}>{x.d.toLocaleDateString('fr-CH', { weekday: 'narrow' })}</Text>
              </View>
            ))}
          </View>
        </LCard>

        <LCard>
          <LTitle>30 derniers jours</LTitle>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
            {month.map((x) => (
              <View key={x.d.toISOString()} accessibilityLabel={L('{d} : {n} dhikr', { d: x.d.toLocaleDateString('fr-CH'), n: x.v })} style={{ width: 22, height: 22, borderRadius: 6, backgroundColor: x.v === 0 ? b.line : x.v < 100 ? alpha(b.green, 0.35) : x.v < 500 ? alpha(b.green, 0.65) : b.green }} />
            ))}
          </View>
          <LMuted style={{ marginTop: 8 }}>
            {monthSum.toLocaleString('fr-CH')} dhikr · {monthActive} jours actifs sur 30
          </LMuted>
        </LCard>

        <SectionLabel color={b.brown}>JALONS</SectionLabel>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
          {milestones.map((m) => (
            <View key={m.title} style={{ width: '31%', flexGrow: 1, backgroundColor: m.ok ? b.goldSoft : b.paper, borderRadius: 14, borderWidth: 1, borderColor: m.ok ? b.gold : b.line, padding: 10, alignItems: 'center', opacity: m.ok ? 1 : 0.6 }}>
              <Ionicons name={m.ok ? m.icon : 'lock-closed'} size={22} color={m.ok ? b.goldDeep : b.inkMuted} />
              <Text style={{ color: b.ink, fontWeight: '700', fontSize: 12, textAlign: 'center', marginTop: 4 }}>{m.title}</Text>
            </View>
          ))}
        </View>

        <SectionLabel color={b.brown}>PALIERS</SectionLabel>
        <LCard>
          {LEVELS.map((l, i) => (
            <View key={l.name} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 }}>
              <Ionicons name={i < lvl.index ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={i < lvl.index ? b.green : b.inkMuted} />
              <Text style={{ color: b.ink, fontWeight: i === lvl.index - 1 ? '900' : '600', flex: 1 }}>
                {i + 1}. {l.name} — {l.fr}
              </Text>
              <LMuted>{l.min.toLocaleString('fr-CH')}</LMuted>
            </View>
          ))}
        </LCard>
        <LMuted>Ces paliers sont une simple motivation pour la régularité. Ils ne mesurent pas le rang spirituel, qui n’est connu que d’Allah. Les jours sont comptés depuis l’installation de cette version.</LMuted>
      </View>
    </Screen>
  );
}
