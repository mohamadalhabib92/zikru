import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Svg, { Circle, Line, Rect, Text as SvgText } from 'react-native-svg';
import { PatternBg } from '@/components/zikru/Pattern';
import { dayKey } from '@/lib/growth';
import { computeDay, hhmm, type PrayerKey } from '@/lib/prayer';
import { useSettings } from '@/lib/settings';
import { usePersistentState } from '@/lib/storage';
import { ADILLA, BIOGRAPHY, CONDITIONS, FORMULAS, MUQADDAM_NOTE, PRACTICES, SHAYKH, type Practice } from '@/lib/tijani';
import { Ionicons, Screen, type IconName } from '@/ui/kit';
import { Arabic, LCard, LMuted, LText, LTitle, Pill } from '@/ui/light';
import { brand as b } from '@/ui/theme';

type Tab = 'wird' | 'wazifa' | 'hailala' | 'path' | 'adilla';
const TABS: { v: Tab; label: string; icon: IconName }[] = [
  { v: 'wird', label: 'Wird', icon: 'leaf' },
  { v: 'wazifa', label: 'Wazifa', icon: 'people' },
  { v: 'hailala', label: 'Hailala', icon: 'star' },
  { v: 'path', label: 'La Voie', icon: 'trail-sign' },
  { v: 'adilla', label: 'Adilla', icon: 'book' },
];

export default function Tijani() {
  const p = useLocalSearchParams<{ tab?: string }>();
  const initial = (TABS.find((x) => x.v === p.tab)?.v ?? 'wird') as Tab;
  const [tab, setTab] = useState<Tab>(initial);
  const [lang, setLang] = useState<'fr' | 'en'>('fr');
  return (
    <Screen padded={false} bg={b.cream}>
      <PatternBg color={b.green} style={{ padding: 20, paddingBottom: 24, alignItems: 'center' }}>
        <Text style={{ color: b.gold, fontSize: 30, writingDirection: 'rtl' }}>الطريقة التجانية</Text>
        <Text style={{ color: b.heroText, fontSize: 24, fontWeight: '900', marginTop: 2 }}>Programme Tijaniyya</Text>
        <Text style={{ color: b.heroMuted, marginTop: 2 }}>Wird · Wazifa · Hailala</Text>
      </PatternBg>
      <View style={{ padding: 16 }}>
        <ShaykhCard />
        <DaySchedule />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }} style={{ marginBottom: 12 }}>
          {TABS.map((x) => (
            <Pressable
              key={x.v}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === x.v }}
              onPress={() => setTab(x.v)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, minHeight: 40, borderRadius: 20, backgroundColor: tab === x.v ? b.green : b.paper, borderWidth: 1, borderColor: tab === x.v ? b.green : b.line }}
            >
              <Ionicons name={x.icon} size={16} color={tab === x.v ? b.gold : b.green} />
              <Text style={{ color: tab === x.v ? '#fff' : b.ink, fontWeight: '700' }}>{x.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
        {tab === 'wird' || tab === 'wazifa' || tab === 'hailala' ? (
          <>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
              <Pill label="Français" active={lang === 'fr'} onPress={() => setLang('fr')} color={b.brown} />
              <Pill label="English" active={lang === 'en'} onPress={() => setLang('en')} color={b.brown} />
            </View>
            <PracticeCard key={tab} p={PRACTICES.find((x) => x.id === tab)!} lang={lang} />
          </>
        ) : null}
        {tab === 'path' ? <PathTab /> : null}
        {tab === 'adilla' ? <AdillaTab /> : null}
        <LCard style={{ backgroundColor: b.blueSoft, borderColor: b.blueSoft }}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Ionicons name="person-circle-outline" size={22} color={b.blue} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: b.ink, fontWeight: '800' }}>Suivez votre muqaddam</Text>
              <LMuted>{MUQADDAM_NOTE}</LMuted>
            </View>
          </View>
        </LCard>
      </View>
    </Screen>
  );
}

