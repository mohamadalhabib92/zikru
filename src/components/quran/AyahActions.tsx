import * as Clipboard from 'expo-clipboard';
import { useEffect, useState } from 'react';
import { Pressable, Share, Text, TextInput, View } from 'react-native';
import { arNum } from '@/lib/quran-nav';
import { BOOKMARK_COLORS, HIGHLIGHTS, keyOf, marks, removeBookmark, saveBookmark, setHighlight, setNote } from '@/lib/quran-store';
import { useShared } from '@/lib/shared-state';
import { SURAHS } from '@/lib/surahs';
import { Ionicons, type IconName } from '@/ui/kit';
import { alpha, fonts } from '@/ui/theme';
import type { Pal } from './palette';
import { QBtn, QLabel, Sheet } from './Sheet';

export type AyahTarget = { s: number; a: number; ar: string; tr?: string };
export type AyahAction = 'play' | 'tafsir' | 'zikr' | 'hifz';

function Act({ icon, label, onPress, pal }: { icon: IconName; label: string; onPress: () => void; pal: Pal }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => ({ flexBasis: '30%', flexGrow: 1, alignItems: 'center', gap: 6, paddingVertical: 12, borderRadius: 16, backgroundColor: pal.card, borderWidth: 1, borderColor: pal.line, opacity: pressed ? 0.75 : 1 })}>
      <Ionicons name={icon} size={22} color={pal.accent} />
      <Text style={{ color: pal.ink, fontSize: 12, fontWeight: '700', textAlign: 'center' }}>{label}</Text>
    </Pressable>
  );
}

/** Actions d’un verset : écouter, tafsir, copier, partager, zikr, mémoriser ; marque-page nommé et coloré, surlignage, note. */
export function AyahActions({ target, onClose, onAction, pal }: { target: AyahTarget | null; onClose: () => void; onAction: (a: AyahAction, t: AyahTarget) => void; pal: Pal }) {
  const [m] = useShared(marks);
  const [name, setName] = useState('');
  const [note, setNoteTxt] = useState('');
  const [copied, setCopied] = useState(false);
  const k = target ? keyOf(target.s, target.a) : '';
  const bm = target ? m.bookmarks.find((x) => x.s === target.s && x.a === target.a) : undefined;
  useEffect(() => {
    setName(bm?.name ?? '');
    setNoteTxt(target ? (m.notes[k]?.text ?? '') : '');
    setCopied(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [k]);
  if (!target) return null;
  const meta = SURAHS[target.s - 1];
  const title = `${meta[2]} · ${target.s}:${target.a}`;
  const plain = `${target.ar} ﴿${arNum(target.a)}﴾${target.tr ? `\n\n${target.tr}` : ''}\n\n— Coran ${target.s}:${target.a} (${meta[2]})`;
  const close = () => {
    if (note !== (m.notes[k]?.text ?? '')) setNote(target.s, target.a, note);
    if (bm && name !== bm.name) saveBookmark(target.s, target.a, name, bm.color);
    onClose();
  };
  const run = (a: AyahAction) => {
    close();
    onAction(a, target);
  };
  return (
    <Sheet visible onClose={close} pal={pal} title={title} subtitle={`${meta[4]} versets · ${meta[5] === 'M' ? 'mecquoise' : 'médinoise'}`}>
      <Text numberOfLines={3} style={{ color: pal.ink, fontFamily: fonts.quran, fontSize: 22, lineHeight: 46, textAlign: 'right', writingDirection: 'rtl' }}>
        {target.ar}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
        <Act icon="play" label="Écouter d’ici" onPress={() => run('play')} pal={pal} />
        <Act icon="library-outline" label="Tafsir" onPress={() => run('tafsir')} pal={pal} />
        <Act icon="school-outline" label="Mémoriser" onPress={() => run('hifz')} pal={pal} />
        <Act
          icon={copied ? 'checkmark' : 'copy-outline'}
          label={copied ? 'Copié' : 'Copier'}
          onPress={() => {
            Clipboard.setStringAsync(plain).then(() => setCopied(true)).catch(() => {});
          }}
          pal={pal}
        />
        <Act icon="share-outline" label="Partager" onPress={() => void Share.share({ message: plain }).catch(() => {})} pal={pal} />
        <Act icon="albums-outline" label="Ajouter à un zikr" onPress={() => run('zikr')} pal={pal} />
      </View>

      <QLabel pal={pal}>MARQUE-PAGE</QLabel>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        {BOOKMARK_COLORS.map((c) => {
          const on = bm?.color === c.hex;
          return (
            <Pressable
              key={c.hex}
              accessibilityRole="button"
              accessibilityLabel={on ? `Retirer le marque-page ${c.label}` : `Marque-page ${c.label}`}
              accessibilityState={{ selected: on }}
              onPress={() => (on && bm ? removeBookmark(bm.id) : saveBookmark(target.s, target.a, name, c.hex))}
              style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.hex, alignItems: 'center', justifyContent: 'center', borderWidth: on ? 3 : 0, borderColor: pal.ink }}
            >
              {on ? <Ionicons name="bookmark" size={16} color="#fff" /> : null}
            </Pressable>
          );
        })}
      </View>
      {bm ? (
        <TextInput
          value={name}
          onChangeText={setName}
          onBlur={() => saveBookmark(target.s, target.a, name, bm.color)}
          placeholder="Nom du marque-page (ex. Révision du soir)"
          placeholderTextColor={pal.muted}
          accessibilityLabel="Nom du marque-page"
          style={{ marginTop: 10, minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: pal.line, backgroundColor: pal.card, color: pal.ink, paddingHorizontal: 12 }}
        />
      ) : null}

      <QLabel pal={pal}>SURLIGNER</QLabel>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        {HIGHLIGHTS.map((h) => {
          const on = m.hl[k] === h.hex;
          return (
            <Pressable key={h.hex} accessibilityRole="button" accessibilityLabel={`Surligner en ${h.label}`} accessibilityState={{ selected: on }} onPress={() => setHighlight(target.s, target.a, on ? null : h.hex)} style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: alpha(h.hex, 0.45), borderWidth: on ? 3 : 1, borderColor: on ? pal.ink : alpha(h.hex, 0.8) }} />
          );
        })}
        {m.hl[k] ? <QBtn small icon="close" label="Retirer" onPress={() => setHighlight(target.s, target.a, null)} pal={pal} /> : null}
      </View>

      <QLabel pal={pal}>NOTE PERSONNELLE</QLabel>
      <TextInput
        value={note}
        onChangeText={setNoteTxt}
        onBlur={() => setNote(target.s, target.a, note)}
        placeholder="Réflexion, leçon, lien avec un autre verset…"
        placeholderTextColor={pal.muted}
        multiline
        accessibilityLabel="Note sur ce verset"
        style={{ minHeight: 84, borderRadius: 12, borderWidth: 1, borderColor: pal.line, backgroundColor: pal.card, color: pal.ink, padding: 12, textAlignVertical: 'top' }}
      />
      <Text style={{ color: pal.muted, fontSize: 11, marginTop: 8 }}>Marque-pages, notes et surlignages restent sur cet appareil.</Text>
    </Sheet>
  );
}
