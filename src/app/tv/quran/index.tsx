import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTvFrame } from '@/components/tv/ui';
import { L } from '@/lib/l10n';
import { loadTvSurahCatalog, paintTvSurahPage, TV_SURAH_BG, TV_SURAH_INK, TV_SURAH_ROW, type TvSurahCatalog } from '@/lib/tv-quran-catalog';
import { Text } from '@/ui/Text';

/**
 * Build 15 : le titre s’affichait, pas les lignes ni Retour.
 * Les 114 noms sont déjà dans le JavaScript (le sous-titre « choisissez » le prouve :
 * la branche « catalogue vide » n’a pas tourné). Les contrôles étaient dans un guide
 * de focus, sans hauteur en points : tvOS leur donnait 0 et ne dessinait qu’un trait.
 * Ici chaque contrôle a une hauteur fixe. Le Coran de la télé n’est pas payant.
 */
const BUTTON = {
  height: TV_SURAH_ROW,
  minWidth: 280,
  paddingHorizontal: 28,
  marginRight: 16,
  borderRadius: 18,
  backgroundColor: TV_SURAH_BG,
  justifyContent: 'center' as const,
};

export default function TvQuranIndex() {
  const frame = useTvFrame();
  const [catalog, setCatalog] = useState<TvSurahCatalog>(() => loadTvSurahCatalog());
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>(catalog.status === 'error' ? 'error' : 'ready');
  const [page, setPage] = useState(0);
  const contentW = Math.max(640, Math.min(frame.width - 180, 1600));
  const board = paintTvSurahPage(catalog.surahs, page);
  const retry = () => {
    setPhase('loading');
    const next = loadTvSurahCatalog();
    setCatalog(next);
    setPage(0);
    setPhase(next.status === 'error' ? 'error' : 'ready');
  };
  return (
    <View style={{ flex: 1, width: frame.width, height: frame.height, backgroundColor: '#10211C', paddingHorizontal: 90, paddingTop: 36 }}>
      <Text style={{ color: TV_SURAH_INK, fontSize: 48, fontWeight: '800', height: 58 }}>{L('Coran')}</Text>
      <Text style={{ color: TV_SURAH_INK, fontSize: 26, lineHeight: 34, height: 72 }}>
        {L('Choisissez une sourate. Le texte est celui déjà dans l’application. La récitation vient des mêmes sources.')}
      </Text>
      {phase === 'loading' ? (
        <Text style={{ color: TV_SURAH_INK, fontSize: 32, height: 48 }}>{L('Chargement…')}</Text>
      ) : null}
      {phase === 'error' ? (
        <Text style={{ color: '#F6E7B8', fontSize: 26, lineHeight: 34, height: 70 }}>{catalog.message}</Text>
      ) : null}
      {board.rows.map((row) => (
        <Pressable
          key={row.n}
          hasTVPreferredFocus={row.preferred && phase === 'ready'}
          accessibilityRole="button"
          accessibilityLabel={row.label}
          onPress={() => router.push(`/tv/quran/${row.n}`)}
          style={{
            height: row.height,
            width: contentW,
            backgroundColor: row.backgroundColor,
            borderRadius: 16,
            marginBottom: 10,
            paddingHorizontal: 24,
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: row.color, fontSize: 32, fontWeight: '800' }}>{row.label}</Text>
        </Pressable>
      ))}
      <View style={{ flexDirection: 'row', height: TV_SURAH_ROW, marginTop: 8, alignItems: 'center' }}>
        <Pressable accessibilityRole="button" onPress={() => setPage((p) => Math.max(0, p - 1))} style={BUTTON}>
          <Text style={{ color: TV_SURAH_INK, fontSize: 28, fontWeight: '800' }}>{L('Page précédente')}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => setPage((p) => Math.min(board.pages - 1, p + 1))} style={BUTTON}>
          <Text style={{ color: TV_SURAH_INK, fontSize: 28, fontWeight: '800' }}>{L('Page suivante')}</Text>
        </Pressable>
        {phase === 'error' ? (
          <Pressable accessibilityRole="button" onPress={retry} style={BUTTON}>
            <Text style={{ color: TV_SURAH_INK, fontSize: 28, fontWeight: '800' }}>{L('Réessayer')}</Text>
          </Pressable>
        ) : null}
        <Pressable accessibilityRole="button" hasTVPreferredFocus={phase !== 'ready'} onPress={() => router.back()} style={BUTTON}>
          <Text style={{ color: TV_SURAH_INK, fontSize: 28, fontWeight: '800' }}>{L('Retour')}</Text>
        </Pressable>
        <Text style={{ color: TV_SURAH_INK, fontSize: 26 }}>{board.page + 1} / {board.pages}</Text>
      </View>
    </View>
  );
}
