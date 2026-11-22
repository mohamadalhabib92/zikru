import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { TvButton, TvMuted, TvRow, TvScroll, TvTitle, useTvGrid } from '@/components/tv/ui';
import { usePremium } from '@/lib/premium';
import { useFeatureFlags } from '@/lib/use-premium';
import { TV_FEATURES, tvFeatureAllowed, tvPremiumActive } from '@/lib/tv';
import { chunkTv } from '@/lib/tv-surface';
import { L } from '@/lib/l10n';
import { Text } from '@/ui/Text';
import { theme as t } from '@/ui/theme';

const TILES: { href: '/tv/quran' | '/tv/aqida' | '/tv/prayers' | '/tv/dhikr' | '/tv/ambient' | '/tv/kids' | '/tv/join' | '/tv/chat'; label: string; hint: string; feature: 'quran' | 'aqida' | 'prayers' | 'dhikr' | 'ambient' | 'kids' | 'join' | 'chat' }[] = [
  { href: '/tv/quran', label: 'Coran', hint: 'Grand texte et récitation', feature: 'quran' },
  { href: '/tv/aqida', label: 'Aqida (Ibn ʿĀshir)', hint: 'ʿAqīda ashʿarite, selon le matn d’Ibn ʿĀshir', feature: 'aqida' },
  { href: '/tv/prayers', label: 'Prières', hint: 'Horaires et adhan', feature: 'prayers' },
  { href: '/tv/dhikr', label: 'Dhikr en famille', hint: 'Compteur partagé', feature: 'dhikr' },
  { href: '/tv/ambient', label: 'Ambiance', hint: 'Paysage du salon', feature: 'ambient' },
  { href: '/tv/kids', label: 'Enfants', hint: 'Un grand bouton, sans comparaison', feature: 'kids' },
  { href: '/tv/join', label: 'Rejoindre', hint: 'Gratuit, avec un code', feature: 'join' },
  { href: '/tv/chat', label: 'Discussion', hint: 'Gratuit, avec la famille', feature: 'chat' },
];

export default function TvHome() {
  const premium = usePremium();
  const flags = useFeatureFlags();
  const [restored, setRestored] = useState<boolean | null>(null);
  const entitled = tvPremiumActive(premium.record, flags.serverPremium ? { plan: 'premium' } : null);
  const grid = useTvGrid();
  return (
    <TvScroll>
      <Text style={{ color: t.accent, fontSize: 28, fontWeight: '800', letterSpacing: 1.6 }}>ZIKRU</Text>
      <TvTitle>{L('Zikru')}</TvTitle>
      <TvMuted>{L('Le salon : le Coran, la prière et le dhikr de la famille, sur grand écran.')}</TvMuted>
      {chunkTv(TILES, grid.columns).map((row) => (
        <TvRow key={row.map((cell) => cell.item.href).join('-')} gap={grid.gap}>
          {row.map((cell) => {
            const tile = cell.item;
            const locked = TV_FEATURES[tile.feature].premium && premium.ready && !tvFeatureAllowed(tile.feature, entitled, premium.payments);
            return (
              <View key={tile.href} style={{ width: grid.tileWidth, minWidth: grid.tileWidth, maxWidth: grid.tileWidth, flexBasis: grid.tileWidth, flexGrow: 0, flexShrink: 0 }}>
                <TvButton
                  block
                  preferred={cell.index === 0}
                  label={L(tile.label)}
                  hint={L(tile.hint)}
                  locked={locked}
                  onPress={() => router.push(tile.href)}
                />
              </View>
            );
          })}
        </TvRow>
      ))}
      {!entitled ? (
        <>
          <TvRow>
            <View style={{ width: Math.max(grid.tileWidth, 420), flexGrow: 0, flexShrink: 0 }}>
              <TvButton block label={L('Restaurer les achats')} hint={L('Même identifiant Apple que sur iPhone')} onPress={() => void premium.restore().then(setRestored)} />
            </View>
          </TvRow>
          {restored === false && premium.phase !== 'offline' ? <TvMuted>{L('Aucun achat Premium à restaurer pour ce compte Apple.')}</TvMuted> : null}
          {premium.phase === 'offline' ? <TvMuted>{L('Pas de connexion. Réessayez quand vous serez en ligne.')}</TvMuted> : null}
        </>
      ) : null}
    </TvScroll>
  );
}
