import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, Share, Text, TextInput, View } from 'react-native';
import { computeAbjad } from '@/lib/abjad';
import { nameBare, nameCall, nameCallTr, type AllahName } from '@/lib/names';
import type { ZikrItem } from '@/lib/zikr';
import { useZikrs } from '@/lib/zikrs';
import { Ionicons, type IconName } from '@/ui/kit';
import { LMuted } from '@/ui/light';
import { brand as b } from '@/ui/theme';

export const ZCOLOR = '#7A4F9E';
const SYSC = {
  get mashriqi() {
    return b.green;
  },
  get maghribi() {
    return b.goldDeep;
  },
};
export const fmt = (n: number) => n.toLocaleString('fr-CH');

/** Bouton clair (thème crème). */
export function LBtn({ icon, label, onPress, active, color = ZCOLOR, solid, disabled }: { icon?: IconName; label: string; onPress: () => void; active?: boolean; color?: string; solid?: boolean; disabled?: boolean }) {
  const fg = solid ? '#fff' : active ? color : b.ink;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      onPress={disabled ? undefined : onPress}
      hitSlop={4}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        minHeight: 38,
        paddingHorizontal: 12,
        borderRadius: 19,
        borderWidth: 1,
        borderColor: solid ? color : active ? color : b.line,
        backgroundColor: solid ? color : active ? color + '18' : b.paper,
        opacity: disabled ? 0.4 : pressed ? 0.8 : 1,
      })}
    >
      {icon ? <Ionicons name={icon} size={16} color={solid ? '#fff' : active ? color : b.inkMuted} /> : null}
      <Text style={{ color: fg, fontWeight: '700', fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

/** Valeur(s) abjad d’un texte arabe selon les préférences partagées. */
export function AbjadBadge({ ar, compact }: { ar: string; compact?: boolean }) {
  const { systems, opts } = useZikrs();
  const vals = systems.map((s) => ({ s, v: computeAbjad(ar, s, opts).total }));
  if (!vals.some((x) => x.v > 0)) return null;
  return (
    <View
      accessibilityLabel={`Abjad ${vals.map((x) => `${x.s} ${x.v}`).join(', ')}`}
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        alignItems: 'center',
      }}
    >
      {!compact ? (
        <Text
          style={{
            color: b.inkMuted,
            fontSize: 11,
            fontWeight: '800',
            letterSpacing: 0.5,
          }}
        >
          ABJAD
        </Text>
      ) : null}
      {vals.map(({ s, v }) => (
        <View
          key={s}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            paddingHorizontal: 8,
            paddingVertical: 2,
            borderRadius: 10,
            backgroundColor: SYSC[s] + '14',
            borderWidth: 1,
            borderColor: SYSC[s] + '40',
          }}
        >
          <Text style={{ color: SYSC[s], fontWeight: '900', fontSize: 13 }}>{fmt(v)}</Text>
          {systems.length > 1 ? <Text style={{ color: SYSC[s], fontSize: 10, fontWeight: '700' }}>{s === 'mashriqi' ? 'Mch' : 'Mgh'}</Text> : null}
        </View>
      ))}
    </View>
  );
}

export type DraftItem = Omit<ZikrItem, 'id'>;

/** Élément « Nom d’Allah » : récité « Yā Laṭīf », abjad calculé sur « Laṭīf ». */
export function nameItem(x: AllahName, reps: number): DraftItem {
  return {
    kind: 'name',
    ref: `Nom n° ${x.n}`,
    label: nameCallTr(x.tr),
    ar: nameCall(x.ar),
    abjadAr: nameBare(x.ar),
    tr: nameCallTr(x.tr),
    fr: x.fr,
    reps,
  };
}

export async function shareZikr(text: string, title: string): Promise<'shared' | 'copied' | 'fail'> {
  try {
    if (Platform.OS === 'web') {
      const nav = (
        globalThis as {
          navigator?: {
            share?: (d: { title: string; text: string }) => Promise<void>;
          };
        }
      ).navigator;
      if (nav?.share) {
        await nav.share({ title, text });
        return 'shared';
      }
      await Clipboard.setStringAsync(text);
      return 'copied';
    }
    await Share.share({ title, message: text });
    return 'shared';
  } catch {
    try {
      await Clipboard.setStringAsync(text);
      return 'copied';
    } catch {
      return 'fail';
    }
  }
}

