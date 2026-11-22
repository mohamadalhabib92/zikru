import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { TvBack, TvButton, TvMuted, TvPremiumGate, TvRow, useTvFrame } from '@/components/tv/ui';
import { L } from '@/lib/l10n';
import { SURAHS } from '@/lib/surahs';
import { buildTvSurahRows, tvContentBox, type TvSurahInput } from '@/lib/tv-frame';
import { fonts } from '@/ui/theme';
import { Text } from '@/ui/Text';
import { fontsAreReady } from '@/ui/fonts-ready';

/**
 * Les 114 sourates sont dans `SURAHS` (synchrone). On les dessine toutes dans un ScrollView :
 * une FlatList tvOS dans un guide de focus avait une hauteur 0, donc ni lignes, ni Retour, ni « Chargement ».
 */
export default function TvQuranIndex() {
  const frame = useTvFrame();
  const [q, setQ] = useState('');
  const query = q.trim().toLowerCase();
  const contentWidth = tvContentBox(frame.width);
  const rows = useMemo(() => {
    const filtered = (SURAHS as readonly TvSurahInput[]).filter(
      (s) => !query || String(s[0]) === query || s[2].toLowerCase().includes(query) || s[1].includes(q.trim()),
    );
    return buildTvSurahRows(filtered);
  }, [q, query]);
  const font = fontsAreReady() ? fonts.quran : undefined;
  const missing = SURAHS.length === 0;
  return (
    <View style={{ flex: 1, width: frame.width, height: frame.height, minHeight: frame.height, backgroundColor: '#10211C' }}>
      <View style={{ width: frame.width, paddingHorizontal: 90, paddingTop: 48 }}>
        <Text style={{ color: '#F4F1EA', fontSize: 56, fontWeight: '800' }}>{L('Coran')}</Text>
        {missing ? (
          <TvMuted>{L('Le texte de cette sourate n’a pas pu être ouvert.')}</TvMuted>
        ) : (
          <TvMuted>{L('Choisissez une sourate. Le texte est celui déjà dans l’application. La récitation vient des mêmes sources.')}</TvMuted>
        )}
        <TvRow>
          {['', '1', '18', '36', '67', '112'].map((n) => (
            <TvButton key={n || 'all'} label={n ? `${n}` : L('Toutes')} onPress={() => setQ(n)} />
          ))}
          <TvBack />
        </TvRow>
      </View>
      {missing ? null : (
        <TvPremiumGate feature="quran">
          <ScrollView style={{ flex: 1, width: frame.width, height: frame.height }} contentContainerStyle={{ width: frame.width, paddingHorizontal: 90, paddingBottom: 72 }}>
            {rows.map((r) => (
              <View key={r.n} style={{ width: contentWidth, minHeight: r.minHeight, marginBottom: 16 }}>
                <TvButton
                  preferred={r.preferred}
                  block
                  label={r.label}
                  hint={r.hint}
                  aside={r.aside}
                  asideFont={font}
                  onPress={() => router.push(`/tv/quran/${r.n}`)}
                />
              </View>
            ))}
          </ScrollView>
        </TvPremiumGate>
      )}
    </View>
  );
}