function ShaykhCard() {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ backgroundColor: b.greenDeep, borderRadius: 18, padding: 16, marginBottom: 12 }}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(242,201,76,0.18)', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="ribbon" size={24} color={b.gold} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: b.gold, fontSize: 18, writingDirection: 'rtl', textAlign: 'left' }}>{SHAYKH.ar}</Text>
          <Text style={{ color: '#fff', fontWeight: '800' }}>{SHAYKH.name}</Text>
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={20} color={b.heroMuted} />
      </Pressable>
      {open ? (
        <View style={{ marginTop: 12, gap: 8 }}>
          {[
            ['calendar-outline', SHAYKH.born],
            ['flower-outline', SHAYKH.died],
            ['link-outline', SHAYKH.silsila],
            ['home-outline', SHAYKH.shrine],
          ].map(([ic, txt]) => (
            <View key={txt} style={{ flexDirection: 'row', gap: 10 }}>
              <Ionicons name={ic as IconName} size={16} color={b.gold} style={{ marginTop: 2 }} />
              <Text style={{ color: b.heroText, flex: 1, lineHeight: 20 }}>{txt}</Text>
            </View>
          ))}
          <Text style={{ color: b.heroMuted, fontStyle: 'italic', lineHeight: 21, marginTop: 4 }}>{SHAYKH.desc}</Text>
          {SHAYKH.pillars.map((x, i) => (
            <View key={x} style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
              <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: b.gold, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: b.greenDeep, fontWeight: '900', fontSize: 12 }}>{i + 1}</Text>
              </View>
              <Text style={{ color: '#fff', fontWeight: '700' }}>{x}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** Frise des 24 h : prières calculées + créneaux indicatifs Wird / Wazifa / Hailala, ligne « maintenant ». */
function DaySchedule() {
  const { s, t: tr } = useSettings();
  const [w, setW] = useState(320);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  const list = useMemo(() => computeDay(now, s.place, s.method, s.madhab), [now.toDateString(), s.place, s.method, s.madhab]); // eslint-disable-line react-hooks/exhaustive-deps
  const at = (k: PrayerKey) => list.find((x) => x.key === k)!.time;
  const mins = (d: Date) => d.getHours() * 60 + d.getMinutes();
  const pad = 8;
  const X = (m: number) => pad + ((w - pad * 2) * m) / 1440;
  const friday = now.getDay() === 5;
  const windows = [
    { from: at('fajr'), to: at('dhuhr'), color: b.wirdGreen, row: 0, op: 0.9 },
    { from: at('asr'), to: at('isha'), color: b.wirdGreen, row: 0, op: 0.9 },
    { from: at('maghrib'), to: at('isha'), color: b.wazifa, row: 1, op: 0.95 },
    { from: at('asr'), to: at('maghrib'), color: b.hailala, row: 2, op: friday ? 0.95 : 0.35 },
  ];
  const H = 128;
  const axisY = 96;
  return (
    <LCard>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <LTitle>Programme tijani du jour</LTitle>
        <LMuted>Vue 24 h</LMuted>
      </View>
      <View onLayout={(e) => setW(Math.max(260, e.nativeEvent.layout.width))} style={{ marginTop: 8 }}>
        <Svg width={w} height={H}>
          {[0, 1, 2].map((r) => (
            <Rect key={r} x={pad} y={44 + r * 14} width={w - pad * 2} height={10} rx={5} fill={b.line} />
          ))}
          {windows.map((x, i) => (
            <Rect key={i} x={X(mins(x.from))} y={44 + x.row * 14} width={Math.max(4, X(mins(x.to)) - X(mins(x.from)))} height={10} rx={5} fill={x.color} opacity={x.op} />
          ))}
          <Line x1={pad} y1={axisY} x2={w - pad} y2={axisY} stroke={b.line} strokeWidth={2} />
          {[0, 3, 6, 9, 12, 15, 18, 21].map((h) => (
            <SvgText key={h} x={X(h * 60)} y={axisY + 18} fontSize={10} fill={b.inkMuted} textAnchor={h === 0 ? 'start' : 'middle'}>
              {h === 0 ? '0h' : `${h}h`}
            </SvgText>
          ))}
          {list.map((p, i) => (
            <Circle key={p.key} cx={X(mins(p.time))} cy={axisY} r={4.5} fill={p.key === 'sunrise' ? b.goldDeep : b.brown} />
          ))}
          {list.map((p, i) => (
            <SvgText key={p.key + 't'} x={X(mins(p.time))} y={i % 2 ? 26 : 12} fontSize={10} fontWeight="700" fill={b.ink} textAnchor="middle">
              {`${tr[p.key].slice(0, 7)} ${hhmm(p.time)}`}
            </SvgText>
          ))}
          <Line x1={X(mins(now))} y1={34} x2={X(mins(now))} y2={axisY + 4} stroke={b.gold} strokeWidth={3} />
          <SvgText x={Math.min(w - 30, X(mins(now)) + 4)} y={40} fontSize={10} fontWeight="800" fill={b.goldDeep}>
            Maintenant
          </SvgText>
        </Svg>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 4 }}>
        {[
          [b.wirdGreen, 'Wird al-Lazim'],
          [b.wazifa, 'Wazifa'],
          [b.hailala, 'Hailala (vendredi)'],
          [b.gold, 'Maintenant'],
        ].map(([c, l]) => (
          <View key={l} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: c }} />
            <Text style={{ color: b.inkMuted, fontSize: 12 }}>{l}</Text>
          </View>
        ))}
      </View>
      <LMuted style={{ fontSize: 11, marginTop: 6 }}>Créneaux indicatifs ; votre muqaddam précise les horaires exacts.</LMuted>
    </LCard>
  );
}

