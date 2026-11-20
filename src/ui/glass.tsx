import { BlurView } from 'expo-blur';
import type { ReactNode } from 'react';
import { Platform, View, type StyleProp, type ViewStyle } from 'react-native';
import { useVisualEffects } from './effects';
import { currentFinish, isDark, isGlass } from './theme';

/**
 * Fond dépoli. Le voile (alpha ≥ 0,86) porte le texte : le flou ne sert pas de contraste.
 * Web : backdrop-filter, et le voile reste si le navigateur l’ignore.
 * « Réduire la transparence », ou une montre : pas de flou, le parent dessine un fond plein.
 */
export function GlassLayers({ children, style, radius = 18 }: { children: ReactNode; style?: StyleProp<ViewStyle>; radius?: number }) {
  const fx = useVisualEffects();
  const dark = isDark();
  const gold = currentFinish() === 'verre-or';
  const wash = dark ? 'rgba(18,29,25,0.88)' : 'rgba(255,252,247,0.88)';
  const border = gold ? 'rgba(217,182,92,0.7)' : dark ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.85)';
  const webBlur = Platform.OS === 'web' ? ({ backdropFilter: `blur(${fx.intensity / 3}px)`, WebkitBackdropFilter: `blur(${fx.intensity / 3}px)` } as ViewStyle) : null;
  return (
    <View style={[{ borderRadius: radius, overflow: 'hidden', borderWidth: 1, borderColor: border }, style]}>
      <BlurView intensity={fx.intensity} tint={dark ? 'dark' : 'light'} style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }} />
      <View style={[{ backgroundColor: wash }, webBlur]}>{children}</View>
    </View>
  );
}

/** Vrai quand le thème verre est actif et que le flou n’est pas coupé par l’accessibilité. */
export function useGlassLook(): boolean {
  const fx = useVisualEffects();
  return isGlass() && fx.blur;
}

/** Ombre « posée » : plus courte quand le bouton est enfoncé. */
export function raisedShadow(pressed: boolean, motion: boolean): ViewStyle {
  const down = pressed && motion;
  const dark = isDark();
  return {
    borderTopWidth: 1,
    borderTopColor: dark ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.7)',
    borderBottomWidth: down ? 1 : 3,
    borderBottomColor: dark ? 'rgba(0,0,0,0.5)' : 'rgba(15,61,48,0.28)',
    shadowColor: dark ? '#000000' : '#1F3A2E',
    shadowOpacity: down ? 0.1 : dark ? 0.4 : 0.2,
    shadowRadius: down ? 3 : 12,
    shadowOffset: { width: 0, height: down ? 1 : 6 },
    elevation: down ? 1 : 8,
    transform: down ? [{ translateY: 2 }, { scale: 0.98 }] : undefined,
  };
}
