import { ActivityIndicator, Pressable, View } from 'react-native';
import { Text } from '@/ui/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { readerPrefs } from '@/lib/quran-store';
import { reciterById } from '@/lib/recitation';
import { useShared } from '@/lib/shared-state';
import { SURAHS } from '@/lib/surahs';
import type { useRecitation } from '@/lib/use-recitation';
import { Ionicons } from '@/ui/kit';
import { alpha, elevation } from '@/ui/theme';
import type { Pal } from './palette';
import { RATES } from './ReaderSettings';
import { L } from '@/lib/l10n';

type Rec = ReturnType<typeof useRecitation>;

/** Barre de récitation flottante (verset en cours, précédent / lecture / suivant, vitesse, boucle, arrêt). */
export function AudioBar({ rec, pal, extra }: { rec: Rec; pal: Pal; extra?: string }) {
  const insets = useSafeAreaInsets();
  const [p, set] = useShared(readerPrefs);
  if (rec.pos < 0 && !rec.error) return null;
  const st = rec.step;
  const r = reciterById(p.reciter);
  const btn = (icon: 'play-skip-back' | 'play-skip-forward' | 'stop', label: string, on: () => void) => (
    <Pressable accessibilityRole="button" accessibilityLabel={typeof label === "string" ? L(label) : label} onPress={on} hitSlop={6} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={icon} size={20} color={pal.ink} />
    </Pressable>
  );
  return (
    <View style={{ position: 'absolute', left: 12, right: 12, bottom: Math.max(insets.bottom, 10), alignItems: 'center' }} pointerEvents="box-none">
      <View style={[{ width: '100%', maxWidth: 620, backgroundColor: pal.card, borderRadius: 20, borderWidth: 1, borderColor: pal.line, paddingVertical: 8, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6 }, elevation(3)]}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: pal.ink, fontWeight: '800' }} numberOfLines={1}>
            {st ? `${SURAHS[st.s - 1][2]} · ${st.s}:${st.a}` : 'Récitation'}
          </Text>
          <Text style={{ color: rec.error ? '#C24D5C' : pal.muted, fontSize: 12 }} numberOfLines={1}>
            {rec.error ?? extra ?? r.name}
          </Text>
        </View>
        {btn('play-skip-back', 'Verset précédent', () => rec.skip(-1))}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={rec.playing ? 'Pause' : 'Lecture'}
          onPress={() => (rec.playing ? rec.pause() : rec.resume())}
          style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: pal.accent, alignItems: 'center', justifyContent: 'center' }}
        >
          {rec.loading && rec.playing ? <ActivityIndicator color={pal.dark ? '#06120D' : '#fff'} /> : <Ionicons name={rec.playing ? 'pause' : 'play'} size={22} color={pal.dark ? '#06120D' : '#fff'} />}
        </Pressable>
        {btn('play-skip-forward', 'Verset suivant', () => rec.skip(1))}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={L('Vitesse ×{r}', { r: p.rate })}
          onPress={() => set((o) => ({ ...o, rate: RATES[(RATES.indexOf(o.rate) + 1) % RATES.length] }))}
          style={{ minWidth: 44, height: 32, borderRadius: 16, backgroundColor: alpha(pal.muted, 0.14), alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 }}
        >
          <Text style={{ color: pal.ink, fontWeight: '800', fontSize: 12 }}>{`×${p.rate}`}</Text>
        </Pressable>
        <Pressable accessibilityRole="switch" accessibilityState={{ checked: rec.loop }} accessibilityLabel={L("Répéter en boucle")} onPress={() => rec.setLoop(!rec.loop)} hitSlop={6} style={{ width: 36, height: 40, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="repeat" size={20} color={rec.loop ? pal.accent : pal.muted} />
        </Pressable>
        {btn('stop', 'Arrêter la récitation', rec.stop)}
      </View>
    </View>
  );
}
