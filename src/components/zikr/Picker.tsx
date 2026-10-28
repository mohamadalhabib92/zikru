import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { computeAbjad } from '@/lib/abjad';
import { DUAS_LIST, duaCatLabel } from '@/lib/duas';
import { NAMES, nameBare, nameCallTr } from '@/lib/names';
import { getSurah, translationFor, type SurahText } from '@/lib/quran';
import { searchVerses, type VerseHit } from '@/lib/quran-offline';
import { QURAN_DUAS } from '@/lib/quran-duas';
import { SALAWAT } from '@/lib/salawat';
import { SURAHS } from '@/lib/surahs';
import { useZikrs } from '@/lib/zikrs';
import { Ionicons } from '@/ui/kit';
import { Arabic, LMuted, Pill } from '@/ui/light';
import { brand as b } from '@/ui/theme';
import { AbjadBadge, LBtn, nameItem, type DraftItem } from './parts';

type Tab = 'names' | 'quran' | 'verse' | 'dua' | 'salat' | 'free';
const TABS: { id: Tab; label: string }[] = [
  { id: 'names', label: 'Noms d’Allah' },
  { id: 'quran', label: 'Du‘as coraniques' },
  { id: 'dua', label: 'Du‘as prophétiques' },
  { id: 'salat', label: 'Ṣalawāt ﷺ' },
  { id: 'verse', label: 'Verset au choix' },
  { id: 'free', label: 'Texte libre' },
];
const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f\u064B-\u0652\u0670]/g, '')
    .replace(/[‘’ʿʾ'-]/g, '')
    .toLowerCase();
const input = {
  minHeight: 44,
  borderRadius: 12,
  borderWidth: 1,
  borderColor: b.line,
  backgroundColor: b.paper,
  paddingHorizontal: 12,
  color: b.ink,
} as const;

function Row({ title, sub, ar, abjadAr, onAdd }: { title: string; sub?: string; ar: string; abjadAr?: string; onAdd: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Ajouter ${title}`}
      onPress={onAdd}
      style={({ pressed }) => ({
        backgroundColor: b.paper,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: b.line,
        padding: 12,
        marginBottom: 8,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: b.ink, fontWeight: '800' }}>{title}</Text>
          {sub ? <LMuted style={{ fontSize: 12 }}>{sub}</LMuted> : null}
        </View>
        <Ionicons name="add-circle" size={24} color={b.green} />
      </View>
      <Arabic size={19} style={{ marginTop: 6 }}>
        {ar.length > 220 ? ar.slice(0, 220) + '…' : ar}
      </Arabic>
      <View style={{ marginTop: 6 }}>
        <AbjadBadge ar={abjadAr ?? ar} compact />
      </View>
    </Pressable>
  );
}

function VersePicker({ onAdd }: { onAdd: (d: DraftItem) => void }) {
  const [sq, setSq] = useState('');
  const [n, setN] = useState<number | null>(null);
  const [from, setFrom] = useState('1');
  const [to, setTo] = useState('');
  const [data, setData] = useState<SurahText | null>(null);
  const [err, setErr] = useState(false);
  const fr = translationFor('fr');
  useEffect(() => {
    if (!n) return;
    let alive = true;
    setData(null);
    setErr(false);
    getSurah(n, fr.id)
      .then((d) => alive && setData(d))
      .catch(() => alive && setErr(true));
    return () => {
      alive = false;
    };
  }, [n]);
  const surahs = useMemo(() => {
    const q = norm(sq.trim());
    if (!q) return SURAHS;
    const k = parseInt(q, 10);
    return SURAHS.filter((m) => (/^\d+$/.test(q) ? m[0] === k : norm(`${m[2]} ${m[3]} ${m[1]}`).includes(q)));
  }, [sq]);
  // Recherche de versets hors-ligne (arabe sans diacritiques, « 2:255 », ou traduction si téléchargée).
  const [vh, setVh] = useState<VerseHit[]>([]);
  useEffect(() => {
    const q = sq.trim();
    if (q.length < 3 || /^\d+$/.test(q)) return setVh([]);
    let alive = true;
    const h = setTimeout(() => searchVerses(q, fr.id, 12).then((r) => alive && setVh(r.hits)).catch(() => {}), 200);
    return () => {
      alive = false;
      clearTimeout(h);
    };
  }, [sq]);
  const pick = (v: VerseHit) => {
    setN(v.s);
    setFrom(String(v.a));
    setTo('');
  };
  if (!n) {
    return (
      <View>
        <TextInput value={sq} onChangeText={setSq} placeholder="Sourate, verset (2:255) ou mots en arabe" placeholderTextColor={b.inkMuted} style={input} accessibilityLabel="Rechercher une sourate ou un verset" autoCorrect={false} />
        {vh.length ? (
          <View style={{ marginTop: 8 }}>
            <LMuted style={{ fontSize: 12, fontWeight: '700' }}>Versets (hors-ligne)</LMuted>
            {vh.map((v) => (
              <Pressable
                key={`${v.s}:${v.a}`}
                accessibilityRole="button"
                accessibilityLabel={`Verset ${v.s}:${v.a}`}
                onPress={() => pick(v)}
                style={({ pressed }) => ({ paddingVertical: 10, paddingHorizontal: 6, borderBottomWidth: 1, borderBottomColor: b.line, opacity: pressed ? 0.7 : 1 })}
              >
                <Text style={{ color: b.green, fontWeight: '800', fontSize: 12 }}>{`${SURAHS[v.s - 1][2]} ${v.s}:${v.a}`}</Text>
                <Arabic size={18} numberOfLines={3} style={{ marginTop: 4 }}>
                  {v.ar}
                </Arabic>
                {v.tr ? (
                  <LMuted style={{ fontSize: 12 }} numberOfLines={2}>
                    {v.tr}
                  </LMuted>
                ) : null}
              </Pressable>
            ))}
          </View>
        ) : null}
        <View style={{ marginTop: 8 }}>
          {surahs.map((m) => (
            <Pressable
              key={m[0]}
              accessibilityRole="button"
              accessibilityLabel={`Sourate ${m[0]} ${m[2]}`}
              onPress={() => setN(m[0])}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                paddingVertical: 10,
                paddingHorizontal: 6,
                borderBottomWidth: 1,
                borderBottomColor: b.line,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text style={{ color: b.green, fontWeight: '900', width: 32 }}>{m[0]}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: b.ink, fontWeight: '700' }}>{m[2]}</Text>
                <LMuted style={{ fontSize: 12 }}>{`${m[4]} versets`}</LMuted>
              </View>
              <Text style={{ color: b.ink, fontSize: 18 }}>{m[1]}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    );
  }
  const meta = SURAHS[n - 1];
  const a = Math.min(meta[4], Math.max(1, parseInt(from, 10) || 1));
  const z = Math.min(meta[4], Math.max(a, parseInt(to, 10) || a), a + 19);
  const sel = data ? data.ayahs.filter((x) => x.n >= a && x.n <= z) : [];
  const ar = sel.map((x) => x.ar).join(' ۝ ');
  const ref = a === z ? `${n}:${a}` : `${n}:${a}-${z}`;
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Changer de sourate" onPress={() => setN(null)} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={b.ink} />
        </Pressable>
        <Text style={{ color: b.ink, fontWeight: '800', flex: 1 }}>{`${n}. ${meta[2]} · ${meta[4]} versets`}</Text>
      </View>
      <View
        style={{
          flexDirection: 'row',
          gap: 8,
          marginTop: 10,
          alignItems: 'center',
        }}
      >
        <LMuted>Verset</LMuted>
        <TextInput value={from} onChangeText={setFrom} keyboardType="number-pad" style={[input, { width: 70 }]} accessibilityLabel="Premier verset" />
        <LMuted>à</LMuted>
        <TextInput value={to} onChangeText={setTo} keyboardType="number-pad" placeholder={String(a)} placeholderTextColor={b.inkMuted} style={[input, { width: 70 }]} accessibilityLabel="Dernier verset (facultatif)" />
      </View>
      <LMuted style={{ fontSize: 11, marginTop: 4 }}>Jusqu’à 20 versets consécutifs.</LMuted>
      {!data ? (
        <View style={{ padding: 20, alignItems: 'center' }}>{err ? <LMuted>Impossible de charger la sourate (connexion requise la première fois).</LMuted> : <ActivityIndicator color={b.green} />}</View>
      ) : (
        <View
          style={{
            backgroundColor: b.paper,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: b.line,
            padding: 12,
            marginTop: 10,
          }}
        >
          <Text style={{ color: b.green, fontWeight: '800' }}>{`Coran ${ref}`}</Text>
          <Arabic size={21} style={{ marginTop: 6 }}>
            {ar}
          </Arabic>
          <LMuted style={{ marginTop: 6 }}>{sel.map((x) => x.tr).join(' ')}</LMuted>
          <View style={{ marginTop: 8 }}>
            <AbjadBadge ar={ar} />
          </View>
          <View style={{ marginTop: 10, alignSelf: 'flex-start' }}>
            <LBtn
              icon="add"
              label="Ajouter ce passage"
              solid
              onPress={() =>
                onAdd({
                  kind: 'verse',
                  ref: `Coran ${ref}`,
                  label: `${meta[2]} ${ref}`,
                  ar,
                  fr: sel.map((x) => x.tr).join(' '),
                  reps: 1,
                })
              }
            />
          </View>
          <LMuted style={{ fontSize: 11, marginTop: 6 }}>{`Texte : Tanzil / api.alquran.cloud · traduction ${fr.label}`}</LMuted>
        </View>
      )}
    </View>
  );
}

function FreeText({ onAdd }: { onAdd: (d: DraftItem) => void }) {
  const [label, setLabel] = useState('');
  const [ar, setAr] = useState('');
  const [tr, setTr] = useState('');
  const [fr, setFr] = useState('');
  const ok = ar.trim().length > 0;
  return (
    <View style={{ gap: 8 }}>
      <TextInput value={label} onChangeText={setLabel} placeholder="Titre (ex. Tahlīl)" placeholderTextColor={b.inkMuted} style={input} accessibilityLabel="Titre" />
      <TextInput
        value={ar}
        onChangeText={setAr}
        placeholder="النص بالعربية"
        placeholderTextColor={b.inkMuted}
        multiline
        style={[
          input,
          {
            minHeight: 90,
            fontSize: 22,
            textAlign: 'right',
            writingDirection: 'rtl',
            paddingVertical: 8,
          },
        ]}
        accessibilityLabel="Texte arabe"
      />
      <TextInput value={tr} onChangeText={setTr} placeholder="Translittération (facultatif)" placeholderTextColor={b.inkMuted} style={input} accessibilityLabel="Translittération" />
      <TextInput value={fr} onChangeText={setFr} placeholder="Traduction (facultatif)" placeholderTextColor={b.inkMuted} style={input} accessibilityLabel="Traduction" />
      {ok ? <AbjadBadge ar={ar} /> : null}
      <View style={{ alignSelf: 'flex-start' }}>
        <LBtn
          icon="add"
          label="Ajouter"
          solid
          disabled={!ok}
          onPress={() => {
            onAdd({
              kind: 'free',
              label: label.trim() || ar.trim().split(/\s+/).slice(0, 4).join(' '),
              ar: ar.trim(),
              tr: tr.trim() || undefined,
              fr: fr.trim() || undefined,
              ref: 'Texte personnel',
              reps: 1,
            });
            setLabel('');
            setAr('');
            setTr('');
            setFr('');
          }}
        />
      </View>
      <LMuted style={{ fontSize: 11 }}>Votre texte n’est pas vérifié : assurez-vous de sa source.</LMuted>
    </View>
  );
}

/** Sélecteur d’éléments à ajouter à une composition. */
export function ItemPicker({ visible, onAdd, onClose }: { visible: boolean; onAdd: (d: DraftItem) => void; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { repSys, opts } = useZikrs();
  const [tab, setTab] = useState<Tab>('names');
  const [q, setQ] = useState('');
  const [added, setAdded] = useState<string | null>(null);
  const add = (d: DraftItem) => {
    onAdd(d);
    setAdded(d.label);
    setTimeout(() => setAdded((x) => (x === d.label ? null : x)), 1600);
  };
  const nq = norm(q.trim());
  const has = (...p: (string | undefined)[]) => !nq || norm(p.filter(Boolean).join(' ')).includes(nq);
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen">
      <View style={{ flex: 1, backgroundColor: b.cream, paddingTop: insets.top }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            padding: 14,
            gap: 10,
            backgroundColor: b.hero,
            borderBottomWidth: 2,
            borderBottomColor: b.gold,
          }}
        >
          <Text style={{ color: b.heroText, fontWeight: '900', fontSize: 18, flex: 1 }}>Ajouter un élément</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Terminer"
            onPress={onClose}
            hitSlop={8}
            style={{
              paddingHorizontal: 12,
              minHeight: 36,
              borderRadius: 18,
              backgroundColor: b.gold,
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#1B1405', fontWeight: '800' }}>Terminé</Text>
          </Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8, padding: 12 }}>
          {TABS.map((t) => (
            <Pill
              key={t.id}
              label={t.label}
              active={tab === t.id}
              onPress={() => {
                setTab(t.id);
                setQ('');
              }}
              color={b.green}
            />
          ))}
        </ScrollView>
        {added ? (
          <Text
            style={{
              color: b.green,
              fontWeight: '800',
              textAlign: 'center',
              marginBottom: 6,
            }}
          >{`✓ Ajouté : ${added}`}</Text>
        ) : null}
        <ScrollView
          contentContainerStyle={{
            padding: 12,
            paddingTop: 0,
            paddingBottom: 40 + insets.bottom,
            maxWidth: 760,
            width: '100%',
            alignSelf: 'center',
          }}
          keyboardShouldPersistTaps="handled"
        >
          {tab === 'names' || tab === 'quran' || tab === 'dua' || tab === 'salat' ? (
            <TextInput value={q} onChangeText={setQ} placeholder="Rechercher…" placeholderTextColor={b.inkMuted} style={[input, { marginBottom: 10 }]} accessibilityLabel="Rechercher" autoCorrect={false} />
          ) : null}
          {nq &&
          ((tab === 'names' && !NAMES.some((x) => has(x.tr, x.fr, x.ar, String(x.n)))) ||
            (tab === 'quran' && !QURAN_DUAS.some((d) => has(d.title, d.fr, d.tr, d.ar, d.ref, d.who))) ||
            (tab === 'dua' && !DUAS_LIST.some((d) => has(d.title, d.fr, d.tr, d.ar, d.ref, d.when, duaCatLabel(d.cat)))) ||
            (tab === 'salat' && !SALAWAT.some((x) => has(x.title, x.fr, x.tr, x.ar, x.ref)))) ? (
            <LMuted style={{ textAlign: 'center', marginVertical: 20 }}>Aucun résultat pour « {q.trim()} ».</LMuted>
          ) : null}
          {tab === 'names'
            ? NAMES.filter((x) => has(x.tr, x.fr, x.ar, String(x.n))).map((x) => {
                const v = computeAbjad(nameBare(x.ar), repSys, opts).total;
                return (
                  <View key={x.n}>
                    <Row title={`${x.n}. ${nameCallTr(x.tr)}`} sub={x.fr} ar={x.ar} abjadAr={nameBare(x.ar)} onAdd={() => add(nameItem(x, 1))} />
                    <View
                      style={{
                        alignSelf: 'flex-end',
                        marginTop: -4,
                        marginBottom: 10,
                      }}
                    >
                      <LBtn icon="calculator-outline" label={`Ajouter × ${v} (abjad)`} onPress={() => add(nameItem(x, v || 1))} />
                    </View>
                  </View>
                );
              })
            : null}
          {tab === 'quran'
            ? QURAN_DUAS.filter((d) => has(d.title, d.fr, d.tr, d.ar, d.ref, d.who)).map((d) => (
                <Row
                  key={d.id}
                  title={d.title}
                  sub={`Coran ${d.ref}${d.who ? ' · ' + d.who : ''}`}
                  ar={d.ar}
                  onAdd={() =>
                    add({
                      kind: 'quran',
                      ref: `Coran ${d.ref}`,
                      label: d.title,
                      ar: d.ar,
                      tr: d.tr,
                      fr: d.fr,
                      reps: 1,
                    })
                  }
                />
              ))
            : null}
          {tab === 'dua'
            ? DUAS_LIST.filter((d) => has(d.title, d.fr, d.tr, d.ar, d.ref, d.when, duaCatLabel(d.cat))).map((d) => (
                <Row
                  key={d.id}
                  title={d.title}
                  sub={`${d.ref}${d.reps ? ` · × ${d.reps}` : ''}`}
                  ar={d.ar}
                  onAdd={() =>
                    add({
                      kind: 'dua',
                      ref: d.ref,
                      label: d.title,
                      ar: d.ar,
                      tr: d.tr,
                      fr: d.fr,
                      reps: d.reps ?? 1,
                    })
                  }
                />
              ))
            : null}
          {tab === 'salat'
            ? SALAWAT.filter((s) => has(s.title, s.fr, s.tr, s.ar, s.ref)).map((s) => (
                <Row
                  key={s.id}
                  title={s.title}
                  sub={s.ref}
                  ar={s.ar}
                  onAdd={() =>
                    add({
                      kind: 'salat',
                      ref: s.ref,
                      label: s.title,
                      ar: s.ar,
                      tr: s.tr,
                      fr: s.fr,
                      reps: s.kind === 'usuelle' ? 100 : 1,
                    })
                  }
                />
              ))
            : null}
          {tab === 'verse' ? <VersePicker onAdd={add} /> : null}
          {tab === 'free' ? <FreeText onAdd={add} /> : null}
        </ScrollView>
      </View>
    </Modal>
  );
}
