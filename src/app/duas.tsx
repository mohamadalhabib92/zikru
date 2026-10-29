import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { Text } from '@/ui/Text';
import { AbjadBadge, AddToZikrSheet, type DraftItem } from '@/components/zikr/parts';
import { PatternBg } from '@/components/zikru/Pattern';
import { useData } from '@/lib/data';
import { DUA_CATS, DUAS_LIST, duaCatLabel, type Dua } from '@/lib/duas';
import { usePersistentState } from '@/lib/storage';
import { Ionicons, Screen, type IconName } from '@/ui/kit';
import { Arabic, LCard, LMuted, LText, Pill } from '@/ui/light';
import { brand as b } from '@/ui/theme';
import { ProvenanceBadges } from '@/components/zikru/Provenance';
import { L, useUiLang } from '@/lib/l10n';
import { duaView } from '@/lib/i18n-content';

const COLOR = '#2F7FD0';
const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[‘’ʿʾ'\-]/g, '');

function Action({ icon, label, onPress, active, color = COLOR }: { icon: IconName; label: string; onPress: () => void; active?: boolean; color?: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36, paddingHorizontal: 12, borderRadius: 18, borderWidth: 1, borderColor: active ? color : b.line, backgroundColor: active ? color + '18' : b.paper, opacity: pressed ? 0.8 : 1 })}
    >
      <Ionicons name={icon} size={16} color={active ? color : b.inkMuted} />
      <Text style={{ color: active ? color : b.ink, fontWeight: '700', fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

function DuaCard({ d, fav, onFav, onCopy, copied, onTasbih, onZikr }: { d: Dua; fav: boolean; onFav: () => void; onCopy: () => void; copied: boolean; onTasbih: () => void; onZikr: () => void }) {
  const [n, setN] = useState(0);
  const reps = d.reps ?? 0;
  const done = reps > 0 && n >= reps;
  const v = duaView(d, useUiLang());
  return (
    <LCard>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: COLOR, fontWeight: '800', fontSize: 11, letterSpacing: 0.6 }}>{L(duaCatLabel(d.cat)).toUpperCase()}</Text>
          <Text style={{ color: b.ink, fontWeight: '800', fontSize: 16, marginTop: 2 }}>{v.title}</Text>
          {v.when ? <LMuted style={{ fontSize: 12, marginTop: 2 }}>{v.when}</LMuted> : null}
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={L(fav ? 'Retirer des favoris' : 'Ajouter aux favoris')} onPress={onFav} hitSlop={10} style={{ padding: 4 }}>
          <Ionicons name={fav ? 'star' : 'star-outline'} size={22} color={fav ? b.gold : b.inkMuted} />
        </Pressable>
      </View>
      <Arabic size={21} style={{ marginTop: 8 }}>
        {d.ar}
      </Arabic>
      <Text style={{ color: b.brownSoft, fontStyle: 'italic', marginTop: 4, lineHeight: 20 }}>{d.tr}</Text>
      {v.meaning ? <LText style={{ marginTop: 6 }}>{v.meaning}</LText> : null}
      {v.toReview ? <Text style={{ alignSelf: 'flex-start', marginTop: 4, fontSize: 11, fontWeight: '700', color: b.brown, backgroundColor: b.gold + '22', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 }}>{v.translation}</Text> : null}
      {v.note ? <LMuted style={{ marginTop: 6 }}>{v.note}</LMuted> : null}
      <Text style={{ color: b.brown, fontWeight: '800', marginTop: 8, fontSize: 13 }}>{d.ref}</Text>
      <ProvenanceBadges set="duas" id={d.id} />
      <View style={{ marginTop: 8 }}>
        <AbjadBadge ar={d.ar} />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12, alignItems: 'center' }}>
        <Action icon={copied ? 'checkmark' : 'copy-outline'} label={copied ? 'Copié' : 'Copier'} onPress={onCopy} active={copied} color={b.green} />
        <Action icon="albums-outline" label="Ajouter à un zikr" onPress={onZikr} />
        {reps > 0 ? (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={L('Compter : {n} sur {r}', { n, r: reps })}
              onPress={() => setN((x) => (x >= reps ? 1 : x + 1))}
              onLongPress={() => setN(0)}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: done ? b.green : COLOR, opacity: pressed ? 0.85 : 1 })}
            >
              <Ionicons name={done ? 'checkmark-circle' : 'add-circle-outline'} size={16} color="#fff" />
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>
                {n} / {reps}
              </Text>
            </Pressable>
            <Action icon="ellipse-outline" label="Tasbih" onPress={onTasbih} />
          </>
        ) : null}
      </View>
      {reps > 0 ? <LMuted style={{ fontSize: 11, marginTop: 6 }}>{L('× {r} — touchez pour compter, appui long pour remettre à zéro.', { r: reps })}</LMuted> : null}
    </LCard>
  );
}

