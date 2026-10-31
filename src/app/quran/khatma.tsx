import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Text } from '@/ui/Text';
import { QStepper } from '@/components/quran/Sheet';
import { readerPalette } from '@/components/quran/palette';
import { addDays, dayKey } from '@/lib/dates';
import { khatmaStatus, markPage, MUSHAF_PAGES, newKhatma, streak } from '@/lib/khatma';
import { useDispense } from '@/lib/dispense-context';
import { fromIndex, pageRange } from '@/lib/quran-nav';
import { khatma as khatmaStore, readDays } from '@/lib/quran-store';
import { remindersSupported, requestReminderPermission } from '@/lib/reminders';
import { useSettings } from '@/lib/settings';
import { useShared } from '@/lib/shared-state';
import { SURAHS } from '@/lib/surahs';
import { Container, FadeIn, HeroHeader, ProgressBar, SectionHeader } from '@/ui/ds';
import { Button, Segmented } from '@/ui/kit';
import { alpha, brand as b } from '@/ui/theme';
import { L } from '@/lib/l10n';

const PLANS = [
  { days: 7, label: '7 jours', sub: '≈ 87 p./jour' },
  { days: 10, label: '10 jours', sub: '3 juz’/jour' },
  { days: 15, label: '15 jours', sub: '2 juz’/jour' },
  { days: 30, label: '1 mois', sub: '1 juz’/jour' },
  { days: 60, label: '2 mois', sub: '≈ 10 p./jour' },
  { days: 120, label: '4 mois', sub: '≈ 5 p./jour' },
];
const fmt = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
const surahAtPage = (p: number) => SURAHS[fromIndex(pageRange(p)[0])[0] - 1][2];

