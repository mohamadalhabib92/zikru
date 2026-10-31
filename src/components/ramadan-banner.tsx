import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/ui/Text';
import { tapHaptic } from '@/ui/ds';
import { Ionicons } from '@/ui/kit';
import { alpha, brand as b, onColor } from '@/ui/theme';
import { addDays, confirmEnd, dismiss, fromKey } from '@/lib/ramadan';
import { useRamadan } from '@/lib/ramadan-store';
import { L, useUiLang } from '@/lib/l10n';

const Chip = ({ label, onPress, primary }: { label: string; onPress: () => void; primary?: boolean }) => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel={label}
    onPress={() => {
      tapHaptic('select');
      onPress();
    }}
    style={({ pressed }) => ({ minHeight: 44, paddingHorizontal: 14, justifyContent: 'center', borderRadius: 22, borderWidth: 1, borderColor: primary ? b.gold : b.line, backgroundColor: primary ? b.gold : b.paper, opacity: pressed ? 0.85 : 1 })}
  >
    <Text maxFontSizeMultiplier={1.35} style={{ color: primary ? onColor(b.gold) : b.ink, fontWeight: '800', fontSize: 14 }}>
      {label}
    </Text>
  </Pressable>
);

function useShort() {
  const lang = useUiLang();
  const loc = lang === 'ar' ? 'ar' : lang === 'en' ? 'en-GB' : lang === 'de' ? 'de-CH' : 'fr-CH';
  return (k: string) => fromKey(k).toLocaleDateString(loc, { weekday: 'short', day: 'numeric', month: 'short' });
}

/**
 * Confirmation locale du 1er jour (selon la mosquée / l’observation) : 3 dates autour de l’estimation.
 * Règle le décalage hégirien de toute l’app quand c’est possible (−2…+2).
 */
export function ConfirmStart({ compact = true }: { compact?: boolean }) {
  const { prefs, setPrefs, st, confirm } = useRamadan();
  const short = useShort();
  const [note, setNote] = useState<string | null>(null);
  const confirmed = prefs.confirmed?.year === st.year && !!prefs.confirmed.start;
  if (compact && st.ask !== 'start') return null;
  const base = confirmed ? prefs.confirmed!.start! : st.start;
  const opts = [-1, 0, 1].map((n) => addDays(base, n));
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: b.ink, fontWeight: '800' }}>{confirmed ? L('1er jour confirmé : {d}', { d: short(prefs.confirmed!.start!) }) : L('Quel est le 1er jour de jeûne selon votre mosquée ?')}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {opts.map((k) => (
          <Chip key={k} label={short(k)} primary={confirmed && k === base} onPress={() => setNote(confirm(k) ? L('Merci : le calendrier hégirien de l’app suit maintenant cette date.') : L('Date hors de la plage de décalage (±2 j) : elle sert au mode Ramadan uniquement.'))} />
        ))}
        {compact ? <Chip label={L('Plus tard')} onPress={() => setPrefs((p) => dismiss(p, `${st.year}-start`))} /> : null}
      </View>
      {note ? (
        <Text accessibilityLiveRegion="polite" style={{ color: b.inkMuted, fontSize: 13 }}>
          {note}
        </Text>
      ) : null}
    </View>
  );
}

/** Bandeau d’accueil du mode Ramadan (léger : le module complet est chargé à la demande). */
export function RamadanBanner() {
  const router = useRouter();
  const { prefs, setPrefs, st, ready } = useRamadan();
  const short = useShort();
  if (!ready || prefs.mode === 'off' && !st.active) return null;
  const soon = st.phase === 'before' && st.daysUntil <= 7;
  if (!st.active && !st.ask && !soon) return null;
  const title = st.active ? L('Ramadan Mubarak · jour {d} sur {n}', { d: st.day, n: st.length }) : st.phase === 'before' ? L('Ramadan {y} : dans {n} j (estimation)', { y: st.year, n: st.daysUntil }) : L('Ramadan {y}', { y: st.year });
  return (
    <View style={{ marginBottom: 14, padding: 14, gap: 10, borderRadius: 20, borderWidth: 1, borderColor: alpha(b.gold, 0.45), backgroundColor: alpha(b.gold, 0.1) }}>
      <Pressable accessibilityRole="button" accessibilityLabel={title + ', ' + L('Suhur et iftar')} onPress={() => router.push(st.active ? '/ramadan?s=compte' : '/ramadan')} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 }}>
        <Ionicons name="moon" size={22} color={b.goldDeep} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: b.ink, fontWeight: '900', fontSize: 16 }}>{title}</Text>
          <Text style={{ color: b.inkMuted, fontSize: 13 }}>{st.active ? L('Suhur et iftar · suivis privés') : L('Mode Ramadan : préparez vos rappels')}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={b.inkMuted} />
      </Pressable>
      {st.ask === 'start' ? <ConfirmStart /> : null}
      {st.ask === 'end' ? (
        <View style={{ gap: 8 }}>
          <Text style={{ color: b.ink, fontWeight: '800' }}>{L('Dernier jour de jeûne selon votre mosquée ?')}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Chip label={L('29e jour · {d}', { d: short(addDays(st.start, 28)) })} onPress={() => setPrefs((p) => confirmEnd(p, st.year, addDays(st.start, 28)))} />
            <Chip label={L('30e jour · {d}', { d: short(addDays(st.start, 29)) })} onPress={() => setPrefs((p) => confirmEnd(p, st.year, addDays(st.start, 29)))} />
            <Chip label={L('Plus tard')} onPress={() => setPrefs((p) => dismiss(p, `${st.year}-end`))} />
          </View>
        </View>
      ) : null}
    </View>
  );
}
