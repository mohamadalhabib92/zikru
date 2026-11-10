import { type ReactNode } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { LANDSCAPE_PLATE_ALPHA, type LandscapeChoice, type LandscapeId } from '@/lib/landscapes';
import { alpha, theme as t } from '@/ui/theme';

/** Une seule image à la fois : les autres fichiers ne sont pas décodés. Aucune animation. */
const SOURCES: Record<LandscapeId, number> = {
  lagoon: require('../../assets/landscapes/lagoon.webp'),
  dunes: require('../../assets/landscapes/dunes.webp'),
  mist: require('../../assets/landscapes/mist.webp'),
  stars: require('../../assets/landscapes/stars.webp'),
  oasis: require('../../assets/landscapes/oasis.webp'),
};

export function LandscapeBackdrop({ id }: { id: LandscapeChoice }) {
  if (id === 'none') return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Image accessible={false} source={SOURCES[id]} resizeMode="cover" fadeDuration={0} style={StyleSheet.absoluteFill} />
    </View>
  );
}

/** Plaque de lecture. Sans paysage, aucun habillage : l’écran reste identique. */
export function ReadingPlate({ on, children }: { on: boolean; children: ReactNode }) {
  if (!on) return <>{children}</>;
  const backgroundColor = LANDSCAPE_PLATE_ALPHA >= 1 ? t.bg : alpha(t.bg, LANDSCAPE_PLATE_ALPHA);
  return (
    <View style={{ backgroundColor, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, borderColor: t.border, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 8 }}>
      {children}
    </View>
  );
}
