import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { TvButton, TvMuted, TvPremiumGate, TvRow, TvTitle, TvVirtualList } from '@/components/tv/ui';
import { L } from '@/lib/l10n';
import { SURAHS } from '@/lib/surahs';
import { fonts } from '@/ui/theme';
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
      <>
        <TvTitle>{L('Coran')}</TvTitle>
        <TvMuted>{L('Choisissez une sourate. Le texte est celui déjà dans l’application. La récitation vient des mêmes sources.')}</TvMuted>
        <TvRow>
          {['', '1', '18', '36', '67', '112'].map((n, i) => (
            <TvButton key={n || 'all'} preferred={i === 0} label={n ? `${n}` : L('Toutes')} onPress={() => setQ(n)} />
          ))}
        </TvRow>
      </>
    ),
    [],
  );
  return (
    <TvPremiumGate feature="quran">
      <TvVirtualList
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
  );
}
