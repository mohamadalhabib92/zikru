import { Stack, useRouter, type Href } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { DUAS_LIST } from '@/lib/duas';
import { NAMES } from '@/lib/names';
import { QURAN_DUAS } from '@/lib/quran-duas';
import { SALAWAT } from '@/lib/salawat';
import { useSettings } from '@/lib/settings';
import { SURAHS } from '@/lib/surahs';
import { useZikrs } from '@/lib/zikrs';
import { Container, IconBadge, SectionHeader, tapHaptic } from '@/ui/ds';
import { Ionicons, type IconName } from '@/ui/kit';
import { Arabic, LMuted } from '@/ui/light';
import { brand as b } from '@/ui/theme';

/** Normalise : sans accents, sans diacritiques arabes, sans apostrophes. */
const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
    .replace(/[‘’ʿʾ'`\-·]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .toLowerCase();

type Hit = { key: string; icon: IconName; color: string; title: string; sub?: string; ar?: string; href?: Href; expand?: string };

const SECTIONS: { title: string; kw: string; href: Href; icon: IconName }[] = [
  { title: 'Horaires de prière', kw: 'priere salat horaires adhan', href: '/prayers', icon: 'time' },
  { title: 'Tasbih', kw: 'tasbih compteur chapelet misbaha', href: '/tasbih', icon: 'radio-button-on' },
  { title: 'Qibla', kw: 'qibla boussole kaaba direction', href: '/qibla', icon: 'compass' },
  { title: 'Calculateur abjad', kw: 'abjad calcul mashriqi maghribi', href: '/abjad', icon: 'calculator' },
  { title: 'Tariqa Tijaniyya', kw: 'tijani tijaniyya wird wazifa haylala hailala', href: '/tijani', icon: 'leaf' },
  { title: 'Communauté', kw: 'communaute cercle famille live', href: '/community', icon: 'people' },
  { title: 'Sourate al-Kahf', kw: 'kahf vendredi jumua', href: '/kahf', icon: 'headset' },
  { title: 'Hadiths', kw: 'hadith sunna', href: '/hadiths', icon: 'library' },
  { title: 'Fiqh', kw: 'fiqh maliki shafii jurisprudence', href: '/fiqh', icon: 'scale' },
  { title: 'Réglages', kw: 'reglages parametres langue theme sombre clair', href: '/settings', icon: 'settings' },
  { title: 'Compteur Bluetooth', kw: 'bluetooth bague ring compteur', href: '/ring', icon: 'bluetooth' },
  { title: 'Mes zikrs', kw: 'mes zikrs composer', href: '/zikrs', icon: 'albums' },
];

/** Recherche globale : Noms, du‘as, versets-du‘as, salawat, sourates, zikrs, sections ; + versets en ligne. */
export default function Search() {
  const router = useRouter();
  const { t: tr } = useSettings();
  const { zikrs } = useZikrs();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [online, setOnline] = useState<{ ref: string; text: string; n: number }[] | null>(null);
  const [busy, setBusy] = useState(false);

  const nq = norm(q.trim());
  const groups = useMemo(() => {
    if (nq.length < 2) return [] as { title: string; hits: Hit[] }[];
    const has = (...xs: (string | undefined)[]) => norm(xs.filter(Boolean).join(' ')).includes(nq);
    const out: { title: string; hits: Hit[] }[] = [];
    const push = (title: string, hits: Hit[]) => hits.length && out.push({ title, hits: hits.slice(0, 8) });
    push('Sections', SECTIONS.filter((x) => has(x.title, x.kw)).map((x) => ({ key: `s${x.title}`, icon: x.icon, color: b.inkMuted, title: x.title, href: x.href })));
    push(
      tr.my_zikrs,
      zikrs.filter((z) => has(z.name, z.niyya)).map((z) => ({ key: z.id, icon: 'albums', color: b.violet, title: z.name, sub: `${z.items.length} formule(s)`, href: { pathname: '/zikrs/practice', params: { id: z.id } } })),
    );
    push(
      'Noms d’Allah',
      NAMES.filter((x) => has(x.tr, x.fr, x.ar) || String(x.n) === nq).map((x) => ({ key: `n${x.n}`, icon: 'sparkles', color: b.goldDeep, title: `${x.n}. ${x.tr}`, sub: x.fr, ar: x.ar, href: { pathname: '/names', params: { q: x.tr } } })),
    );
    push(
      'Sourates',
      SURAHS.filter((x) => has(x[2], x[3], x[1]) || String(x[0]) === nq).map((x) => ({ key: `q${x[0]}`, icon: 'book', color: b.green, title: `${x[0]}. ${x[2]}`, sub: `${x[3]} · ${x[4]} versets`, ar: x[1], href: `/quran/${x[0]}` })),
    );
    push(
      'Du‘as prophétiques',
      DUAS_LIST.filter((d) => has(d.title, d.fr, d.tr, d.ar, d.when, d.ref)).map((d) => ({ key: d.id, icon: 'hand-left', color: b.blue, title: d.title, sub: d.ref, ar: d.ar, href: { pathname: '/duas', params: { q: d.title } } })),
    );
    push(
      'Du‘as du Coran',
      QURAN_DUAS.filter((d) => has(d.title, d.fr, d.tr, d.ar, d.ref, d.who)).map((d) => ({ key: d.id, icon: 'book', color: b.wirdGreen, title: d.title, sub: `${d.ref} · trad. Hamidullah`, ar: d.ar, href: `/quran/${d.surah}` })),
    );
    push(
      'Salawat',
      SALAWAT.filter((d) => has(d.title, d.fr, d.tr, d.ar, d.ref)).map((d) => ({ key: d.id, icon: 'heart', color: b.rust, title: d.title, sub: d.ref, ar: d.ar, expand: `${d.tr}\n\n${d.fr}` })),
    );
    return out;
  }, [nq, zikrs, tr.my_zikrs]);

  useEffect(() => setOnline(null), [nq]);
  const searchOnline = async () => {
    setBusy(true);
    try {
      const r = await fetch(`https://api.alquran.cloud/v1/search/${encodeURIComponent(q.trim())}/all/fr.hamidullah`);
      const j = await r.json();
      const m = (j?.data?.matches ?? []) as { text: string; surah: { number: number; englishName: string }; numberInSurah: number }[];
      setOnline(m.slice(0, 30).map((x) => ({ n: x.surah.number, ref: `${x.surah.englishName} ${x.surah.number}:${x.numberInSurah}`, text: x.text })));
    } catch {
      setOnline([]);
    } finally {
      setBusy(false);
    }
  };

  const total = groups.reduce((a, g) => a + g.hits.length, 0);
  return (
    <View style={{ flex: 1, backgroundColor: b.cream }}>
      <Stack.Screen options={{ title: tr.search }} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}>
        <Container max={820} style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 50, paddingHorizontal: 14, borderRadius: 14, backgroundColor: b.paper, borderWidth: 1.5, borderColor: b.green }}>
            <Ionicons name="search" size={18} color={b.green} />
            <TextInput
              autoFocus
              value={q}
              onChangeText={setQ}
              placeholder={tr.search_ph}
              placeholderTextColor={b.inkMuted}
              accessibilityLabel={tr.search}
              returnKeyType="search"
              autoCorrect={false}
              style={{ flex: 1, color: b.ink, fontSize: 16, paddingVertical: 10 }}
            />
            {q ? (
              <Pressable accessibilityLabel="Effacer" onPress={() => setQ('')} hitSlop={10}>
                <Ionicons name="close-circle" size={20} color={b.inkMuted} />
              </Pressable>
            ) : null}
          </View>

          {nq.length < 2 ? (
            <View style={{ marginTop: 18 }}>
              <SectionHeader title="Suggestions" />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {['Ar-Rahman', 'matin', 'voyage', 'Yasin', 'istighfar', 'Ibrahimiyya', 'pardon', 'Kahf'].map((x) => (
                  <Pressable key={x} accessibilityRole="button" onPress={() => setQ(x)} style={{ paddingHorizontal: 14, minHeight: 40, justifyContent: 'center', borderRadius: 20, backgroundColor: b.paper, borderWidth: 1, borderColor: b.line }}>
                    <Text style={{ color: b.ink, fontWeight: '600' }}>{x}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : (
            <>
              {total === 0 ? (
                <View style={{ alignItems: 'center', paddingVertical: 28, gap: 8 }}>
                  <Ionicons name="search-outline" size={34} color={b.inkMuted} />
                  <Text style={{ color: b.ink, fontWeight: '700' }}>{tr.no_results}</Text>
                </View>
              ) : null}
              {groups.map((g) => (
                <View key={g.title}>
                  <SectionHeader title={g.title} />
                  <View style={{ backgroundColor: b.paper, borderRadius: 16, borderWidth: 1, borderColor: b.line, overflow: 'hidden' }}>
                    {g.hits.map((h, i) => (
                      <View key={h.key} style={{ borderTopWidth: i ? 1 : 0, borderTopColor: b.line }}>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={h.sub ? `${h.title}. ${h.sub}` : h.title}
                          onPress={() => {
                            tapHaptic('select');
                            if (h.href) router.push(h.href);
                            else setOpen((o) => (o === h.key ? null : h.key));
                          }}
                          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, minHeight: 56, backgroundColor: pressed ? b.cream : 'transparent' })}
                        >
                          <IconBadge icon={h.icon} color={h.color} size={36} />
                          <View style={{ flex: 1 }}>
                            <Text style={{ color: b.ink, fontWeight: '700' }} numberOfLines={1}>
                              {h.title}
                            </Text>
                            {h.sub ? <LMuted numberOfLines={1}>{h.sub}</LMuted> : null}
                          </View>
                          {h.ar ? (
                            <Arabic size={18} numberOfLines={1} style={{ maxWidth: '40%', color: b.goldDeep }}>
                              {h.ar}
                            </Arabic>
                          ) : null}
                          <Ionicons name={h.href ? 'chevron-forward' : open === h.key ? 'chevron-up' : 'chevron-down'} size={16} color={b.inkMuted} />
                        </Pressable>
                        {open === h.key && h.expand ? (
                          <View style={{ paddingHorizontal: 14, paddingBottom: 14 }}>
                            {h.ar ? <Arabic size={22}>{h.ar}</Arabic> : null}
                            <Text style={{ color: b.ink, lineHeight: 21, marginTop: 6 }}>{h.expand}</Text>
                          </View>
                        ) : null}
                      </View>
                    ))}
                  </View>
                </View>
              ))}
              <SectionHeader title="Versets du Coran (en ligne)" />
              {online === null ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={searchOnline}
                  disabled={busy}
                  style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 48, borderRadius: 14, backgroundColor: b.greenTint, opacity: pressed ? 0.8 : 1 })}
                >
                  {busy ? <ActivityIndicator color={b.green} /> : <Ionicons name="globe-outline" size={18} color={b.green} />}
                  <Text style={{ color: b.green, fontWeight: '700' }}>Chercher « {q.trim()} » dans la traduction Hamidullah</Text>
                </Pressable>
              ) : online.length === 0 ? (
                <LMuted>{tr.no_results} (ou hors ligne).</LMuted>
              ) : (
                <View style={{ backgroundColor: b.paper, borderRadius: 16, borderWidth: 1, borderColor: b.line }}>
                  {online.map((v, i) => (
                    <Pressable key={v.ref + i} accessibilityRole="button" onPress={() => router.push(`/quran/${v.n}`)} style={{ padding: 12, borderTopWidth: i ? 1 : 0, borderTopColor: b.line }}>
                      <Text style={{ color: b.goldDeep, fontWeight: '800', fontSize: 12 }}>{v.ref}</Text>
                      <Text style={{ color: b.ink, lineHeight: 21 }} numberOfLines={4}>
                        {v.text}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </>
          )}
        </Container>
      </ScrollView>
    </View>
  );
}