/** Planificateur de khatma : durée, wird du jour, avance/retard, rappel. */
export default function KhatmaScreen() {
  const router = useRouter();
  const [k, setK] = useShared(khatmaStore);
  const [days] = useShared(readDays);
  const { s, set } = useSettings();
  const today = dayKey();
  const [plan, setPlan] = useState(30);
  const [custom, setCustom] = useState(30);
  const [from, setFrom] = useState(1);
  const [quit, setQuit] = useState(false);
  const pal = readerPalette('auto');
  const st = k ? khatmaStatus(k, today) : null;
  const { neutral } = useDispense();
  const sk = streak(days, today, neutral);
  const slot = s.notif.quran ?? 'off';
  const setSlot = async (v: 'off' | 'fajr' | 'isha') => {
    if (v !== 'off' && !s.reminders) {
      const ok = await requestReminderPermission();
      if (!ok) return;
      set({ reminders: true, notif: { ...s.notif, quran: v } });
      return;
    }
    set({ notif: { ...s.notif, quran: v } });
  };
  const reminder = remindersSupported() ? (
    <View style={{ backgroundColor: b.paper, borderRadius: 20, borderWidth: 1, borderColor: b.line, padding: 16, gap: 8 }}>
      <Text style={{ color: b.ink, fontWeight: '800' }}>Rappel quotidien du wird</Text>
      <Segmented options={[{ label: 'Aucun', value: 'off' as const }, { label: 'Après Fajr', value: 'fajr' as const }, { label: 'Après ‘Isha', value: 'isha' as const }]} value={slot} onChange={(v) => void setSlot(v)} />
      <Text style={{ color: b.inkMuted, fontSize: 12 }}>Calculé selon vos horaires de prière (45 min après Fajr ou 30 min après ‘Isha).</Text>
    </View>
  ) : null;

  if (!k || !st)
    return (
      <ScrollView style={{ flex: 1, backgroundColor: b.cream }} contentContainerStyle={{ paddingBottom: 40 }}>
        <Container max={820} style={{ padding: 16, gap: 16 }}>
          <HeroHeader>
            <Text style={{ color: b.heroText, fontSize: 22, fontWeight: '900' }}>Planifier une khatma</Text>
            <Text style={{ color: b.heroMuted, marginTop: 4 }}>Lire tout le Coran (604 pages du mushaf de Médine) à votre rythme, avec un wird quotidien.</Text>
          </HeroHeader>
          <SectionHeader title="Durée" />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {PLANS.map((x) => (
              <Pressable key={x.days} accessibilityRole="button" accessibilityState={{ selected: plan === x.days }} onPress={() => { setPlan(x.days); setCustom(x.days); }} style={{ width: '31.5%', minWidth: 100, flexGrow: 1, padding: 12, borderRadius: 16, borderWidth: plan === x.days ? 2 : 1, borderColor: plan === x.days ? b.green : b.line, backgroundColor: plan === x.days ? alpha(b.green, 0.08) : b.paper }}>
                <Text style={{ color: b.ink, fontWeight: '900' }}>{x.label}</Text>
                <Text style={{ color: b.inkMuted, fontSize: 12 }}>{x.sub}</Text>
              </Pressable>
            ))}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
            <View style={{ gap: 4 }}>
              <Text style={{ color: b.inkMuted, fontSize: 12, fontWeight: '700' }}>Nombre de jours</Text>
              <QStepper label="Nombre de jours" value={custom} min={1} max={365} onChange={(v) => { setCustom(v); setPlan(v); }} pal={pal} />
            </View>
            <View style={{ gap: 4 }}>
              <Text style={{ color: b.inkMuted, fontSize: 12, fontWeight: '700' }}>Commencer à la page</Text>
              <QStepper label="Page de départ" value={from} min={1} max={MUSHAF_PAGES} onChange={setFrom} step={1} pal={pal} />
            </View>
          </View>
          <Text style={{ color: b.inkMuted }}>{L('{n} pages par jour environ · fin le {d} · départ : {s}', { n: Math.ceil((MUSHAF_PAGES - from + 1) / custom), d: fmt(addDays(today, custom - 1)), s: surahAtPage(from) })}</Text>
          <Button title="Commencer la khatma" icon="flag-outline" onPress={() => setK(newKhatma(today, custom, from))} />
          {reminder}
        </Container>
      </ScrollView>
    );

  const ahead = st.delta >= 0;
  return (
    <ScrollView style={{ flex: 1, backgroundColor: b.cream }} contentContainerStyle={{ paddingBottom: 40 }}>
      <Container max={820} style={{ padding: 16, gap: 16 }}>
        <FadeIn>
          <HeroHeader>
            <Text style={{ color: b.heroMuted, fontWeight: '700' }}>{st.finished ? 'Khatma achevée' : L('Jour {a} sur {b}', { a: st.day, b: k.days })}</Text>
            <Text style={{ color: b.heroText, fontSize: 28, fontWeight: '900' }}>{`${Math.round(st.progress * 100)} %`}</Text>
            <Text style={{ color: b.heroMuted }}>{L('{a} / {b} pages · fin prévue le {d}', { a: st.done, b: st.total, d: fmt(st.end) })}</Text>
            <View style={{ marginTop: 12 }}>
              <ProgressBar progress={st.progress} color={b.gold} />
            </View>
            <Text style={{ color: b.heroText, marginTop: 10, fontWeight: '700' }}>{L('Série : {n} jour(s) · record {b}', { n: sk.current, b: sk.best })}</Text>
          </HeroHeader>
        </FadeIn>
        {st.finished ? (
          <View style={{ backgroundColor: b.paper, borderRadius: 20, padding: 18, gap: 8, borderWidth: 1, borderColor: b.gold }}>
            <Text style={{ color: b.ink, fontSize: 18, fontWeight: '900' }}>Mabrouk, khatma terminée !</Text>
            <Text style={{ color: b.inkMuted }}>{L('Achevée le {d}. Il est d’usage de faire des invocations à la fin de la lecture du Coran.', { d: fmt(k.finished ?? today) })}</Text>
            <Button title="Nouvelle khatma" icon="refresh" onPress={() => setK(null)} />
          </View>
        ) : (
          <View style={{ backgroundColor: b.paper, borderRadius: 20, padding: 16, gap: 10, borderWidth: 1, borderColor: b.line }}>
            <Text style={{ color: b.ink, fontSize: 17, fontWeight: '900' }}>Wird du jour</Text>
            {st.today ? <Text style={{ color: b.ink }}>{L('Pages {a} à {b} · {s}', { a: st.today.from, b: st.today.to, s: surahAtPage(st.today.from) })}</Text> : null}
            <Text style={{ color: ahead ? b.green : '#D98A2B', fontWeight: '700' }}>
              {st.delta === 0 ? 'Vous êtes dans les temps.' : ahead ? L('En avance de {n} page(s).', { n: st.delta }) : L('En retard de {n} page(s) : {p} pages/jour pour finir à temps.', { n: -st.delta, p: st.needPerDay })}
            </Text>
            <Button title={L('Lire à partir de la page {p}', { p: st.nextPage })} icon="book-outline" onPress={() => router.push({ pathname: '/quran/mushaf', params: { p: String(st.nextPage) } })} />
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              <Button small variant="secondary" title="Page suivante lue" icon="checkmark" onPress={() => setK((c) => (c ? markPage(c, st.nextPage, today) : c))} />
              {st.today ? <Button small variant="secondary" title="Wird du jour lu" icon="checkmark-done" onPress={() => setK((c) => (c ? markPage(c, st.today!.to, today) : c))} /> : null}
            </View>
            <Text style={{ color: b.inkMuted, fontSize: 12 }}>La progression avance aussi automatiquement quand vous tournez les pages du mushaf.</Text>
          </View>
        )}
        {reminder}
        <Button variant="secondary" title={quit ? 'Confirmer : effacer ce plan' : 'Abandonner ce plan'} icon="close-circle-outline" onPress={() => (quit ? (setK(null), setQuit(false)) : setQuit(true))} />
      </Container>
    </ScrollView>
  );
}