/** Feuille « Ajouter à un zikr » : choisir une composition existante ou en créer une. */
export function AddToZikrSheet({ item, onClose }: { item: DraftItem | null; onClose: () => void }) {
  const { zikrs, addItem, create } = useZikrs();
  const router = useRouter();
  const [name, setName] = useState('');
  const [done, setDone] = useState<string | null>(null);
  if (!item) return null;
  const close = () => {
    setDone(null);
    setName('');
    onClose();
  };
  const pick = (zid: string, zname: string) => {
    addItem(zid, item);
    setDone(zid + '|' + zname);
  };
  const [doneId, doneName] = done ? done.split('|') : [null, null];
  return (
    <Modal transparent animationType="fade" visible onRequestClose={close}>
      <Pressable
        accessibilityLabel="Fermer"
        onPress={close}
        style={{
          flex: 1,
          backgroundColor: '#0008',
          justifyContent: 'flex-end',
          alignItems: 'center',
        }}
      >
        <Pressable
          onPress={() => {}}
          style={{
            width: '100%',
            maxWidth: 560,
            maxHeight: '80%',
            backgroundColor: b.cream,
            borderTopLeftRadius: 22,
            borderTopRightRadius: 22,
            padding: 18,
          }}
        >
          <Text style={{ color: b.ink, fontWeight: '800', fontSize: 18 }}>Ajouter à un zikr</Text>
          <LMuted style={{ marginTop: 2 }}>{`${item.label} — × ${item.reps}`}</LMuted>
          {doneId ? (
            <View style={{ marginTop: 14, gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="checkmark-circle" size={22} color={b.green} />
                <Text style={{ color: b.green, fontWeight: '800', flex: 1 }}>{`Ajouté à « ${doneName} »`}</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                <LBtn
                  icon="create-outline"
                  label="Ouvrir la composition"
                  solid
                  onPress={() => {
                    close();
                    router.push({
                      pathname: '/zikrs/edit',
                      params: { id: doneId },
                    });
                  }}
                />
                <LBtn icon="arrow-back" label="Continuer" onPress={close} />
              </View>
            </View>
          ) : (
            <ScrollView style={{ marginTop: 12 }} keyboardShouldPersistTaps="handled">
              {zikrs.map((z) => (
                <Pressable
                  key={z.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Ajouter à ${z.name}`}
                  onPress={() => pick(z.id, z.name)}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    padding: 12,
                    borderRadius: 14,
                    backgroundColor: b.paper,
                    borderWidth: 1,
                    borderColor: b.line,
                    marginBottom: 8,
                    opacity: pressed ? 0.8 : 1,
                  })}
                >
                  <Ionicons name="albums-outline" size={20} color={ZCOLOR} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: b.ink, fontWeight: '800' }}>{z.name}</Text>
                    <LMuted style={{ fontSize: 12 }}>{`${z.items.length} élément${z.items.length > 1 ? 's' : ''}`}</LMuted>
                  </View>
                  <Ionicons name="add-circle" size={22} color={ZCOLOR} />
                </Pressable>
              ))}
              <Text
                style={{
                  color: b.inkMuted,
                  fontWeight: '800',
                  fontSize: 12,
                  marginTop: 6,
                  marginBottom: 6,
                }}
              >
                NOUVELLE COMPOSITION
              </Text>
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="Nom (ex. Wird du matin)"
                  placeholderTextColor={b.inkMuted}
                  accessibilityLabel="Nom de la nouvelle composition"
                  style={{
                    flex: 1,
                    minHeight: 44,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: b.line,
                    backgroundColor: b.paper,
                    paddingHorizontal: 12,
                    color: b.ink,
                  }}
                />
                <LBtn
                  icon="add"
                  label="Créer"
                  solid
                  onPress={() => {
                    const z = create(name.trim() || 'Mon zikr');
                    pick(z.id, z.name);
                  }}
                />
              </View>
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