export default function Duas() {
  const router = useRouter();
  const { tasbih, setTasbih, saveSession } = useData();
  const qp = useLocalSearchParams<{ q?: string }>();
  const [q, setQ] = useState(typeof qp.q === 'string' ? qp.q : '');
  const [cat, setCat] = useState<string | null>(null);
  const [favs, setFavs] = usePersistentState<string[]>('duas_favs', []);
  const [copied, setCopied] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftItem | null>(null);
  const lang = useUiLang();

  const list = useMemo(() => {
    const nq = norm(q.trim());
    return DUAS_LIST.filter((d) => {
      if (cat === 'favs' && !favs.includes(d.id)) return false;
      if (cat && cat !== 'favs' && d.cat !== cat) return false;
      if (!nq) return true;
      const v = duaView(d, lang);
      return norm([d.title, d.fr, d.tr, d.ar, d.ref, d.when ?? '', duaCatLabel(d.cat), v.title, v.meaning ?? '', v.when ?? '', L(duaCatLabel(d.cat))].join(' ')).includes(nq);
    });
  }, [q, cat, favs, lang]);

  const toggleFav = (id: string) => setFavs((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]));
  const copy = async (d: Dua) => {
    const v = duaView(d, lang);
    const text = `${d.ar}\n\n${d.tr}${v.meaning ? `\n\n${v.meaning}` : ''}\n\n— ${d.ref}${d.reps ? ` (× ${d.reps})` : ''}`;
    try {
      await Clipboard.setStringAsync(text);
      setCopied(d.id);
      setTimeout(() => setCopied((c) => (c === d.id ? null : c)), 1800);
    } catch {
      /* presse-papiers indisponible */
    }
  };
  const toTasbih = (d: Dua) => {
    if (tasbih.count > 0) saveSession();
    setTasbih((t) => ({ ...t, count: 0, target: d.reps ?? t.target }));
    router.push('/tasbih');
  };

  return (
    <Screen padded={false} bg={b.cream}>
      <PatternBg color={COLOR} style={{ padding: 20, alignItems: 'center' }}>
        <Ionicons name="hand-left" size={28} color="#fff" />
        <Text style={{ color: '#fff', fontSize: 26, writingDirection: 'rtl', marginTop: 4 }}>الأدعية النبوية</Text>
        <Text style={{ color: '#fff', fontSize: 22, fontWeight: '900' }}>Du‘as prophétiques</Text>
        <Text style={{ color: 'rgba(255,255,255,0.85)', textAlign: 'center' }}>{L('{n} invocations · {c} catégories · sources indiquées', { n: DUAS_LIST.length, c: DUA_CATS.length })}</Text>
      </PatternBg>
      <View style={{ padding: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: b.paper, borderRadius: 14, borderWidth: 1, borderColor: b.line, paddingHorizontal: 12, marginBottom: 10 }}>
          <Ionicons name="search" size={18} color={b.inkMuted} />
          <TextInput value={q} onChangeText={setQ} placeholder={L("Rechercher (mot, moment, référence, arabe)…")} placeholderTextColor={b.inkMuted} style={{ flex: 1, minHeight: 44, color: b.ink, marginLeft: 8 }} accessibilityLabel={L("Rechercher une invocation")} autoCorrect={false} />
          {q ? (
            <Pressable accessibilityRole="button" accessibilityLabel={L("Effacer la recherche")} onPress={() => setQ('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={b.inkMuted} />
            </Pressable>
          ) : null}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} style={{ marginBottom: 12 }}>
          <Pill label="Tout" active={!cat} onPress={() => setCat(null)} color={COLOR} />
          <Pill label={`★ ${L('Favoris')}${favs.length ? ` (${favs.length})` : ''}`} active={cat === 'favs'} onPress={() => setCat('favs')} color={b.gold} />
          {DUA_CATS.map((c) => (
            <Pill key={c.id} label={L(c.label)} active={cat === c.id} onPress={() => setCat(c.id)} color={COLOR} />
          ))}
        </ScrollView>
        <LMuted style={{ marginBottom: 8 }}>{`${list.length} invocation${list.length > 1 ? 's' : ''}`}</LMuted>
        {list.map((d) => (
          <DuaCard key={d.id} d={d} fav={favs.includes(d.id)} onFav={() => toggleFav(d.id)} onCopy={() => copy(d)} copied={copied === d.id} onTasbih={() => toTasbih(d)} onZikr={() => setDraft({ kind: 'dua', ref: d.ref, label: d.title, ar: d.ar, tr: d.tr, fr: d.fr, reps: d.reps ?? 1 })} />
        ))}
        {!list.length ? <LMuted>{cat === 'favs' ? 'Aucun favori pour l’instant : touchez l’étoile d’une invocation pour l’ajouter.' : 'Aucun résultat.'}</LMuted> : null}
        <LMuted style={{ marginTop: 8 }}>
          Invocations tirées du Coran et des recueils authentiques (al-Bukhari, Muslim, Abu Dawud, at-Tirmidhi, Ibn Majah, Ahmad), numérotation de sunnah.com. Chaque carte affiche le jugement (grading) recopié de sunnah.com ou dorar.net avec le nom du savant ; à défaut, « grading non vérifié ». Certains textes sont jugés faibles par un savant et le badge l’indique. Tout le contenu est « à valider » par une personne de savoir. Traductions et translittérations indicatives : en cas de doute, se référer à un savant.
        </LMuted>
      </View>
      <AddToZikrSheet item={draft} onClose={() => setDraft(null)} />
    </Screen>
  );
}
