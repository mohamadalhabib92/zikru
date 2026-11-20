import { BlurView } from 'expo-blur';
import type { ReactNode } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useVisualEffects } from './effects';
import { currentFinish, glassSolidColor, isDark, isGlass } from './theme';

const WASH_LIGHT = 'rgba(255,252,247,0.88)';
const WASH_DARK = 'rgba(18,29,25,0.88)';

function webBlur(intensity: number): ViewStyle | null {
  if (Platform.OS !== 'web' || intensity <= 0) return null;
  const px = Math.round(intensity / 3);
  return { backdropFilter: `blur(${px}px)`, WebkitBackdropFilter: `blur(${px}px)` } as ViewStyle;
}

/**
 * Fond dépoli. Le voile (alpha ≥ 0,88) porte le texte : le flou ne sert pas de contraste.
 * Web : backdrop-filter, et le voile reste si le navigateur l’ignore.
 * « Réduire la transparence », ou une montre : pas de flou, fond plein (glassSolidColor).
 */
export function GlassLayers({ children, style, radius = 18 }: { children: ReactNode; style?: StyleProp<ViewStyle>; radius?: number }) {
  const fx = useVisualEffects();
  const dark = isDark();
  const gold = currentFinish() === 'verre-or';
  const border = gold ? 'rgba(217,182,92,0.7)' : dark ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.85)';
  const lift: ViewStyle = {
    borderRadius: radius,
    boxShadow: dark
      ? '0 1px 2px rgba(0,0,0,0.45), 0 10px 18px rgba(0,0,0,0.35)'
      : '0 1px 2px rgba(15,61,48,0.14), 0 8px 16px rgba(15,61,48,0.10)',
  };
  const clip: ViewStyle = { borderRadius: radius, overflow: 'hidden', borderWidth: 1, borderColor: border };
  if (!fx.blur || fx.intensity <= 0) {
    return (
      <View style={[lift, style]}>
        <View style={[clip, { backgroundColor: glassSolidColor() }]}>{children}</View>
      </View>
    );
  }
  const wash = dark ? WASH_DARK : WASH_LIGHT;
  return (
    <View style={[lift, style]}>
      <View style={clip}>
        <BlurView intensity={fx.intensity} tint={dark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        <View style={[{ backgroundColor: wash }, webBlur(fx.intensity)]}>{children}</View>
      </View>
    </View>
  );
}

/** Remplit la barre d’onglets ou un en-tête. Opaque si le flou est coupé. */
export function GlassFill() {
  const fx = useVisualEffects();
  const dark = isDark();
  if (!fx.blur || fx.intensity <= 0) {
    return <View style={[StyleSheet.absoluteFill, { backgroundColor: glassSolidColor() }]} />;
  }
  return (
    <View style={StyleSheet.absoluteFill}>
      <BlurView intensity={fx.intensity} tint={dark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: dark ? WASH_DARK : WASH_LIGHT }, webBlur(fx.intensity)]} />
    </View>
  );
}

/** Vrai quand le thème verre est actif. Le flou peut être remplacé par un fond plein. */
export function useGlassLook(): boolean {
  return isGlass();
}

/**
 * Relief : lèvre basse, arête claire, deux ombres (contact + ambiance).
 * Enfoncé : l’ombre se tasse. « Réduire les animations » : pas de translation.
 */
export function raisedShadow(pressed: boolean, motion: boolean): ViewStyle {
  const sunk = pressed;
  const shift = pressed && motion;
  const dark = isDark();
  const near = dark ? 'rgba(0,0,0,0.5)' : 'rgba(15,61,48,0.22)';
  const far = dark ? 'rgba(0,0,0,0.4)' : 'rgba(15,61,48,0.16)';
  return {
    borderTopWidth: 1,
    borderTopColor: dark ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.75)',
    borderBottomWidth: sunk ? 1 : 3,
    borderBottomColor: dark ? 'rgba(0,0,0,0.55)' : 'rgba(15,61,48,0.28)',
    boxShadow: sunk ? `0 1px 1px ${near}, 0 1px 2px ${far}` : `0 1px 2px ${near}, 0 10px 18px ${far}`,
    elevation: sunk ? 2 : 8,
    transform: shift ? [{ translateY: 2 }, { scale: 0.98 }] : undefined,
  };
}
