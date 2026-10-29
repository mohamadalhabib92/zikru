import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Text } from '@/ui/Text';
import { Sheet, QStepper } from '@/components/quran/Sheet';
import { readerPalette } from '@/components/quran/palette';
import { dayKey } from '@/lib/dates';
import { gIndex, juzRange, OFFSETS, pageOf, pageRange, fromIndex } from '@/lib/quran-nav';
import { hifzCards } from '@/lib/quran-store';
import { useShared } from '@/lib/shared-state';
import { dailyQueue, MATURE, queueSize, rangeStatus, type Status } from '@/lib/srs';
import { SURAHS } from '@/lib/surahs';
import { Container, FadeIn, HeroHeader, SectionHeader, useLayout } from '@/ui/ds';
import { Button, Ionicons, Segmented } from '@/ui/kit';
import { alpha, brand as b, fonts } from '@/ui/theme';
import { L } from '@/lib/l10n';

const statusColor = (s: Status) => (s === 'memorised' ? b.green : s === 'review' ? '#D98A2B' : s === 'learning' ? b.gold : b.line);
const STATUS_LABEL: Record<Status, string> = { none: 'Pas commencé', learning: 'En cours', review: 'À réviser', memorised: 'Mémorisé' };

/** Mémorisation (hifz) : révision du jour, nouvelle leçon, carte de progression des 114 sourates et 30 juz’. */
export default function HifzHub() {
  const router = useRouter();
  const { tablet } = useLayout();
  const [cards, , ready] = useShared(hifzCards);
  const today = dayKey();
  const q = dailyQueue(cards, today);
  const due = queueSize(q);
  const keys = Object.keys(cards);
  const mature = keys.filter((k) => cards[k].i >= MATURE).length;
  const [s, setS] = useState(() => {
    // propose la sourate suivant la dernière apprise, sinon an-Nas → Juz’ ‘Amma est la tradition ; par défaut al-Fatiha
    const lastK = keys.map(Number).sort((a, z) => z - a)[0];
    return lastK != null ? fromIndex(lastK)[0] : 1;
  });
  const meta = SURAHS[s - 1];
  const firstNew = useMemo(() => {
    for (let a = 1; a <= meta[4]; a++) if (!cards[gIndex(s, a)]) return a;
    return 1;
  }, [s, cards, meta]);
  const [from, setFrom] = useState(firstNew);
  const [to, setTo] = useState(Math.min(meta[4], firstNew + 4));
  const [pick, setPick] = useState(false);
  const [view, setView] = useState<'surah' | 'juz'>('surah');
  const pal = readerPalette('auto');
  useEffect(() => {
    if (!ready || !keys.length) return;
    const lastK = keys.map(Number).sort((a, z) => z - a)[0];
    const n = fromIndex(lastK)[0];
    let f = 1;
    for (let a = 1; a <= SURAHS[n - 1][4]; a++)
      if (!cards[gIndex(n, a)]) {
        f = a;
        break;
      }
    setS(n);
    setFrom(f);
    setTo(Math.min(SURAHS[n - 1][4], f + 4));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);
  const chooseSurah = (n: number) => {
    setS(n);
    let f = 1;
    for (let a = 1; a <= SURAHS[n - 1][4]; a++)
      if (!cards[gIndex(n, a)]) {
        f = a;
        break;
      }
    setFrom(f);
    setTo(Math.min(SURAHS[n - 1][4], f + 4));
    setPick(false);
  };
  const preset = (kind: 'page' | 5 | 10 | 'all') => {
    if (kind === 'all') {
      setFrom(1);
      setTo(meta[4]);
    } else if (kind === 'page') {
      const [a, z] = pageRange(pageOf(s, from));
      const lo = Math.max(OFFSETS[s - 1], a), hi = Math.min(OFFSETS[s - 1] + meta[4], z);
      setFrom(lo - OFFSETS[s - 1] + 1);
      setTo(hi - OFFSETS[s - 1]);
    } else setTo(Math.min(meta[4], from + kind - 1));
  };

  const stat = (v: string | number, label: string, color = b.heroText) => (
    <View style={{ flex: 1, alignItems: 'center', backgroundColor: alpha(b.heroText, 0.08), borderRadius: 14, paddingVertical: 10 }}>
      <Text style={{ color, fontWeight: '900', fontSize: 20 }}>{v}</Text>
      <Text style={{ color: b.heroMuted, fontSize: 11, textAlign: 'center' }}>{label}</Text>
    </View>
  );
  const memSurahs = SURAHS.filter((x) => rangeStatus(cards, OFFSETS[x[0] - 1], OFFSETS[x[0] - 1] + x[4], today).mature === x[4]).length;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: b.cream }} contentContainerStyle={{ paddingBottom: 40 }}>
      <Container max={980} style={{ padding: 16, gap: 16 }}>
        <FadeIn>
          <HeroHeader>
            <Text style={{ color: b.gold, fontFamily: fonts.quran, fontSize: 22, lineHeight: 48 }}>حِفْظُ القُرْآنِ</Text>
            <Text style={{ color: b.heroText, fontSize: 22, fontWeight: '900' }}>Mémorisation</Text>
            <Text style={{ color: b.heroMuted, marginTop: 2 }}>Écouter, répéter, masquer, réviser au bon moment (sabaq · sabqi · manzil).</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
              {stat(keys.length, 'versets suivis')}
              {stat(mature, 'mémorisés', b.gold)}
              {stat(memSurahs, 'sourates complètes')}
            </View>
          </HeroHeader>
        </FadeIn>

        <FadeIn delay={60}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={L('Révision du jour : {n} versets', { n: due })}
            disabled={!due}
            onPress={() => router.push({ pathname: '/quran/hifz-session', params: { mode: 'review' } })}
            style={({ pressed }) => ({ backgroundColor: b.paper, borderRadius: 20, borderWidth: 1, borderColor: due ? b.gold : b.line, padding: 16, gap: 10, opacity: pressed ? 0.92 : 1 })}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name={due ? 'refresh-circle' : 'checkmark-circle'} size={26} color={due ? b.goldDeep : b.green} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: b.ink, fontWeight: '900', fontSize: 17 }}>Révision du jour</Text>
                <Text style={{ color: b.inkMuted, fontSize: 13 }}>{keys.length ? (due ? L('{n} verset(s) · environ {m} min', { n: due, m: Math.max(1, Math.round(due * 0.4)) }) : 'Tout est à jour — revenez demain.') : 'Commencez une leçon ci-dessous.'}</Text>
              </View>
              {due ? <Ionicons name="chevron-forward" size={18} color={b.inkMuted} /> : null}
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {([['Sabaq', 'leçon du jour', q.sabaq.length], ['Sabqi', 'révision récente', q.sabqi.length], ['Manzil', 'révision ancienne', q.manzil.length]] as const).map(([t, sub, v]) => (
                <View key={t} style={{ flex: 1, backgroundColor: b.cream, borderRadius: 12, padding: 10 }}>
                  <Text style={{ color: b.ink, fontWeight: '900', fontSize: 18 }}>{v}</Text>
                  <Text style={{ color: b.ink, fontWeight: '700', fontSize: 12 }}>{t}</Text>
                  <Text style={{ color: b.inkMuted, fontSize: 11 }}>{sub}</Text>
                </View>
              ))}
            </View>
          </Pressable>
        </FadeIn>

        <View>
          <SectionHeader title="Nouvelle leçon" />
          <View style={{ backgroundColor: b.paper, borderRadius: 20, borderWidth: 1, borderColor: b.line, padding: 16, gap: 14 }}>
            <Pressable accessibilityRole="button" accessibilityLabel={L('Sourate : {s}. Changer', { s: meta[2] })} onPress={() => setPick(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: b.cream, borderRadius: 14, padding: 12 }}>
              <Text style={{ color: b.green, fontWeight: '900', width: 30, textAlign: 'center' }}>{s}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: b.ink, fontWeight: '800', fontSize: 16 }}>{meta[2]}</Text>
                <Text style={{ color: b.inkMuted, fontSize: 12 }}>{L('{m} · {n} versets', { m: meta[3], n: meta[4] })}</Text>
              </View>
              <Text style={{ color: b.green, fontFamily: fonts.quran, fontSize: 18, lineHeight: 36 }}>{meta[1].replace(/^سُورَةُ\s*/, '')}</Text>
              <Ionicons name="chevron-down" size={18} color={b.inkMuted} />
            </Pressable>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
              <View style={{ gap: 4 }}>
                <Text style={{ color: b.inkMuted, fontSize: 12, fontWeight: '700' }}>Du verset</Text>
                <QStepper label="Premier verset" value={from} min={1} max={meta[4]} onChange={(v) => { setFrom(v); if (to < v) setTo(v); }} pal={pal} />
              </View>
              <View style={{ gap: 4 }}>
                <Text style={{ color: b.inkMuted, fontSize: 12, fontWeight: '700' }}>Au verset</Text>
                <QStepper label="Dernier verset" value={to} min={from} max={meta[4]} onChange={setTo} pal={pal} />
              </View>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {([['La page', 'page'], ['5 versets', 5], ['10 versets', 10], ['Toute la sourate', 'all']] as const).map(([l, v]) => (
                <Pressable key={l} accessibilityRole="button" onPress={() => preset(v)} style={{ paddingHorizontal: 12, minHeight: 34, justifyContent: 'center', borderRadius: 17, borderWidth: 1, borderColor: b.line, backgroundColor: b.cream }}>
                  <Text style={{ color: b.ink, fontWeight: '700', fontSize: 13 }}>{l}</Text>
                </Pressable>
              ))}
            </View>
            <Button title={L('Commencer · {s} {a}–{b}', { s: meta[2], a: from, b: to })} icon="play" onPress={() => router.push({ pathname: '/quran/hifz-session', params: { s: String(s), from: String(from), to: String(to) } })} />
            <Text style={{ color: b.inkMuted, fontSize: 12 }}>Conseil : 3 à 5 versets par jour, récitateur « Al-Husary (Mu‘allim) », puis masquez progressivement le texte.</Text>
          </View>
        </View>

        <View>
          <SectionHeader title="Carte de progression" />
          <Segmented options={[{ label: '114 sourates', value: 'surah' }, { label: '30 juz’', value: 'juz' }]} value={view} onChange={setView} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
            {(view === 'surah'
              ? SURAHS.map((x) => ({ n: x[0], name: x[2], range: [OFFSETS[x[0] - 1], OFFSETS[x[0] - 1] + x[4]] as [number, number] }))
              : Array.from({ length: 30 }, (_, i) => ({ n: i + 1, name: `Juz’ ${i + 1}`, range: juzRange(i + 1) }))
            ).map((t) => {
              const rs = rangeStatus(cards, t.range[0], t.range[1], today);
              const col = rs.known ? statusColor(rs.mature === rs.total ? 'memorised' : rs.due ? 'review' : 'learning') : null;
              const pct = Math.round((rs.known / rs.total) * 100);
              const size = view === 'surah' ? (tablet ? 52 : 40) : tablet ? 72 : 56;
              return (
                <Pressable
                  key={t.n}
                  accessibilityRole="button"
                  accessibilityLabel={`${t.name} : ${rs.known ? L('{p} % suivi', { p: pct }) + (rs.due ? ', ' + L('{n} à réviser', { n: rs.due }) : '') : L('pas commencé')}`}
                  onPress={() => (view === 'surah' ? chooseSurah(t.n) : chooseSurah(fromIndex(t.range[0])[0]))}
                  style={{ width: size, height: size, borderRadius: 10, backgroundColor: col ? alpha(col, 0.18 + 0.6 * (rs.known / rs.total)) : b.paper, borderWidth: 1, borderColor: col ?? b.line, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Text style={{ color: b.ink, fontWeight: '800', fontSize: view === 'surah' ? 12 : 14 }}>{t.n}</Text>
                  {view === 'juz' && rs.known ? <Text style={{ color: b.ink, fontSize: 10 }}>{`${pct} %`}</Text> : null}
                </Pressable>
              );
            })}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 10 }}>
            {(['none', 'learning', 'review', 'memorised'] as Status[]).map((x) => (
              <View key={x} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: x === 'none' ? b.paper : alpha(statusColor(x), 0.7), borderWidth: 1, borderColor: statusColor(x) }} />
                <Text style={{ color: b.inkMuted, fontSize: 12 }}>{STATUS_LABEL[x]}</Text>
              </View>
            ))}
          </View>
          <Text style={{ color: b.inkMuted, fontSize: 12, marginTop: 10 }}>Tout reste sur cet appareil. Un verset est « mémorisé » quand son intervalle de révision dépasse 21 jours.</Text>
        </View>
      </Container>

      <Sheet visible={pick} onClose={() => setPick(false)} title="Choisir une sourate" pal={pal}>
        {SURAHS.map((x) => {
          const rs = rangeStatus(cards, OFFSETS[x[0] - 1], OFFSETS[x[0] - 1] + x[4], today);
          return (
            <Pressable key={x[0]} accessibilityRole="button" onPress={() => chooseSurah(x[0])} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48, borderBottomWidth: 1, borderBottomColor: b.line }}>
              <Text style={{ color: b.green, fontWeight: '900', width: 30, textAlign: 'center' }}>{x[0]}</Text>
              <Text style={{ color: b.ink, fontWeight: x[0] === s ? '900' : '600', flex: 1 }}>{L('{s} · {n} v.', { s: x[2], n: x[4] })}</Text>
              {rs.known ? <Text style={{ color: statusColor(rs.status), fontSize: 12, fontWeight: '800' }}>{`${Math.round((rs.known / rs.total) * 100)} %`}</Text> : null}
            </Pressable>
          );
        })}
      </Sheet>
    </ScrollView>
  );
}
