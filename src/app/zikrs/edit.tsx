import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Pressable, TextInput, View } from 'react-native';
import { Text } from '@/ui/Text';
import { ItemPicker } from '@/components/zikr/Picker';
import { LBtn, fmt, shareZikr } from '@/components/zikr/parts';
import type { AbjadSystem } from '@/lib/abjad';
import { uid } from '@/lib/storage';
import { KIND_LABEL, MOMENTS, abjadAsReps, clampReps, compositionTotals, duplicateItem, exportText, itemAbjad, moveItem, removeItem, type ZikrItem } from '@/lib/zikr';
import { useZikrs } from '@/lib/zikrs';
import { isFatiha } from '@/lib/fatiha';
import { useSettings } from '@/lib/settings';
import { Ionicons, Screen, type IconName } from '@/ui/kit';
import { Arabic, LCard, LMuted, LText, Pill, SectionLabel } from '@/ui/light';
import { prunePhotos } from '@/lib/ocr';
import { brand as b, theme as t } from '@/ui/theme';
import { L } from '@/lib/l10n';

const SYSC: Record<AbjadSystem, string> = {
  mashriqi: '#2F7FD0',
  maghribi: '#2E8B57',
};
const PRESETS = [1, 3, 7, 11, 33, 100];
const input = {
  minHeight: 44,
  borderRadius: 12,
  borderWidth: 1,
  borderColor: b.line,
  backgroundColor: b.paper,
  paddingHorizontal: 12,
  color: b.ink,
} as const;

function Icon({ icon, label, onPress, disabled, color = b.inkMuted }: { icon: IconName; label: string; onPress: () => void; disabled?: boolean; color?: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={L(label)}
      accessibilityState={{ disabled: !!disabled }}
      onPress={disabled ? undefined : onPress}
      hitSlop={4}
      style={({ pressed }) => ({
        width: 38,
        height: 38,
        borderRadius: 19,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: b.line,
        backgroundColor: b.paper,
        opacity: disabled ? 0.35 : pressed ? 0.7 : 1,
      })}
    >
      <Ionicons name={icon} size={18} color={color} />
    </Pressable>
  );
}

function RepsInput({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [txt, setTxt] = useState<string | null>(null);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Icon icon="remove" label="Moins une répétition" onPress={() => onChange(clampReps(value - 1))} disabled={value <= 1} />
      <TextInput
        value={txt ?? String(value)}
        onChangeText={setTxt}
        onBlur={() => {
          if (txt != null) onChange(clampReps(parseInt(txt, 10)));
          setTxt(null);
        }}
        onSubmitEditing={() => {
          if (txt != null) onChange(clampReps(parseInt(txt, 10)));
          setTxt(null);
        }}
        keyboardType="number-pad"
        selectTextOnFocus
        accessibilityLabel={L("Nombre de répétitions")}
        style={[input, { width: 80, textAlign: 'center', fontWeight: '800', fontSize: 16 }]}
      />
      <Icon icon="add" label="Plus une répétition" onPress={() => onChange(clampReps(value + 1))} />
    </View>
  );
}