function PracticeCard({ p, lang }: { p: Practice; lang: 'fr' | 'en' }) {
  const [done, setDone] = usePersistentState<Record<string, number[]>>('tijani-done', {});
  const [open, setOpen] = useState<number | null>(null);
  const key = `${dayKey()}-${p.id}`;
  const checked = done[key] ?? [];
  const toggle = (i: number) =>
    setDone((d) => {
      const cur = d[key] ?? [];
      const next = cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i];
      // garde les 14 derniers jours
      const entries = Object.entries({ ...d, [key]: next }).sort(([a], [b2]) => (a < b2 ? 1 : -1)).slice(0, 42);
      return Object.fromEntries(entries);
    });
  const total = p.steps.reduce((a, s) => a + s.count, 0);
  return (
    <LCard style={{ padding: 0, overflow: 'hidden' }}>
      <View style={{ padding: 16 }}>
        <Arabic size={26} style={{ color: b.green, textAlign: 'center' }}>
          {p.ar}
        </Arabic>
        <Text style={{ color: b.ink, fontSize: 20, fontWeight: '900', textAlign: 'center' }}>{p.name}</Text>
      </View>
      <View style={{ flexDirection: 'row', backgroundColor: b.green }}>
        {[
          ['Étapes', String(p.steps.length)],
          ['Faites', String(checked.length)],
          ['Total', p.uncounted ? '∞' : String(total)],
        ].map(([l, v], i) => (
          <View key={l} style={{ flex: 1, alignItems: 'center', paddingVertical: 12, borderLeftWidth: i ? 1 : 0, borderLeftColor: 'rgba(255,255,255,0.15)' }}>
            <Text style={{ color: b.gold, fontSize: 22, fontWeight: '900' }}>{v}</Text>
            <Text style={{ color: b.heroMuted, fontSize: 12 }}>{l}</Text>
          </View>
        ))}
      </View>
      <View style={{ padding: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: b.goldSoft, borderRadius: 12, padding: 10 }}>
          <Ionicons name="time-outline" size={18} color={b.goldDeep} />
          <Text style={{ color: b.ink, fontWeight: '700', flex: 1 }}>{p.timing}</Text>
          <Text style={{ color: b.brownSoft, writingDirection: 'rtl' }}>{p.timingAr}</Text>
        </View>
        <LText style={{ marginTop: 10 }}>{p.desc}</LText>
        <View style={{ marginTop: 12, gap: 8 }}>
          {p.steps.map((st, i) => {
            const f = FORMULAS[st.formula];
            const isOn = checked.includes(i);
            const isOpen = open === i;
            return (
              <View key={i} style={{ borderRadius: 14, borderWidth: 1, borderColor: isOn ? b.wirdGreen : b.line, backgroundColor: isOn ? b.greenTint : b.paper }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', padding: 10, gap: 10 }}>
                  <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: isOn }} accessibilityLabel={`${f.title} — ${isOn ? 'fait' : 'marquer comme fait'}`} onPress={() => toggle(i)} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
                    {isOn ? (
                      <Ionicons name="checkmark-circle" size={30} color={b.wirdGreen} />
                    ) : (
                      <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: b.green, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ color: b.gold, fontWeight: '900' }}>{i + 1}</Text>
                      </View>
                    )}
                  </Pressable>
                  <Pressable accessibilityRole="button" accessibilityState={{ expanded: isOpen }} onPress={() => setOpen(isOpen ? null : i)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: b.ink, fontSize: 17, writingDirection: 'rtl', textAlign: 'right' }} numberOfLines={isOpen ? undefined : 1}>
                        {f.ar}
                      </Text>
                      <Text style={{ color: b.brownSoft, fontStyle: 'italic', fontSize: 13 }} numberOfLines={isOpen ? undefined : 1}>
                        {f.tr}
                      </Text>
                    </View>
                    <View style={{ backgroundColor: b.gold, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 }}>
                      <Text style={{ color: b.ink, fontWeight: '900', fontSize: 12 }}>{st.count ? `×${st.count}` : '∞'}</Text>
                    </View>
                    <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color={b.inkMuted} />
                  </Pressable>
                </View>
                {isOpen ? (
                  <View style={{ paddingHorizontal: 14, paddingBottom: 12 }}>
                    <Text style={{ color: b.ink, fontWeight: '800' }}>{f.title}</Text>
                    <LText style={{ marginTop: 4 }}>{lang === 'fr' ? f.fr : f.en}</LText>
                    {f.indicative ? <LMuted style={{ fontSize: 12 }}>{lang === 'fr' ? 'Traduction indicative.' : 'Indicative translation.'}</LMuted> : null}
                    {f.note ? <LMuted style={{ fontSize: 12, marginTop: 4 }}>{f.note}</LMuted> : null}
                    {st.extra ? <LMuted style={{ marginTop: 4 }}>{st.extra}</LMuted> : null}
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
        {p.id === 'hailala' ? <LMuted style={{ marginTop: 10 }}>{new Date().getDay() === 5 ? 'C’est vendredi aujourd’hui : Jumu‘a mubaraka !' : 'Prochaine hailala : vendredi, après ‘Asr.'}</LMuted> : null}
        {checked.length === p.steps.length ? <Text style={{ color: b.wirdGreen, fontWeight: '800', marginTop: 10 }}>Bārak Allāhu fīk — pratique complétée aujourd’hui.</Text> : null}
      </View>
    </LCard>
  );
}

function PathTab() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <View>
      {BIOGRAPHY.map((x, i) => (
        <LCard key={x.title} onPress={() => setOpen(open === i ? null : i)} label={x.title}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: b.ink, fontWeight: '800', fontSize: 16, flex: 1 }}>{x.title}</Text>
            <Ionicons name={open === i ? 'chevron-up' : 'chevron-down'} size={18} color={b.inkMuted} />
          </View>
          {open === i ? <LText style={{ marginTop: 8 }}>{x.body}</LText> : null}
        </LCard>
      ))}
      <LTitle style={{ marginTop: 6 }}>Conditions de la voie</LTitle>
      <LMuted>Telles qu’elles sont couramment énoncées ; le muqaddam les explique lors de la transmission.</LMuted>
      <LCard style={{ marginTop: 8 }}>
        {CONDITIONS.map((c, i) => (
          <View key={i} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginBottom: 8 }}>
            <Ionicons name="checkmark-circle" size={18} color={b.wirdGreen} />
            <LText style={{ flex: 1 }}>{c}</LText>
          </View>
        ))}
      </LCard>
    </View>
  );
}

