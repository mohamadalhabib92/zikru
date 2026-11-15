import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { TvButton, TvMuted, TvPremiumGate, TvScroll, TvTitle } from '@/components/tv/ui';
import { L } from '@/lib/l10n';
import { SURAHS } from '@/lib/surahs';
import { Text } from '@/ui/Text';
import { fonts, theme as t } from '@/ui/theme';
import { fontsAreReady } from '@/ui/fonts-ready';

export default function TvQuranIndex() {
  const [q, setQ] = useState('');
  const query = q.trim().toLowerCase();
  const rows = SURAHS.filter((s) => !query || String(s[0]) === query || s[2].toLowerCase().includes(query) || s[1].includes(q.trim()));
  return (
    <TvPremiumGate feature="quran">
      <TvScroll>
        <TvTitle>{L('Coran')}</TvTitle>
        <TvMuted>{L('Choisissez une sourate. Le texte est celui déjà dans l’application. La récitation vient des mêmes sources.')}</TvMuted>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 22 }}>
          {['', '1', '18', '36', '67', '112'].map((n, i) => (
            <TvButton key={n || 'all'} preferred={i === 0} label={n ? `${n}` : L('Toutes')} onPress={() => setQ(n)} />
          ))}
        </View>
        <View style={{ marginTop: 18 }}>
          {rows.map((s, i) => (
            <View key={s[0]} style={{ marginBottom: 10 }}>
              <TvButton
                preferred={i === 0 && !q}
                label={`${s[0]}. ${s[2]}`}
                hint={`${s[4]}`}
                onPress={() => router.push(`/tv/quran/${s[0]}`)}
              />
              <Text style={{ position: 'absolute', right: 28, top: 28, color: t.accent, fontSize: 28, fontFamily: fontsAreReady() ? fonts.quran : undefined }}>{s[1]}</Text>
            </View>
          ))}
        </View>
      </TvScroll>
    </TvPremiumGate>
  );
}