export default function EditZikr() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { zikrs, update, systems, opts, repSys, prefs, setPrefs, ready } = useZikrs();
  const { s: settings } = useSettings();
  const z = zikrs.find((x) => x.id === id);
  const [picker, setPicker] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [photoOpen, setPhotoOpen] = useState<string | null>(null);
  // Photos d’origine (locales) : supprime à l’ouverture celles qui ne servent plus à aucun élément.
  useEffect(() => {
    if (ready) prunePhotos(zikrs.flatMap((x) => x.items.map((i) => i.photo).filter((u): u is string => !!u)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  if (!z) {
    return (
      <Screen bg={b.cream}>
        <LText>{ready ? 'Composition introuvable.' : 'Chargement…'}</LText>
        {ready ? (
          <View style={{ marginTop: 12, alignSelf: 'flex-start' }}>
            <LBtn icon="arrow-back" label="Mes zikrs" onPress={() => router.replace('/zikrs')} />
          </View>
        ) : null}
      </Screen>
    );
  }
  const set = (patch: Partial<typeof z>) => update(z.id, (x) => ({ ...x, ...patch }));
  const setItems = (f: (l: ZikrItem[]) => ZikrItem[]) => update(z.id, (x) => ({ ...x, items: f(x.items) }));
  const totals = systems.map((s) => ({
    s,
    ...compositionTotals(z.items, s, opts),
  }));
  const share = async () => {
    const r = await shareZikr(exportText(z, systems, opts), z.name);
    if (r === 'copied') {
      setMsg('Texte copié');
      setTimeout(() => setMsg(null), 1800);
    }
  };

  return (
    <Screen bg={b.cream}>
      <Stack.Screen options={{ title: z.name || 'Composer un zikr' }} />
      <SectionLabel color={b.green}>Composition</SectionLabel>
      <LCard>
        <LMuted style={{ fontWeight: '700', marginBottom: 4 }}>Nom</LMuted>
        <TextInput value={z.name} onChangeText={(name) => set({ name })} placeholder={L("Ex. Wird du matin")} placeholderTextColor={b.inkMuted} style={input} accessibilityLabel={L("Nom de la composition")} />
        <LMuted style={{ fontWeight: '700', marginBottom: 4, marginTop: 10 }}>Intention (niyya)</LMuted>
        <TextInput
          value={z.niyya}
          onChangeText={(niyya) => set({ niyya })}
          placeholder={L("Ex. Pour la facilité dans mes affaires")}
          placeholderTextColor={b.inkMuted}
          multiline
          style={[input, { minHeight: 64, paddingVertical: 8 }]}
          accessibilityLabel={L("Intention")}
        />
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 12,
          }}
        >
          <LMuted style={{ fontWeight: '700' }}>Objectif quotidien</LMuted>
          <Pill label={z.goal ? 'Activé' : 'Aucun'} active={!!z.goal} onPress={() => set({ goal: z.goal ? undefined : { perDay: 1, moment: 'Libre' } })} color={b.green} />
        </View>
        {z.goal ? (
          <View style={{ marginTop: 8, gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <RepsInput value={z.goal.perDay} onChange={(perDay) => set({ goal: { ...z.goal!, perDay: Math.min(50, perDay) } })} />
              <LMuted>fois par jour</LMuted>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {MOMENTS.map((m) => (
                <Pill key={m} label={m} active={(z.goal?.moment ?? 'Libre') === m} onPress={() => set({ goal: { ...z.goal!, moment: m } })} color={b.green} />
              ))}
            </View>
          </View>
        ) : null}
      </LCard>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 16,
        }}
      >
        <SectionLabel color={b.green}>{L('Éléments ({n})', { n: z.items.length })}</SectionLabel>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <Pill label="Les deux" active={prefs.view === 'both'} onPress={() => setPrefs({ view: 'both' })} color={b.green} />
          <Pill label="Mch" active={prefs.view === 'mashriqi'} onPress={() => setPrefs({ view: 'mashriqi' })} color={SYSC.mashriqi} />
          <Pill label="Mgh" active={prefs.view === 'maghribi'} onPress={() => setPrefs({ view: 'maghribi' })} color={SYSC.maghribi} />
        </View>
      </View>
      {!z.items.length ? (
        <LCard>
          <LMuted>Ajoutez des Noms d’Allah, des du‘as coraniques ou prophétiques, des prières sur le Prophète ﷺ, un verset ou votre propre texte.</LMuted>
        </LCard>
      ) : null}
      {z.items.length && settings.fatihaFirst !== false && !isFatiha(z.items[0]) ? (
        <LMuted style={{ fontSize: 12, marginBottom: 6 }}>Pendant la pratique, Al-Fatiha (1×) est récitée en première étape. Réglable dans Réglages › Mes zikrs.</LMuted>
      ) : null}
      {z.items.map((it, i) => {
        const asReps = itemAbjad(it, repSys, opts);
        return (
          <LCard key={it.id} style={{ marginBottom: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: b.green,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: b.onGreen, fontWeight: '900' }}>{i + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: b.green,
                    fontWeight: '800',
                    fontSize: 11,
                    letterSpacing: 0.5,
                  }}
                >
                  {L(KIND_LABEL[it.kind] ?? String(it.kind ?? '')).toUpperCase()}
                </Text>
                <Text style={{ color: b.ink, fontWeight: '800', fontSize: 15 }}>{it.label}</Text>
                {it.unverified ? (
                  <Text style={{ color: t.warning, fontSize: 11, fontWeight: '700' }} accessibilityLabel={L('Non vérifié — source à vérifier')}>
                    {'⚠ ' + L('Non vérifié — source à vérifier')}
                  </Text>
                ) : it.ref ? (
                  <LMuted style={{ fontSize: 11 }}>{it.ref}</LMuted>
                ) : null}
                {it.via && !it.unverified ? (
                  <LMuted style={{ fontSize: 11 }}>
                    {it.kind === 'verse'
                      ? it.via === 'photo' ? 'Importé d’une photo · vérifié dans le Coran' : it.via === 'pdf' ? 'Importé d’un PDF · vérifié dans le Coran' : 'Collé · vérifié dans le Coran'
                      : it.via === 'photo' ? 'Importé d’une photo · reconnu dans le catalogue Zikru' : it.via === 'pdf' ? 'Importé d’un PDF · reconnu dans le catalogue Zikru' : 'Collé · reconnu dans le catalogue Zikru'}
                  </LMuted>
                ) : null}
              </View>
              {it.photo ? (
                <Pressable accessibilityRole="imagebutton" accessibilityLabel={L(photoOpen === it.id ? 'Réduire la photo d’origine' : 'Agrandir la photo d’origine')} onPress={() => setPhotoOpen((x) => (x === it.id ? null : it.id))} hitSlop={6}>
                  <Image source={{ uri: it.photo }} style={{ width: 48, height: 48, borderRadius: 8, backgroundColor: b.paper }} />
                </Pressable>
              ) : null}
            </View>
            {it.photo && photoOpen === it.id ? (
              <View style={{ marginTop: 8 }}>
                <Image source={{ uri: it.photo }} resizeMode="contain" style={{ width: '100%', height: 280, borderRadius: 12, backgroundColor: b.paper }} accessible accessibilityLabel={L('Photo d’origine (gardée sur l’appareil)')} />
              </View>
            ) : null}
            <Arabic size={21} style={{ marginTop: 6 }}>
              {it.ar}
            </Arabic>
            {it.tr ? (
              <Text
                style={{
                  color: b.brownSoft,
                  fontStyle: 'italic',
                  marginTop: 2,
                }}
              >
                {it.tr}
              </Text>
            ) : null}
            <View style={{ marginTop: 8, gap: 2 }}>
              {systems.map((s) => {
                const v = itemAbjad(it, s, opts);
                return <Text key={s} style={{ color: SYSC[s], fontWeight: '700', fontSize: 12 }}>{L('Abjad {s} : {v} × {r} = {t}', { s: L(s), v: fmt(v), r: fmt(it.reps), t: fmt(v * it.reps) })}</Text>;
              })}
              {it.abjadAr ? <LMuted style={{ fontSize: 11 }}>Calcul sur le Nom sans « yā » ni article.</LMuted> : null}
            </View>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 8,
                marginTop: 10,
              }}
            >
              <RepsInput value={it.reps} onChange={(reps) => setItems((l) => l.map((x) => (x.id === it.id ? { ...x, reps } : x)))} />
              {asReps > 0 ? (
                <LBtn icon="calculator-outline" label={L('= abjad ({n})', { n: fmt(asReps) })} active={it.reps === asReps} onPress={() => setItems((l) => l.map((x) => (x.id === it.id ? abjadAsReps(x, repSys, opts) : x)))} />
              ) : null}
            </View>
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: 6,
                marginTop: 8,
              }}
            >
              {PRESETS.map((p) => (
                <Pill key={p} label={`× ${p}`} active={it.reps === p} onPress={() => setItems((l) => l.map((x) => (x.id === it.id ? { ...x, reps: p } : x)))} color={b.green} />
              ))}
            </View>
            <View
              style={{
                flexDirection: 'row',
                gap: 8,
                marginTop: 10,
                justifyContent: 'flex-end',
              }}
            >
              <Icon icon="arrow-up" label="Monter" disabled={i === 0} onPress={() => setItems((l) => moveItem(l, i, -1))} />
              <Icon icon="arrow-down" label="Descendre" disabled={i === z.items.length - 1} onPress={() => setItems((l) => moveItem(l, i, 1))} />
              <Icon icon="copy-outline" label="Dupliquer" onPress={() => setItems((l) => duplicateItem(l, i, uid('i')))} />
              <Icon icon="trash-outline" label="Supprimer l’élément" color="#B3261E" onPress={() => setItems((l) => removeItem(l, i))} />
            </View>
          </LCard>
        );
      })}
      <LBtn icon="add-circle" label="Ajouter un élément" solid onPress={() => setPicker(true)} />

      {z.items.length ? (
        <>
          <SectionLabel color={b.green}>Abjad de la composition</SectionLabel>
          <LCard>
            {totals.map((t) => (
              <View key={t.s} style={{ marginBottom: 8 }}>
                <Text style={{ color: SYSC[t.s], fontWeight: '900', fontSize: 13 }}>{t.s === 'mashriqi' ? 'MASHRIQI' : 'MAGHRIBI'}</Text>
                <View style={{ flexDirection: 'row', gap: 16, marginTop: 2 }}>
                  <View>
                    <Text style={{ color: b.ink, fontWeight: '900', fontSize: 22 }}>{fmt(t.perRecitation)}</Text>
                    <LMuted style={{ fontSize: 11 }}>une récitation de chaque</LMuted>
                  </View>
                  <View>
                    <Text style={{ color: b.ink, fontWeight: '900', fontSize: 22 }}>{fmt(t.withReps)}</Text>
                    <LMuted style={{ fontSize: 11 }}>avec les répétitions</LMuted>
                  </View>
                </View>
              </View>
            ))}
            <LMuted>{L('{n} répétitions au total · options ة = {t}, ء = {h}', { n: fmt(totals[0].totalReps), t: prefs.ta === 'ha' ? 'ه (5)' : 'ت (400)', h: String(prefs.hamza) })}</LMuted>
          </LCard>
        </>
      ) : null}

      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 8,
          marginTop: 14,
        }}
      >
        <LBtn icon="play" label="Pratiquer" solid color={b.green} disabled={!z.items.length} onPress={() => router.push({ pathname: '/zikrs/practice', params: { id: z.id } })} />
        <LBtn icon="share-outline" label="Partager / exporter" onPress={() => void share()} />
        <LBtn icon="checkmark" label="Terminé" onPress={() => (router.canGoBack() ? router.back() : router.replace('/zikrs'))} />
      </View>
      {msg ? <Text style={{ color: b.green, fontWeight: '700', marginTop: 8 }}>{msg}</Text> : null}
      <LMuted style={{ marginTop: 10, fontSize: 11 }}>Enregistrement automatique. Les options abjad (ة, hamza) se règlent dans l’écran Abjad.</LMuted>
      <ItemPicker visible={picker} onClose={() => setPicker(false)} onAdd={(d) => setItems((l) => [...l, { ...d, id: uid('i') }])} />
    </Screen>
  );
}
