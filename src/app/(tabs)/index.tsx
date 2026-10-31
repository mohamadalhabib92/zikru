import { useRouter, type Href } from 'expo-router';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { Text } from '@/ui/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BleStatusChip } from '@/components/BleStatusChip';
import { SkyArc } from '@/components/zikru/SkyArc';
import { askBilal, BilalError } from '@/lib/bilal';
import { useData } from '@/lib/data';
import { DUAS_LIST } from '@/lib/duas';
import { dayKey, streak, useGrowth } from '@/lib/growth';
import { useDispense } from '@/lib/dispense-context';
import { formatHijri } from '@/lib/hijri';
import { isKahfTime } from '@/lib/kahf';
import { AR_NAMES, computeDay, countdown, hhmm, withStates, type PrayerKey } from '@/lib/prayer';
import { QURAN_DUAS } from '@/lib/quran-duas';
import { periodFor, PERIODS, REFLECTIONS } from '@/lib/reflections';
import { useSettings } from '@/lib/settings';
import { useConsent } from '@/lib/consent';
import { canFetchWeather, canSendToAI, undecided } from '@/lib/privacy';
import { privacyText } from '@/lib/privacy-text';
import { usePersistentState } from '@/lib/storage';
import { SURAHS } from '@/lib/surahs';
import { PRACTICES, practiceDoneKey } from '@/lib/tijani';
import { getWeather, wmo, type Weather } from '@/lib/weather';
import { useZikrs } from '@/lib/zikrs';
import { khatmaStatus, streak as readStreak } from '@/lib/khatma';
import { pageOf } from '@/lib/quran-nav';
import { hifzCards, khatma as khatmaStore, lastRead, readDays } from '@/lib/quran-store';
import { useShared } from '@/lib/shared-state';
import { dailyQueue, queueSize } from '@/lib/srs';
import { Container, FadeIn, Grid, IconBadge, ProgressRing, SectionHeader, Skeleton, tapHaptic, useLayout } from '@/ui/ds';
import { Ionicons, type IconName } from '@/ui/kit';
import { Arabic, LCard, LMuted } from '@/ui/light';
import { alpha, brand as b } from '@/ui/theme';
import { L, useUiLang } from '@/lib/l10n';
import { duaView, quranDuaView } from '@/lib/i18n-content';

