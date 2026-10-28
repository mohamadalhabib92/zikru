import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useUthmani } from '@/components/quran/data';
import { gIndex } from '@/lib/quran-nav';
import { BOOKMARK_COLORS, HIGHLIGHTS, marks, removeBookmark } from '@/lib/quran-store';
import { useShared } from '@/lib/shared-state';
import { SURAHS } from '@/lib/surahs';
import { Container } from '@/ui/ds';
import { Ionicons, Segmented } from '@/ui/kit';
import { alpha, brand as b, fonts } from '@/ui/theme';

type Row = { key: string; s: number; a: number; color: string; title: string; body?: string; at: number; onRemove?: () => void };

/** Marque-pages, notes et surlignages, triés du plus récent au plus ancien. */
export default function Bookmarks() {
  const router = useRouter();
  const [m] = useShared(marks);
  const all = useUthmani();
  const [tab, setTab] = useState<'bm' | 'notes' | 'hl'>('bm');
  const parse = (k: string) => k.split(':').map(Number) as [number, number];
  const rows: Row[] =
    tab === 'bm'
      ? m.bookmarks.map((x) => ({ key: x.id, s: x.s, a: x.a, color: x.color, title: x.name || `${SURAHS[x.s - 1][2]} ${x.s}:${x.a}`, at: x.at, onRemove: () => removeBookmark(x.id) }))
      : tab === 'notes'
        ? Object.entries(m.notes).map(([k, n]) => ({ key: k, s: parse(k)[0], a: parse(k)[1], color: b.gold, title: `${SURAHS[parse(k)[0] - 1][2]} ${k}`, body: n.text, at: n.at }))
        : Object.entries(m.hl).map(([k, h]) => ({ key: k, s: parse(k)[0], a: parse(k)[1], color: HIGHLIGHTS.find((x) => x.id === h)?.hex ?? b.gold, title: `${SURAHS[parse(k)[0] - 1][2]} ${k}`, at: 0 }));
  rows.sort((x, y) => y.at - x.at || x.s - y.s || x.a - y.a);
  const empty = { bm: 'Aucun marque-page. Touchez un verset dans le lecteur pour en ajouter un.', notes: 'Aucune note. Touchez un verset pour écrire une réflexion.', hl: 'Aucun surlignage.' }[tab];
  return (
    <ScrollView style={{ flex: 1, backgroundColor: b.cream }} contentContainerStyle={{ paddingBottom: 40 }}>
      <Container max={820} style={{ padding: 16, gap: 12 }}>
        <Segmented
          options={[
            { label: `Marque-pages (${m.bookmarks.length})`, value: 'bm' },
            { label: `Notes (${Object.keys(m.notes).length})`, value: 'notes' },
            { label: `Surlignés (${Object.keys(m.hl).length})`, value: 'hl' },
          ]}
          value={tab}
          onChange={setTab}
        />
        {!rows.length ? <Text style={{ color: b.inkMuted, textAlign: 'center', marginTop: 30 }}>{empty}</Text> : null}
        {rows.map((r) => (
          <Pressable
            key={r.key}
            accessibilityRole="button"
            accessibilityLabel={`${r.title}. Ouvrir le verset`}
            onPress={() => router.push({ pathname: '/quran/[n]', params: { n: String(r.s), a: String(r.a) } })}
            style={({ pressed }) => ({ backgroundColor: b.paper, borderRadius: 18, borderWidth: 1, borderColor: b.line, borderLeftWidth: 5, borderLeftColor: r.color, padding: 14, gap: 6, opacity: pressed ? 0.9 : 1 })}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name={tab === 'bm' ? 'bookmark' : tab === 'notes' ? 'create' : 'color-fill'} size={16} color={r.color} />
              <Text style={{ color: b.ink, fontWeight: '800', flex: 1 }} numberOfLines={1}>
                {r.title}
              </Text>
              {tab === 'bm' ? <Text style={{ color: b.inkMuted, fontSize: 12 }}>{`${r.s}:${r.a}`}</Text> : null}
              {r.onRemove ? (
                <Pressable accessibilityRole="button" accessibilityLabel="Supprimer le marque-page" hitSlop={10} onPress={r.onRemove} style={{ padding: 4 }}>
                  <Ionicons name="trash-outline" size={18} color={b.inkMuted} />
                </Pressable>
              ) : null}
            </View>
            {all ? (
              <Text numberOfLines={2} style={{ color: b.ink, fontFamily: fonts.quran, fontSize: 20, lineHeight: 42, textAlign: 'right', writingDirection: 'rtl', backgroundColor: tab === 'hl' ? alpha(r.color, 0.18) : undefined }}>
                {all[gIndex(r.s, r.a)]}
              </Text>
            ) : null}
            {r.body ? <Text style={{ color: b.inkMuted, fontSize: 14 }}>{r.body}</Text> : null}
          </Pressable>
        ))}
        <Text style={{ color: b.inkMuted, fontSize: 12, marginTop: 6 }}>{`Couleurs : ${BOOKMARK_COLORS.map((c) => c.label).join(', ')}. Tout est enregistré sur cet appareil.`}</Text>
      </Container>
    </ScrollView>
  );
}
