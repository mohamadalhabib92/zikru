import { useRouter, type Href } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, TextInput, View } from 'react-native';
import { Text } from '@/ui/Text';
import { useTranslationId } from '@/components/quran/data';
import { dayKey } from '@/lib/dates';
import { khatmaStatus, streak } from '@/lib/khatma';
import { useDispense } from '@/lib/dispense-context';
import { normLat, searchVerses, type VerseHit } from '@/lib/quran-offline';
import { hizbPage, hizbRange, juzPage, juzRange, pageOf, pageRange, parseRef, surahPage, fromIndex, OFFSETS } from '@/lib/quran-nav';
import { hifzCards, khatma, lastRead, marks, readDays } from '@/lib/quran-store';
import { useShared } from '@/lib/shared-state';
import { dailyQueue, queueSize, rangeStatus } from '@/lib/srs';
import { SURAHS } from '@/lib/surahs';
import { FadeIn, Grid, HeroHeader, ProgressBar, Tile, useLayout } from '@/ui/ds';
import { Ionicons, Segmented } from '@/ui/kit';
import { alpha, brand as b, fonts } from '@/ui/theme';
import { L } from '@/lib/l10n';

type Tab = 'surah' | 'juz' | 'hizb' | 'page';
const STATUS_COLOR = () => ({ none: b.line, learning: b.gold, review: '#D98A2B', memorised: b.green });

