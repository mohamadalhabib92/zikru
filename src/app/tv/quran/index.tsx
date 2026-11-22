import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { TvBack, TvButton, TvMuted, TvPremiumGate, TvRow, TvVirtualList } from '@/components/tv/ui';
import { L } from '@/lib/l10n';
import { SURAHS } from '@/lib/surahs';
import { fonts } from '@/ui/theme';
import { Text } from '@/ui/Text';
import { fontsAreReady } from '@/ui/fonts-ready';

type Surah = (typeof SURAHS)[number];

export default function TvQuranIndex() {
  const [q, setQ] = useState('');
  const query = q.trim().toLowerCase();
  const rows = useMemo(
    () => SURAHS.filter((s) => !query || String(s[0]) === query || s[2].toLowerCase().includes(query) || s[1].includes(q.trim())),
    [q, query],
  );
  const font = fontsAreReady() ? fonts.quran : undefined;
  const header = useMemo(
    () => (
      <TvRow>
        {['', '1', '18', '36', '67', '112'].map((n, i) => (
          <TvButton key={n || 'all'} preferred={i === 0} label={n ? `${n}` : L('Toutes')} onPress={() => setQ(n)} />
        ))}
        <TvBack />
      </TvRow>
    ),
    [],
  );
  const missing = SURAHS.length === 0;
  return (
    <View style={{ flex: 1, minHeight: 720, backgroundColor: '#10211C' }}>
      <View style={{ paddingHorizontal: 90, paddingTop: 60 }}>
        <Text style={{ color: '#F4F1EA', fontSize: 56, fontWeight: '800' }}>{L('Coran')}</Text>
        {missing ? (
          <>
            <TvMuted>{L('Le texte de cette sourate n’a pas pu être ouvert.')}</TvMuted>
            <TvBack />
          </>
        ) : (
          <TvMuted>{L('Choisissez une sourate. Le texte est celui déjà dans l’application. La récitation vient des mêmes sources.')}</TvMuted>
        )}
      </View>
      {missing ? null : (
    <TvPremiumGate feature="quran">
      <TvVirtualList
        grid
        data={rows}
        keyExtractor={(s) => String(s[0])}
        header={header}
        renderItem={(s: Surah) => (
          <TvButton
            block
            label={`${s[0]}. ${s[2]}`}
            hint={`${s[4]}`}
            aside={s[1]}
            asideFont={font}
            onPress={() => router.push(`/tv/quran/${s[0]}`)}
          />
        )}
      />
    </TvPremiumGate>
      )}
    </View>
  );
}