function AdillaTab() {
  const [kind, setKind] = useState<'all' | 'coran' | 'hadith'>('all');
  const list = ADILLA.filter((a) => kind === 'all' || a.kind === kind);
  return (
    <View>
      <LTitle>Adilla — preuves du dhikr</LTitle>
      <LMuted>Versets (sourate:verset, sens traduit) et hadiths (recueil + numéro).</LMuted>
      <View style={{ flexDirection: 'row', gap: 8, marginVertical: 10 }}>
        <Pill label="Tout" active={kind === 'all'} onPress={() => setKind('all')} />
        <Pill label="Coran" active={kind === 'coran'} onPress={() => setKind('coran')} />
        <Pill label="Hadith" active={kind === 'hadith'} onPress={() => setKind('hadith')} />
      </View>
      {list.map((a) => (
        <LCard key={a.ref}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: a.kind === 'coran' ? b.wirdGreen : b.purple, fontWeight: '800', fontSize: 12 }}>{a.kind === 'coran' ? 'CORAN' : 'HADITH'}</Text>
            <LMuted style={{ fontSize: 12 }}>{a.topic}</LMuted>
          </View>
          <LText style={{ marginTop: 6 }}>{a.text}</LText>
          <Text style={{ color: b.brown, fontWeight: '800', marginTop: 6 }}>{a.ref}</Text>
        </LCard>
      ))}
    </View>
  );
}