/** Accueil du Coran : reprise, recherche, mushaf, mémorisation, khatma, marque-pages ; index par sourate / juz’ / hizb / page. */
export default function QuranHub() {
  const router = useRouter();
  const { cols, tablet } = useLayout();
  const [last] = useShared(lastRead);
  const [k] = useShared(khatma);
  const [days] = useShared(readDays);
  const [cards] = useShared(hifzCards);
  const [m] = useShared(marks);
  const tr = useTranslationId();
  const today = dayKey();
  const { neutral } = useDispense();
  const st = streak(days, today, neutral);
  const kst = k ? khatmaStatus(k, today) : null;
  const due = queueSize(dailyQueue(cards, today));
  const [tab, setTab] = useState<Tab>('surah');
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<{ q: string; list: VerseHit[]; total: number; translated: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const ref = parseRef(q);
  const nq = normLat(q);
  const surahHits = q.trim() && !ref ? SURAHS.filter((s) => normLat(s[2] + ' ' + s[3]).replace(/\s/g, '').includes(nq.replace(/\s/g, '')) || s[1].includes(q.trim())) : [];
  useEffect(() => {
    const t = q.trim();
    if (t.length < 3 || ref) {
      setHits(null);
      return;
    }
    let alive = true;
    setBusy(true);
    const h = setTimeout(() => {
      searchVerses(t, tr.id, 30)
        .then((r) => alive && setHits({ q: t, list: r.hits, total: r.total, translated: r.translated }))
        .finally(() => alive && setBusy(false));
    }, 300);
    return () => {
      alive = false;
      clearTimeout(h);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, tr.id]);

  const go = (h: Href) => router.push(h);
  const openRef = () => {
    if (!ref) return;
    if (ref.kind === 'ayah') go({ pathname: '/quran/[n]', params: { n: String(ref.s), a: String(ref.a) } });
    else if (ref.kind === 'surah') go(`/quran/${ref.s}`);
    else if (ref.kind === 'page') go({ pathname: '/quran/mushaf', params: { p: String(ref.p) } });
    else if (ref.kind === 'juz') go({ pathname: '/quran/mushaf', params: { p: String(juzPage(ref.j)) } });
    else go({ pathname: '/quran/mushaf', params: { p: String(hizbPage(ref.h)) } });
  };
  const refLabel = ref ? (ref.kind === 'ayah' ? L('Aller à {s} {r}', { s: SURAHS[ref.s - 1][2], r: `${ref.s}:${ref.a}` }) : ref.kind === 'surah' ? L('Ouvrir la sourate {n} · {s}', { n: ref.s, s: SURAHS[ref.s - 1][2] }) : ref.kind === 'page' ? L('Ouvrir la page {n}', { n: ref.p }) : ref.kind === 'juz' ? L('Ouvrir le juz’ {n}', { n: ref.j }) : L('Ouvrir le hizb {n}', { n: ref.h })) : '';

  const lastHref: Href | null = last ? (last.mode === 'page' ? { pathname: '/quran/mushaf', params: { p: String(last.page ?? pageOf(last.n, last.ayah)) } } : { pathname: '/quran/[n]', params: { n: String(last.n), a: String(last.ayah) } }) : null;
  const colors = STATUS_COLOR();

  const rows = useMemo(() => {
    if (tab === 'surah') return SURAHS.map((s) => ({ key: `s${s[0]}`, num: s[0], title: s[2], sub: `${s[3]} · ${L('{n} v.', { n: s[4] })} · ${L(s[5] === 'M' ? 'mecquoise' : 'médinoise')} · ${L('p. {n}', { n: surahPage(s[0]) })}`, ar: s[1].replace(/^سُورَةُ\s*/, ''), range: [OFFSETS[s[0] - 1], OFFSETS[s[0] - 1] + s[4]] as [number, number], href: `/quran/${s[0]}` as Href }));
    if (tab === 'juz')
      return Array.from({ length: 30 }, (_, i) => {
        const [a, z] = juzRange(i + 1);
        const [s, v] = fromIndex(a);
        return { key: `j${i}`, num: i + 1, title: L('Juz’ {n}', { n: i + 1 }), sub: `${SURAHS[s - 1][2]} ${s}:${v} · ${L('p. {n}', { n: juzPage(i + 1) })}`, ar: '', range: [a, z] as [number, number], href: { pathname: '/quran/mushaf', params: { p: String(juzPage(i + 1)) } } as Href };
      });
    if (tab === 'hizb')
      return Array.from({ length: 60 }, (_, i) => {
        const [a, z] = hizbRange(i + 1);
        const [s, v] = fromIndex(a);
        return { key: `h${i}`, num: i + 1, title: L('Hizb {n}', { n: i + 1 }), sub: `${SURAHS[s - 1][2]} ${s}:${v} · ${L('p. {n}', { n: hizbPage(i + 1) })}`, ar: '', range: [a, z] as [number, number], href: { pathname: '/quran/mushaf', params: { p: String(hizbPage(i + 1)) } } as Href };
      });
    return Array.from({ length: 604 }, (_, i) => {
      const [a, z] = pageRange(i + 1);
      const [s, v] = fromIndex(a);
      return { key: `p${i}`, num: i + 1, title: L('Page {n}', { n: i + 1 }), sub: `${SURAHS[s - 1][2]} ${s}:${v}`, ar: '', range: [a, z] as [number, number], href: { pathname: '/quran/mushaf', params: { p: String(i + 1) } } as Href };
    });
  }, [tab]);
  const nCols = tablet ? Math.min(3, cols) : 1;

  const header = (
    <View style={{ paddingHorizontal: 16, paddingTop: 12, gap: 14 }}>
      <FadeIn>
        <HeroHeader>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: b.gold, fontFamily: fonts.quran, fontSize: 26, lineHeight: 56 }}>القرآن الكريم</Text>
              <Text style={{ color: b.heroText, fontSize: 22, fontWeight: '900' }}>Le Noble Coran</Text>
              <Text style={{ color: b.heroMuted, marginTop: 2 }}>Texte uthmani · 604 pages · récitation verset par verset</Text>
            </View>
            <View style={{ alignItems: 'center', backgroundColor: alpha(b.heroText, 0.08), borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 }} accessibilityLabel={L('Série de lecture : {n} jours', { n: st.current })}>
              <Ionicons name="flame" size={20} color={b.gold} />
              <Text style={{ color: b.heroText, fontWeight: '900', fontSize: 18 }}>{st.current}</Text>
              <Text style={{ color: b.heroMuted, fontSize: 11 }}>{st.current > 1 ? 'jours' : 'jour'}</Text>
            </View>
          </View>
          {lastHref && last ? (
            <Pressable accessibilityRole="button" accessibilityLabel={L('Continuer : {s}, verset {a}', { s: SURAHS[last.n - 1][2], a: last.ayah })} onPress={() => go(lastHref)} style={({ pressed }) => ({ marginTop: 14, backgroundColor: b.gold, borderRadius: 16, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10, opacity: pressed ? 0.9 : 1 })}>
              <Ionicons name="bookmark" size={20} color="#1B1405" />
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#1B1405', fontWeight: '900' }}>Continuer la lecture</Text>
                <Text style={{ color: '#3A2C0C', fontSize: 12 }}>{`${SURAHS[last.n - 1][2]} · ${last.n}:${last.ayah} · ${L('page {p}', { p: last.page ?? pageOf(last.n, last.ayah) })}${last.mode === 'page' ? L(' · mushaf') : ''}`}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#1B1405" />
            </Pressable>
          ) : null}
          {kst && !kst.finished ? (
            <View style={{ marginTop: 12, gap: 6 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: b.heroText, fontWeight: '700', fontSize: 13 }}>{L('Khatma · {d}/{t} pages', { d: kst.done, t: kst.total })}</Text>
                <Text style={{ color: b.heroMuted, fontSize: 13 }}>{`${Math.round(kst.progress * 100)} %`}</Text>
              </View>
              <ProgressBar progress={kst.progress} color={b.gold} />
            </View>
          ) : null}
        </HeroHeader>
      </FadeIn>

      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: b.paper, borderRadius: 16, borderWidth: 1, borderColor: b.line, paddingHorizontal: 12 }}>
        <Ionicons name="search" size={18} color={b.inkMuted} />
        <TextInput
          value={q}
          onChangeText={setQ}
          onSubmitEditing={openRef}
          returnKeyType="go"
          placeholder={L("Sourate, 2:255, p. 300, juz 30, mot…")}
          placeholderTextColor={b.inkMuted}
          accessibilityLabel={L("Rechercher dans le Coran")}
          style={{ flex: 1, minHeight: 48, color: b.ink, marginLeft: 8, fontSize: 15 }}
        />
        {busy ? <ActivityIndicator color={b.green} /> : q ? (
          <Pressable accessibilityRole="button" accessibilityLabel={L("Effacer")} onPress={() => setQ('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={b.inkMuted} />
          </Pressable>
        ) : null}
      </View>
      {q.trim() ? (
        <View style={{ gap: 8 }}>
          {ref ? (
            <Pressable accessibilityRole="button" onPress={openRef} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: alpha(b.green, 0.1), borderRadius: 14, padding: 12 }}>
              <Ionicons name="arrow-forward-circle" size={20} color={b.green} />
              <Text style={{ color: b.ink, fontWeight: '800', flex: 1 }}>{refLabel}</Text>
            </Pressable>
          ) : null}
          {surahHits.slice(0, 4).map((s) => (
            <Pressable key={s[0]} accessibilityRole="button" onPress={() => go(`/quran/${s[0]}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: b.paper, borderRadius: 14, borderWidth: 1, borderColor: b.line, padding: 12 }}>
              <Text style={{ color: b.green, fontWeight: '900', width: 28 }}>{s[0]}</Text>
              <Text style={{ color: b.ink, fontWeight: '700', flex: 1 }}>{`${s[2]} · ${s[3]}`}</Text>
              <Text style={{ color: b.green, fontFamily: fonts.quran, fontSize: 18 }}>{s[1].replace(/^سُورَةُ\s*/, '')}</Text>
            </Pressable>
          ))}
          {hits?.list.slice(0, 8).map((h) => (
            <Pressable key={`${h.s}:${h.a}`} accessibilityRole="button" onPress={() => go({ pathname: '/quran/[n]', params: { n: String(h.s), a: String(h.a) } })} style={{ backgroundColor: b.paper, borderRadius: 14, borderWidth: 1, borderColor: b.line, padding: 12, gap: 4 }}>
              <Text style={{ color: b.green, fontWeight: '800', fontSize: 12 }}>{`${SURAHS[h.s - 1][2]} ${h.s}:${h.a}`}</Text>
              <Text style={{ color: b.ink, fontFamily: fonts.quran, fontSize: 18, lineHeight: 38, textAlign: 'right', writingDirection: 'rtl' }} numberOfLines={2}>
                {h.ar}
              </Text>
              {h.tr ? <Text style={{ color: b.inkMuted, fontSize: 13 }} numberOfLines={2}>{h.tr}</Text> : null}
            </Pressable>
          ))}
          {hits && hits.total > 8 ? <Text style={{ color: b.inkMuted, fontSize: 12 }}>{L('{n} versets — affinez, ou ouvrez la recherche complète.', { n: hits.total })}</Text> : null}
          {hits && !hits.translated && !/[\u0600-\u06FF]/.test(q) && !surahHits.length ? <Text style={{ color: b.inkMuted, fontSize: 12 }}>La recherche par mot (traduction) nécessite la traduction hors-ligne : Recherche → Télécharger. L’arabe fonctionne toujours.</Text> : null}
        </View>
      ) : null}

      <Grid cols={tablet ? 4 : 2}>
        <Tile icon="book" title="Mushaf" subtitle={L('Mode page · p. {p}', { p: last?.page ?? 1 })} onPress={() => go({ pathname: '/quran/mushaf', params: { p: String(last?.page ?? 1) } })} />
        <Tile icon="school" title="Mémorisation" subtitle={Object.keys(cards).length ? (due ? L('{n} à réviser aujourd’hui', { n: due }) : L('Révision à jour ✓')) : L('Hifz guidé et révision')} color={b.gold} onPress={() => go('/quran/hifz')} />
        <Tile icon="calendar" title="Khatma" subtitle={kst && !kst.finished && kst.today ? L('Wird : p. {a}–{b}', { a: kst.today.from, b: kst.today.to }) : L('Planifier une lecture complète')} color={b.teal} onPress={() => go('/quran/khatma')} />
        <Tile icon="bookmarks" title="Marque-pages" subtitle={L('Marque-pages : {b} · notes : {n}', { b: m.bookmarks.length, n: Object.keys(m.notes).length })} color={b.violet} onPress={() => go('/quran/bookmarks')} />
      </Grid>
      <Segmented
        label="Parcourir par"
        options={[
          { label: 'Sourates', value: 'surah' },
          { label: 'Juz’', value: 'juz' },
          { label: 'Hizb', value: 'hizb' },
          { label: 'Pages', value: 'page' },
        ]}
        value={tab}
        onChange={setTab}
      />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: b.cream }}>
      <FlatList
        key={`${tab}-${nCols}`}
        data={rows}
        numColumns={nCols}
        keyExtractor={(r) => r.key}
        initialNumToRender={20}
        contentContainerStyle={{ maxWidth: 1120, width: '100%', alignSelf: 'center', paddingBottom: 40 }}
        columnWrapperStyle={nCols > 1 ? { gap: 10, paddingHorizontal: 16 } : undefined}
        ListHeaderComponent={header}
        ListHeaderComponentStyle={{ marginBottom: 6 }}
        renderItem={({ item: r }) => {
          const rs = Object.keys(cards).length ? rangeStatus(cards, r.range[0], r.range[1], today) : null;
          const c = rs && rs.known ? colors[rs.status] : null;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${r.title}. ${r.sub}`}
              onPress={() => go(r.href)}
              style={({ pressed }) => ({ flex: 1, marginHorizontal: nCols > 1 ? 0 : 16, marginTop: 8, backgroundColor: pressed ? b.cream : b.paper, borderRadius: 16, borderWidth: 1, borderColor: b.line, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 })}
            >
              <View style={{ width: 38, height: 38, borderRadius: 10, transform: [{ rotate: '45deg' }], borderWidth: 2, borderColor: c ?? b.green, backgroundColor: c ? alpha(c, 0.12) : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: b.green, fontWeight: '900', transform: [{ rotate: '-45deg' }], fontSize: r.num > 99 ? 12 : 14 }}>{r.num}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ color: b.ink, fontWeight: '800', fontSize: 16 }} numberOfLines={1}>
                  {r.title}
                </Text>
                <Text style={{ color: b.inkMuted, fontSize: 12 }} numberOfLines={1}>
                  {r.sub}
                  {rs && rs.known ? ` · ${L('hifz {p} %', { p: Math.round((rs.known / rs.total) * 100) })}` : ''}
                </Text>
              </View>
              {r.ar ? <Text style={{ color: b.green, fontFamily: fonts.quran, fontSize: 18, lineHeight: 36 }}>{r.ar}</Text> : null}
            </Pressable>
          );
        }}
        ListFooterComponent={<Text style={{ color: b.inkMuted, margin: 16, fontSize: 12 }}>Texte : Tanzil Quran Text (uthmani, CC BY 3.0) et métadonnées Tanzil (pages, juz’, hizb). Traductions : alquran.cloud. Audio : EveryAyah.com, Islamic Network.</Text>}
      />
    </View>
  );
}