const LOCALE: Record<string, string> = { fr: 'fr-CH', en: 'en-GB', de: 'de-DE', 'de-CH': 'de-CH', ar: 'ar', ff: 'fr-CH', wo: 'fr-CH' };
let aiUnavailable = false; // évite d'appeler la fonction à chaque rendu si l'IA n'est pas configurée
const FARD: PrayerKey[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
const totalReps = (items: { reps: number }[]) => items.reduce((a, it) => a + it.reps, 0);
const dayOfYear = (d: Date) => Math.floor((d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / 86400000);

/** Accueil : tableau de bord personnel. */
export default function Home() {
  const { s, t: tr } = useSettings();
  const uiL = useUiLang();
  const { tasbih, content } = useData();
  const { zikrs } = useZikrs();
  const g = useGrowth();
  const { neutral } = useDispense();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { tablet, wide, width } = useLayout({ inTabs: true });
  const [now, setNow] = useState(() => new Date());
  const [weather, setWeather] = useState<Weather | null>(null);
  const [wErr, setWErr] = useState(false);
  const [unit] = usePersistentState<'C' | 'F'>('temp-unit', 'C');
  const [kahfReminder] = usePersistentState('kahf-reminder', true);
  const [quranLast] = useShared(lastRead);
  const [qKhatma] = useShared(khatmaStore);
  const [qCards] = useShared(hifzCards);
  const [qDays] = useShared(readDays);
  const [tijaniDone] = usePersistentState<Record<string, number[]>>('tijani-done', {});
  const [reflIdx, setReflIdx] = useState(() => new Date().getDate());
  const [aiText, setAiText] = usePersistentState<{ key: string; text: string } | null>('bilal-reflection', null);
  const [aiBusy, setAiBusy] = useState(false);
  const [consent, choose, consentReady] = useConsent();
  const aiOk = canSendToAI(consent, consentReady);
  const weatherOk = canFetchWeather(consent, consentReady);
  const pt = privacyText(s.lang);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    let alive = true;
    setWErr(false);
    // Météo seulement après consentement explicite ; la position envoyée est arrondie (~10 km).
    if (!weatherOk) {
      setWeather(null);
      return;
    }
    getWeather(s.place.lat, s.place.lng, s.place.label)
      .then((w) => alive && setWeather(w))
      .catch(() => alive && setWErr(true));
    return () => {
      alive = false;
    };
  }, [s.place.lat, s.place.lng, s.place.label, weatherOk]);

  const { next, list, maghrib } = useMemo(() => {
    const today = computeDay(now, s.place, s.method, s.madhab, s.prayer);
    const tomorrow = computeDay(new Date(now.getTime() + 86400000), s.place, s.method, s.madhab, s.prayer);
    return { next: withStates(today, now, tomorrow[0].time).next, list: today, maghrib: today.find((x) => x.key === 'maghrib')?.time };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Math.floor(now.getTime() / 60000), s.place, s.method, s.madhab, s.prayer]);

  const period = periodFor(now);
  const pool = REFLECTIONS[period];
  const aiKey = `${dayKey(now)}-${period}`;
  const reflection = aiOk && aiText?.key === aiKey ? aiText.text : pool[reflIdx % pool.length];
  const refresh = async (force = true) => {
    if (aiUnavailable || aiBusy || !aiOk) {
      setReflIdx((i) => i + 1);
      return;
    }
    setAiBusy(true);
    try {
      const text = await askBilal({ mode: 'reflection', period });
      setAiText({ key: aiKey, text });
    } catch (e) {
      if (e instanceof BilalError && (e.code === 'not_configured' || e.code === 'auth' || e.code === 'unavailable' || e.code === 'quota')) aiUnavailable = true;
      if (force) setReflIdx((i) => i + 1);
    } finally {
      setAiBusy(false);
    }
  };
  useEffect(() => {
    if (aiOk && aiText?.key !== aiKey && !aiUnavailable) void refresh(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiKey, aiOk]);

  let greg = now.toDateString();
  try {
    greg = now.toLocaleDateString(LOCALE[s.lang] ?? 'fr-CH', { weekday: 'long', day: 'numeric', month: 'long' });
  } catch {}
  const hijri = formatHijri(now, s.lang, s.hijriOffset);
  const today = dayKey(now);
  const prayedToday = g.prayed[today] ?? [];
  const names = Object.fromEntries(list.map((p) => [p.key, tr[p.key]])) as Record<PrayerKey, string>;
  const dhikrToday = g.days[today] ?? 0;
  const st = streak((k) => (g.days[k] ?? 0) > 0, new Date(), neutral);
  const kahfTime = kahfReminder && isKahfTime(now, maghrib);
  const greet = now.getHours() < 17 ? tr.greet_morning : tr.greet_evening;
  const doy = dayOfYear(now);
  const verse = QURAN_DUAS[doy % QURAN_DUAS.length];
  const dua = DUAS_LIST[(doy * 7) % DUAS_LIST.length];
  const vv = quranDuaView(verse, uiL);
  const dv = duaView(dua, uiL);
  const wm = weather ? wmo(weather.code, weather.isDay) : null;
  const temp = (c: number) => Math.round(unit === 'C' ? c : (c * 9) / 5 + 32);

  // Pratique tijanie du jour (clé `tijani-done` : `${jour}-${id}` → étapes cochées)
  const practice = PRACTICES.filter((p) => p.id !== 'hailala' || now.getDay() === 5).map((p) => ({ p, done: (tijaniDone[practiceDoneKey(today, p.id)] ?? []).length, total: p.steps.length }));

  // Reprendre
  const lastZikr = [...zikrs].filter((z) => z.items.length).sort((a, c) => (a.updatedAt < c.updatedAt ? 1 : -1))[0];
  const surah = quranLast ? SURAHS.find((x) => x[0] === quranLast.n) : undefined;
  const currentDhikr = content.find((c) => c.id === tasbih.dhikrId);

  const go = (h: Href) => () => {
    tapHaptic('select');
    router.push(h);
  };

  const hero = (
    <FadeIn>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${tr.next_prayer} : ${tr[next.key]} ${hhmm(next.time)}, ${tr.in} ${countdown(next.time.getTime() - now.getTime())}`}
        onPress={go('/prayers')}
        style={({ pressed }) => ({ backgroundColor: b.hero, borderRadius: 24, overflow: 'hidden', transform: [{ scale: pressed ? 0.99 : 1 }] })}
      >
        <View style={{ padding: 18, paddingBottom: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: b.gold, fontSize: 11, fontWeight: '800', letterSpacing: 1.4 }}>{tr.next_prayer.toUpperCase()}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10, marginTop: 2 }}>
                <Text style={{ color: b.heroText, fontSize: 30, fontWeight: '800', letterSpacing: -0.5 }}>{tr[next.key]}</Text>
                <Arabic size={22} style={{ color: b.gold, textAlign: 'left', lineHeight: 34 }}>
                  {AR_NAMES[next.key]}
                </Arabic>
              </View>
              <Text style={{ color: b.heroMuted, fontSize: 14 }}>
                <Ionicons name="location-outline" size={13} color={b.heroMuted} /> {s.place.label}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ color: b.heroText, fontSize: 34, fontWeight: '300', fontVariant: ['tabular-nums'] }}>{hhmm(next.time)}</Text>
              <View style={{ backgroundColor: alpha(b.gold, 0.18), borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
                <Text style={{ color: b.gold, fontWeight: '800', fontSize: 13 }}>
                  {tr.in} {countdown(next.time.getTime() - now.getTime())}
                </Text>
              </View>
            </View>
          </View>
        </View>
        <View style={{ paddingHorizontal: 12 }}>
          <SkyArc list={list} now={now} names={names} />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 14 }}>
          {FARD.map((k) => {
            const done = prayedToday.includes(k);
            const isNext = next.key === k;
            return (
              <View key={k} style={{ alignItems: 'center', gap: 4, minWidth: 48 }} accessibilityLabel={`${tr[k]} ${done ? '✓' : ''}`}>
                <View
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 13,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: done ? b.gold : 'transparent',
                    borderWidth: 1.5,
                    borderColor: done ? b.gold : isNext ? b.gold : alpha('#FFFFFF', 0.35),
                  }}
                >
                  {done ? <Ionicons name="checkmark" size={15} color={b.greenDeep} /> : null}
                </View>
                <Text style={{ color: isNext ? b.gold : b.heroMuted, fontSize: 12, fontWeight: isNext ? '800' : '600' }}>{tr[k]}</Text>
              </View>
            );
          })}
        </View>
      </Pressable>
    </FadeIn>
  );

  const practiceCard = (
    <FadeIn delay={60}>
      <SectionHeader title={tr.today_practice} action={tr.see_all} onAction={go('/tijani')} />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {practice.map(({ p, done, total }) => (
          <Pressable
            key={p.id}
            accessibilityRole="button"
            accessibilityLabel={`${p.name} : ${done} / ${total}`}
            onPress={go(`/tijani?tab=${p.id}`)}
            style={({ pressed }) => ({ flex: 1, backgroundColor: b.paper, borderRadius: 18, borderWidth: 1, borderColor: b.line, padding: 12, alignItems: 'center', gap: 6, opacity: pressed ? 0.9 : 1 })}
          >
            <ProgressRing size={58} progress={total ? done / total : 0} color={p.id === 'wazifa' ? b.wazifa : p.id === 'hailala' ? b.hailala : b.green}>
              <Text style={{ color: b.ink, fontWeight: '800', fontSize: 14 }}>
                {done}/{total}
              </Text>
            </ProgressRing>
            <Text style={{ color: b.ink, fontWeight: '700', fontSize: 14 }} numberOfLines={2} maxFontSizeMultiplier={1.4}>
              {p.name}
            </Text>
          </Pressable>
        ))}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${tr.streak} : ${st} ${tr.days}. ${L('{n} dhikr', { n: dhikrToday })}`}
          onPress={go('/journey')}
          style={({ pressed }) => ({ flex: 1, backgroundColor: b.goldSoft, borderRadius: 18, padding: 12, alignItems: 'center', justifyContent: 'center', gap: 2, opacity: pressed ? 0.9 : 1 })}
        >
          <Ionicons name="flame" size={24} color={b.goldDeep} />
          <Text style={{ color: b.ink, fontWeight: '800', fontSize: 22 }}>{st}</Text>
          <Text style={{ color: b.inkMuted, fontSize: 12, textAlign: 'center' }}>
            {tr.streak} · {tr.days}
          </Text>
        </Pressable>
      </View>
    </FadeIn>
  );

  const resume: { icon: IconName; title: string; sub: string; href: Href; color: string }[] = [];
  if (lastZikr) resume.push({ icon: 'albums', title: lastZikr.name, sub: `${tr.my_zikrs} · ` + L('{n} rép.', { n: totalReps(lastZikr.items) }), href: { pathname: '/zikrs/practice', params: { id: lastZikr.id } }, color: b.violet });
  resume.push({ icon: 'radio-button-on', title: currentDhikr?.transliteration ?? tr.tasbih_title, sub: `${tr.tasbih_title} · ${tasbih.count}${tasbih.target ? ` / ${tasbih.target}` : ''} · ` + L('{n} aujourd’hui', { n: dhikrToday }), href: '/tasbih', color: b.teal });

  // Coran : reprise de lecture (et khatma) + révision de mémorisation du jour
  const kst = qKhatma ? khatmaStatus(qKhatma, today) : null;
  const hq = dailyQueue(qCards, today);
  const hqN = queueSize(hq);
  const tracked = Object.keys(qCards).length;
  const qStreak = readStreak(qDays, today, neutral);
  const lastHref: Href = quranLast ? (quranLast.mode === 'page' ? { pathname: '/quran/mushaf', params: { p: String(quranLast.page ?? pageOf(quranLast.n, quranLast.ayah)) } } : { pathname: '/quran/[n]', params: { n: String(quranLast.n), a: String(quranLast.ayah) } }) : '/quran';
  const quranCard = (
    <FadeIn delay={80}>
      <SectionHeader title="Qur’an" action="Ouvrir" onAction={go('/quran')} />
      <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={surah ? L('Continuer la lecture : {s}, verset {a}', { s: surah[2], a: quranLast!.ayah }) : L('Commencer la lecture du Coran')}
          onPress={go(lastHref)}
          style={({ pressed }) => ({ flex: 1, minWidth: 150, backgroundColor: b.hero, borderRadius: 18, padding: 14, gap: 6, opacity: pressed ? 0.92 : 1 })}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="book" size={18} color={b.gold} />
            <Text style={{ color: b.heroMuted, fontSize: 12, fontWeight: '700', flex: 1 }} numberOfLines={1}>
              Continuer la lecture
            </Text>
          </View>
          <Text style={{ color: b.heroText, fontWeight: '800', fontSize: 16 }} numberOfLines={2} maxFontSizeMultiplier={1.4}>
            {surah ? `${surah[2]} · ${quranLast!.n}:${quranLast!.ayah}` : 'Al-Fātiḥa'}
          </Text>
          <Text style={{ color: b.heroMuted, fontSize: 12 }} numberOfLines={2} maxFontSizeMultiplier={1.4}>
            {kst && !kst.finished ? `${L('Khatma {p} %', { p: Math.round(kst.progress * 100) })} · ${kst.today ? L('p. {a}–{b}', { a: kst.today.from, b: kst.today.to }) : ''}` : surah ? L('Page {p} · {n} j de suite', { p: quranLast!.page ?? pageOf(quranLast!.n, quranLast!.ayah), n: qStreak.current }) : L('Mushaf, récitation, tafsir')}
          </Text>
          {kst && !kst.finished ? (
            <View style={{ height: 4, borderRadius: 2, backgroundColor: alpha(b.heroText, 0.15), overflow: 'hidden' }}>
              <View style={{ width: `${Math.round(kst.progress * 100)}%`, height: 4, backgroundColor: b.gold }} />
            </View>
          ) : null}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tracked ? L('Révision du jour : {n} versets', { n: hqN }) : L('Commencer la mémorisation')}
          onPress={go(tracked && hqN ? { pathname: '/quran/hifz-session', params: { mode: 'review' } } : '/quran/hifz')}
          style={({ pressed }) => ({ flex: 1, minWidth: 150, backgroundColor: b.paper, borderWidth: 1, borderColor: b.line, borderRadius: 18, padding: 14, gap: 6, opacity: pressed ? 0.92 : 1 })}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="school" size={18} color={b.green} />
            <Text style={{ color: b.inkMuted, fontSize: 12, fontWeight: '700', flex: 1 }} numberOfLines={1}>
              Révision du jour
            </Text>
          </View>
          <Text style={{ color: b.ink, fontWeight: '800', fontSize: 16 }} numberOfLines={2} maxFontSizeMultiplier={1.4}>
            {tracked ? (hqN ? L('Versets à réviser : {n}', { n: hqN }) : L('À jour ✓')) : L('Mémoriser le Coran')}
          </Text>
          <Text style={{ color: b.inkMuted, fontSize: 12 }} numberOfLines={2} maxFontSizeMultiplier={1.4}>
            {tracked ? L('Sabaq {a} · Sabqi {b} · Manzil {c}', { a: hq.sabaq.length, b: hq.sabqi.length, c: hq.manzil.length }) : L('Répétition, masquage, révision espacée')}
          </Text>
        </Pressable>
      </View>
    </FadeIn>
  );

  const resumeCard = (
    <FadeIn delay={100}>
      <SectionHeader title={tr.continue_where} />
      <LCard style={{ paddingVertical: 6 }}>
        {resume.map((r, i) => (
          <Pressable
            key={r.title + i}
            accessibilityRole="button"
            accessibilityLabel={`${r.title}. ${r.sub}`}
            onPress={go(r.href)}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, borderTopWidth: i ? 1 : 0, borderTopColor: b.line, opacity: pressed ? 0.7 : 1 })}
          >
            <IconBadge icon={r.icon} color={r.color} size={38} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: b.ink, fontWeight: '700', fontSize: 15 }} numberOfLines={1}>
                {r.title}
              </Text>
              <LMuted numberOfLines={1}>{r.sub}</LMuted>
            </View>
            <Ionicons name="play-circle" size={28} color={r.color} />
          </Pressable>
        ))}
      </LCard>
    </FadeIn>
  );

  const myZikrs = [...zikrs].sort((a, c) => (a.updatedAt < c.updatedAt ? 1 : -1)).slice(0, 6);
  const zikrsCard = (
    <FadeIn delay={140}>
      <SectionHeader title={tr.my_zikrs} action={zikrs.length ? tr.see_all : undefined} onAction={go('/zikrs')} />
      {myZikrs.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 4 }}>
          {myZikrs.map((z) => (
            <Pressable
              key={z.id}
              accessibilityRole="button"
              accessibilityLabel={L('{name}, {n} formules', { name: z.name, n: z.items.length })}
              onPress={go(z.items.length ? { pathname: '/zikrs/practice', params: { id: z.id } } : { pathname: '/zikrs/edit', params: { id: z.id } })}
              style={({ pressed }) => ({ width: 168, backgroundColor: b.paper, borderRadius: 18, borderWidth: 1, borderColor: b.line, padding: 14, gap: 8, opacity: pressed ? 0.9 : 1 })}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <IconBadge icon="albums" color={b.violet} size={34} />
                <Ionicons name="play" size={18} color={b.green} />
              </View>
              <Text style={{ color: b.ink, fontWeight: '700' }} numberOfLines={2}>
                {z.name}
              </Text>
              <LMuted>
                {L(z.items.length > 1 ? '{n} formules · {r} rép.' : '{n} formule · {r} rép.', { n: z.items.length, r: totalReps(z.items) })}
              </LMuted>
            </Pressable>
          ))}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={L("Composer un zikr")}
            onPress={go('/zikrs/edit')}
            style={({ pressed }) => ({ width: 120, borderRadius: 18, borderWidth: 1.5, borderStyle: 'dashed', borderColor: b.line, alignItems: 'center', justifyContent: 'center', gap: 6, opacity: pressed ? 0.8 : 1 })}
          >
            <Ionicons name="add-circle" size={30} color={b.green} />
            <Text style={{ color: b.green, fontWeight: '700' }}>Composer</Text>
          </Pressable>
        </ScrollView>
      ) : (
        <LCard onPress={go('/zikrs/edit')} label="Composer mon premier zikr" style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <IconBadge icon="add" color={b.green} size={44} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: b.ink, fontWeight: '800', fontSize: 15 }}>Composez votre premier zikr</Text>
            <LMuted>Assemblez Noms d’Allah, du‘as, versets et salawat, avec le calcul abjad.</LMuted>
          </View>
          <Ionicons name="chevron-forward" size={18} color={b.inkMuted} />
        </LCard>
      )}
    </FadeIn>
  );

  const dailyCards = (
    <FadeIn delay={180}>
      <SectionHeader title={tr.verse_of_day} />
      <LCard onPress={go(`/quran/${verse.surah}`)} label={`${tr.verse_of_day} : ${vv.title}, ${verse.ref}`}>
        <Arabic size={24} quran style={{ color: b.ink }}>
          {verse.ar}
        </Arabic>
        {vv.meaning ? <Text style={{ color: b.ink, fontSize: 15, lineHeight: 22, marginTop: 6 }}>{vv.meaning}</Text> : null}
        <Text style={{ color: b.goldDeep, fontWeight: '700', fontSize: 12, marginTop: 8 }}>
          {[vv.title, verse.ref, vv.translation].filter(Boolean).join(' · ')}
        </Text>
      </LCard>
      <SectionHeader title={tr.dua_of_day} action={tr.see_all} onAction={go('/duas')} />
      <LCard onPress={go({ pathname: '/duas', params: { q: dua.title } })} label={`${tr.dua_of_day} : ${dv.title}`}>
        <Text style={{ color: b.ink, fontWeight: '800', fontSize: 15, marginBottom: 4 }}>{dv.title}</Text>
        <Arabic size={21} numberOfLines={3}>
          {dua.ar}
        </Arabic>
        {dv.meaning ? (
          <LMuted style={{ marginTop: 4 }} numberOfLines={3}>
            {dv.meaning}
          </LMuted>
        ) : null}
        <Text style={{ color: b.goldDeep, fontWeight: '700', fontSize: 12, marginTop: 8 }}>{dua.ref}</Text>
      </LCard>
    </FadeIn>
  );

  // 4 colonnes partout : en deux colonnes la grille n'occupe que la moitié droite (libellés tronqués à 8).
  const cols = 4;
  const explore: { icon: IconName; label: string; href: Href; color: string }[] = [
    { icon: 'book', label: 'Qur’an', href: '/quran', color: b.green },
    { icon: 'hand-left', label: 'Du‘as', href: '/duas', color: b.blue },
    { icon: 'sparkles', label: '99 Noms', href: '/names', color: b.goldDeep },
    { icon: 'compass', label: tr.tab_qibla, href: '/qibla', color: b.teal },
    { icon: 'leaf', label: 'Tijaniyya', href: '/tijani', color: b.wirdGreen },
    { icon: 'calculator', label: 'Abjad', href: '/abjad', color: b.rust },
    { icon: 'people', label: tr.community, href: '/community', color: b.violet },
    { icon: 'grid', label: tr.tab_more, href: '/more', color: b.inkMuted },
  ];
  const exploreCard = (
    <FadeIn delay={220}>
      <SectionHeader title={tr.explore} />
      <Grid cols={cols} gap={8}>
        {explore.map((x) => (
          <Pressable
            key={x.label}
            accessibilityRole="button"
            accessibilityLabel={x.label}
            onPress={go(x.href)}
            style={({ pressed }) => ({ alignItems: 'center', gap: 6, paddingVertical: 10, borderRadius: 16, backgroundColor: pressed ? alpha(x.color, 0.08) : 'transparent' })}
          >
            <IconBadge icon={x.icon} color={x.color} size={50} />
            <Text style={{ color: b.ink, fontSize: 12, fontWeight: '600', textAlign: 'center' }} numberOfLines={2} maxFontSizeMultiplier={1.4}>
              {x.label}
            </Text>
          </Pressable>
        ))}
      </Grid>
    </FadeIn>
  );

  const extras = (
    <FadeIn delay={260}>
      {kahfTime ? (
        <LCard onPress={go('/kahf')} label={tr.kahf} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: b.greenTint, borderColor: b.greenTint, marginTop: 12 }}>
          <IconBadge icon="book" color={b.green} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: b.ink, fontWeight: '800' }}>Jumu‘a mubaraka</Text>
            <LMuted>Pensez à la sourate al-Kahf et à multiplier les salawat.</LMuted>
          </View>
          <Ionicons name="chevron-forward" size={18} color={b.inkMuted} />
        </LCard>
      ) : null}
      <SectionHeader title={PERIODS[period].title} action="Parler avec Bilal" onAction={go('/bilal')} />
      <LCard>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <IconBadge icon="sparkles" color={b.purple} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: b.ink, fontSize: 15, lineHeight: 23 }}>{reflection}</Text>
            <LMuted style={{ marginTop: 6 }}>Un mot de Bilal · {tr.reflection}</LMuted>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={L("Nouvelle réflexion")} onPress={() => void refresh(true)} hitSlop={8} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
            {aiBusy ? <ActivityIndicator color={b.inkMuted} size="small" /> : <Ionicons name="refresh" size={20} color={b.inkMuted} />}
          </Pressable>
        </View>
      </LCard>
      <LCard style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }} label={tr.weather}>
        <IconBadge icon={((wm?.icon?.replace('-outline', '') ?? 'cloud') as IconName)} color={weather?.isDay === false ? b.indigo : b.wazifa} />
        <View style={{ flex: 1 }}>
          {!consentReady ? null : undecided(consent, 'weather') ? (
            <View testID="weather-consent" style={{ gap: 8 }}>
              <Text style={{ color: b.ink, fontWeight: '800', fontSize: 16 }}>{pt.weather_title}</Text>
              <LMuted>{pt.weather_text}</LMuted>
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                <Pressable accessibilityRole="button" onPress={() => choose('weather', true)} style={{ backgroundColor: b.green, borderRadius: 18, paddingHorizontal: 14, minHeight: 36, justifyContent: 'center' }}>
                  <Text style={{ color: b.onGreen, fontWeight: '700' }}>{pt.weather_accept}</Text>
                </Pressable>
                <Pressable accessibilityRole="button" onPress={() => choose('weather', false)} style={{ borderRadius: 18, borderWidth: 1, borderColor: b.line, paddingHorizontal: 14, minHeight: 36, justifyContent: 'center' }}>
                  <Text style={{ color: b.ink, fontWeight: '600' }}>{pt.weather_decline}</Text>
                </Pressable>
              </View>
            </View>
          ) : !weatherOk ? (
            <LMuted>{pt.weather_off}</LMuted>
          ) : weather ? (
            <>
              <Text style={{ color: b.ink, fontWeight: '800', fontSize: 18 }}>
                {temp(weather.temp)}°{unit} <Text style={{ color: b.inkMuted, fontWeight: '500', fontSize: 14 }}>· {wm?.label}</Text>
              </Text>
              <LMuted>
                {weather.city ?? s.place.label}
                {weather.max != null && weather.min != null ? ` · ↑${temp(weather.max)}° ↓${temp(weather.min)}°` : ''}
              </LMuted>
            </>
          ) : wErr ? (
            <LMuted>Météo indisponible hors ligne</LMuted>
          ) : (
            <View style={{ gap: 6 }}>
              <Skeleton w={120} h={16} />
              <Skeleton w={180} h={12} />
            </View>
          )}
        </View>
      </LCard>
      {s.place.source === 'example' ? (
        <LCard onPress={go('/settings')} label="Régler mon lieu" style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: b.goldSoft, borderColor: b.goldSoft }}>
          <IconBadge icon="location" color={b.goldDeep} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: b.ink, fontWeight: '800' }}>{tr.example_location}</Text>
            <LMuted>Pour des horaires et une qibla exacts.</LMuted>
          </View>
        </LCard>
      ) : null}
    </FadeIn>
  );

  return (
    <View style={{ flex: 1, backgroundColor: b.cream }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 10, paddingBottom: 40 + insets.bottom }}>
        <Container max={wide ? 1180 : 760} style={{ paddingHorizontal: tablet ? 28 : 16 }}>
          {/* Barre du haut */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: b.inkMuted, fontSize: 13, fontWeight: '600' }} numberOfLines={2} maxFontSizeMultiplier={1.4}>
                {greg} · {hijri}
              </Text>
              <Text accessibilityRole="header" style={{ color: b.ink, fontSize: 26, fontWeight: '800', letterSpacing: -0.5 }}>
                {greet} <Text style={{ color: b.goldDeep }}>·</Text> <Text style={{ fontFamily: 'Amiri_400Regular', fontWeight: '400', color: b.green }}>السلام عليكم</Text>
              </Text>
            </View>
            <RoundBtn icon="search" label={tr.search} onPress={go('/search')} />
            <RoundBtn icon="settings-outline" label={tr.settings_title} onPress={go('/settings')} />
          </View>
          <View style={{ marginBottom: 12, flexDirection: 'row' }}>
            <BleStatusChip />
          </View>
          {wide ? (
            <View style={{ flexDirection: 'row', gap: 24, alignItems: 'flex-start' }}>
              <View style={{ flex: 1.1 }}>
                {hero}
                {practiceCard}
                {quranCard}
                {resumeCard}
                {extras}
              </View>
              <View style={{ flex: 1 }}>
                {exploreCard}
                {zikrsCard}
                {dailyCards}
              </View>
            </View>
          ) : (
            <>
              {hero}
              {practiceCard}
              {quranCard}
              {resumeCard}
              {zikrsCard}
              {exploreCard}
              {dailyCards}
              {extras}
            </>
          )}
        </Container>
      </ScrollView>
    </View>
  );
}

function RoundBtn({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }): ReactNode {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, backgroundColor: b.paper, borderWidth: 1, borderColor: b.line, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}
    >
      <Ionicons name={icon} size={20} color={b.ink} />
    </Pressable>
  );
}
