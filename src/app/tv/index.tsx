import { router } from 'expo-router';
import { View } from 'react-native';
import { TvButton, TvMuted, TvRow, TvScroll, TvTitle, useTvGrid } from '@/components/tv/ui';
import { usePremium } from '@/lib/premium';
import { tvFeatureAllowed } from '@/lib/tv';
import { L } from '@/lib/l10n';
import { Text } from '@/ui/Text';
import { theme as t } from '@/ui/theme';

const TILES: { href: '/tv/quran' | '/tv/prayers' | '/tv/dhikr' | '/tv/ambient' | '/tv/kids' | '/tv/join' | '/tv/chat'; label: string; hint: string; feature: 'quran' | 'prayers' | 'dhikr' | 'ambient' | 'kids' | 'join' | 'chat' }[] = [
  { href: '/tv/quran', label: 'Coran', hint: 'Grand texte et récitation', feature: 'quran' },
  { href: '/tv/prayers', label: 'Prières', hint: 'Horaires et adhan', feature: 'prayers' },
  { href: '/tv/dhikr', label: 'Dhikr en famille', hint: 'Compteur partagé', feature: 'dhikr' },
  { href: '/tv/ambient', label: 'Ambiance', hint: 'Paysage du salon', feature: 'ambient' },
  { href: '/tv/kids', label: 'Enfants', hint: 'Un grand bouton, sans comparaison', feature: 'kids' },
  { href: '/tv/join', label: 'Rejoindre', hint: 'Gratuit, avec un code', feature: 'join' },
  { href: '/tv/chat', label: 'Discussion', hint: 'Gratuit, avec la famille', feature: 'chat' },
];

export default function TvHome() {
  const premium = usePremium();
  const grid = useTvGrid();
  return (
    <TvScroll>
      <Text style={{ color: t.accent, fontSize: 28, fontWeight: '800', letterSpacing: 1.6 }}>ZIKRU</Text>
      <TvTitle>{L('Zikru')}</TvTitle>
      <TvMuted>{L('Le salon : le Coran, la prière et le dhikr de la famille, sur grand écran.')}</TvMuted>
      <TvRow gap={grid.gap}>
        {TILES.map((tile, i) => {
          const locked = premium.ready && !tvFeatureAllowed(tile.feature, premium.canCreate);
          return (
            <View key={tile.href} style={{ width: grid.tileWidth, flexGrow: 0, flexShrink: 0 }}>
              <TvButton
                block
                preferred={i === 0}
                label={L(tile.label)}
                hint={L(tile.hint)}
                locked={locked}
                onPress={() => router.push(tile.href)}
              />
            </View>
          );
        })}
      </TvRow>
    </TvScroll>
  );
}
