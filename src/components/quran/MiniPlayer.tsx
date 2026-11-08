import { router } from 'expo-router';
import { ActivityIndicator, Pressable, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/ui/Text';
import { readerPrefs } from '@/lib/quran-store';
import { reciterById } from '@/lib/recitation';
import { useMaybeGlobalRecitation } from '@/lib/recitation-context';
import { useShared } from '@/lib/shared-state';
import { SURAHS } from '@/lib/surahs';
import { hasSidebar, SIDEBAR_WIDTH } from '@/ui/ds';
import { Ionicons } from '@/ui/kit';
import { elevation } from '@/ui/theme';
import { readerPalette } from './palette';
import { useSleepLabel } from './AudioBar';
import { L } from '@/lib/l10n';

const TAB_ROUTES = new Set(['/', '/prayers', '/tasbih', '/read', '/more']);
/** Écrans qui ont déjà leur propre barre de lecture. */
const hiddenOn = (path: string) => /^\/quran\/(\d+|mushaf|hifz-session)$/.test(path) || /^\/(kahf|songs|onboarding)$/.test(path);

/** Mini-lecteur persistant : la récitation continue en naviguant ; toucher le titre rouvre la sourate. */
export function MiniPlayer({ path }: { path: string }) {
  const rec = useMaybeGlobalRecitation();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [p] = useShared(readerPrefs);
  const sleepLabel = useSleepLabel(rec ?? ({ setSleep: () => {}, sleep: { kind: 'off' } } as never));
  if (!rec || (rec.pos < 0 && !rec.error) || hiddenOn(path)) return null;
  const pal = readerPalette('auto');
  const st = rec.step;
  const onTabs = TAB_ROUTES.has(path);
  const side = onTabs && hasSidebar(width);
  const bottom = onTabs && !side ? 60 + insets.bottom + 8 : Math.max(insets.bottom, 10);
  const fg = pal.dark ? '#06120D' : '#fff';
  return (
    <View style={{ position: 'absolute', left: (side ? SIDEBAR_WIDTH : 0) + 12, right: 12, bottom, alignItems: 'center' }} pointerEvents="box-none">
      <View style={[{ width: '100%', maxWidth: 560, backgroundColor: pal.card, borderRadius: 18, borderWidth: 1, borderColor: pal.line, paddingVertical: 4, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 4 }, elevation(3)]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={st ? L('Ouvrir la sourate {n}', { n: SURAHS[st.s - 1][2] }) : L('Récitation')}
          onPress={() => st && router.push(`/quran/${st.s}`)}
          style={{ flex: 1, minWidth: 0, minHeight: 44, justifyContent: 'center', paddingLeft: 6 }}
        >
          <Text style={{ color: pal.ink, fontWeight: '800' }} numberOfLines={1}>
            {st ? `${SURAHS[st.s - 1][2]} · ${st.s}:${st.a}` : 'Récitation'}
          </Text>
          <Text style={{ color: rec.error ? '#C24D5C' : sleepLabel ? pal.accent : pal.muted, fontSize: 12 }} numberOfLines={1}>
            {rec.error ?? sleepLabel ?? reciterById(p.reciter).name}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={rec.playing ? L('Pause') : L('Lecture')}
          onPress={() => (rec.playing ? rec.pause() : rec.resume())}
          style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: pal.accent, alignItems: 'center', justifyContent: 'center' }}
        >
          {rec.loading && rec.playing ? <ActivityIndicator color={fg} /> : <Ionicons name={rec.playing ? 'pause' : 'play'} size={20} color={fg} />}
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={L('Arrêter la récitation')} onPress={rec.stop} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="close" size={20} color={pal.muted} />
        </Pressable>
      </View>
    </View>
  );
}
