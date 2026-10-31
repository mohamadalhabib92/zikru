import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { Text } from '@/ui/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { readerPrefs } from '@/lib/quran-store';
import { reciterById } from '@/lib/recitation';
import type { GlobalRec } from '@/lib/recitation-context';
import { useShared } from '@/lib/shared-state';
import { fmtClock, sleepLeft } from '@/lib/sleep-timer';
import { SURAHS } from '@/lib/surahs';
import type { useRecitation } from '@/lib/use-recitation';
import { Ionicons } from '@/ui/kit';
import { alpha, elevation } from '@/ui/theme';
import type { Pal } from './palette';
import { RATES } from './ReaderSettings';
import { SleepSheet } from './SleepSheet';
import { L } from '@/lib/l10n';

type Rec = ReturnType<typeof useRecitation> | GlobalRec;
const hasSleep = (r: Rec): r is GlobalRec => 'setSleep' in r;

/** Libellé court de la minuterie (« 14:59 », « fin de sourate ») ou null. */
export function useSleepLabel(rec: Rec): string | null {
  const sl = hasSleep(rec) ? rec.sleep : null;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!sl || sl.kind !== 'at') return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [sl]);
  if (!sl || sl.kind === 'off') return null;
  if (sl.kind === 'surah') return L('Arrêt en fin de sourate');
  return L('Arrêt dans {t}', { t: fmtClock(sleepLeft(sl, now) ?? 0) });
}

/**
 * Barre de récitation flottante : verset en cours, minuterie, arrêt (1re ligne) ;
 * vitesse, précédent / lecture / suivant, boucle, répétition A-B (2e ligne). Cibles tactiles ≥ 44 pt.
 */
export function AudioBar({ rec, pal, extra, onAB }: { rec: Rec; pal: Pal; extra?: string; onAB?: () => void }) {
  const insets = useSafeAreaInsets();
  const [p, set] = useShared(readerPrefs);
  const [sleepOpen, setSleepOpen] = useState(false);
  const sleepLabel = useSleepLabel(rec);
  if (rec.pos < 0 && !rec.error) return null;
  const st = rec.step;
  const r = reciterById(p.reciter);
  const fg = pal.dark ? '#06120D' : '#fff';
  const btn = (icon: 'play-skip-back' | 'play-skip-forward' | 'stop' | 'moon' | 'moon-outline', label: string, on: () => void, color = pal.ink) => (
    <Pressable accessibilityRole="button" accessibilityLabel={L(label)} onPress={on} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={icon} size={20} color={color} />
    </Pressable>
  );
  return (
    <View style={{ position: 'absolute', left: 12, right: 12, bottom: Math.max(insets.bottom, 10), alignItems: 'center' }} pointerEvents="box-none">
      <View style={[{ width: '100%', maxWidth: 620, backgroundColor: pal.card, borderRadius: 20, borderWidth: 1, borderColor: pal.line, paddingVertical: 6, paddingHorizontal: 10 }, elevation(3)]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <View style={{ flex: 1, minWidth: 0, paddingLeft: 4 }}>
            <Text style={{ color: pal.ink, fontWeight: '800' }} numberOfLines={1}>
              {st ? `${SURAHS[st.s - 1][2]} · ${st.s}:${st.a}` : 'Récitation'}
            </Text>
            <Text style={{ color: rec.error ? '#C24D5C' : sleepLabel ? pal.accent : pal.muted, fontSize: 12 }} numberOfLines={1}>
              {rec.error ?? (sleepLabel ? `${sleepLabel} · ${extra ?? r.name}` : (extra ?? r.name))}
            </Text>
          </View>
          {hasSleep(rec) ? btn(sleepLabel ? 'moon' : 'moon-outline', 'Minuterie de sommeil', () => setSleepOpen(true), sleepLabel ? pal.accent : pal.muted) : null}
          {btn('stop', 'Arrêter la récitation', rec.stop)}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={L('Vitesse ×{r}', { r: p.rate })}
            onPress={() => set((o) => ({ ...o, rate: RATES[(RATES.indexOf(o.rate) + 1) % RATES.length] }))}
            style={{ minWidth: 52, height: 44, alignItems: 'center', justifyContent: 'center' }}
          >
            <View style={{ minWidth: 48, height: 32, borderRadius: 16, backgroundColor: alpha(pal.muted, 0.14), alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 }}>
              <Text style={{ color: pal.ink, fontWeight: '800', fontSize: 12 }}>{`×${p.rate}`}</Text>
            </View>
          </Pressable>
          {btn('play-skip-back', 'Verset précédent', () => rec.skip(-1))}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={rec.playing ? L('Pause') : L('Lecture')}
            onPress={() => (rec.playing ? rec.pause() : rec.resume())}
            style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: pal.accent, alignItems: 'center', justifyContent: 'center' }}
          >
            {rec.loading && rec.playing ? <ActivityIndicator color={fg} /> : <Ionicons name={rec.playing ? 'pause' : 'play'} size={22} color={fg} />}
          </Pressable>
          {btn('play-skip-forward', 'Verset suivant', () => rec.skip(1))}
          <Pressable accessibilityRole="switch" accessibilityState={{ checked: rec.loop }} accessibilityLabel={L('Répéter en boucle')} onPress={() => rec.setLoop(!rec.loop)} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="repeat" size={20} color={rec.loop ? pal.accent : pal.muted} />
          </Pressable>
          {onAB ? (
            <Pressable accessibilityRole="button" accessibilityLabel={L('Répétition A-B')} onPress={onAB} style={{ minWidth: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: pal.muted, fontWeight: '900', fontSize: 13 }}>A-B</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
      {hasSleep(rec) ? <SleepSheet visible={sleepOpen} onClose={() => setSleepOpen(false)} rec={rec} pal={pal} /> : null}
    </View>
  );
}
