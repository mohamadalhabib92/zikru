import * as Haptics from 'expo-haptics';
import { useEffect, useState, type ReactNode } from 'react';
import { Animated, Easing, Platform, Pressable, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from '@/ui/Text';
import Svg, { Circle } from 'react-native-svg';
import { Ionicons, type IconName } from './kit';
import { alpha, brand as b, elevation } from './theme';
import { L } from '@/lib/l10n';

/** Composants du système de design 1.0.19 (au-dessus de kit/light). */

const native = Platform.OS !== 'web';
/** Retour haptique léger (silencieux sur le web). */
export function tapHaptic(kind: 'light' | 'medium' | 'success' | 'select' = 'light') {
  if (!native) return;
  try {
    if (kind === 'success') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else if (kind === 'select') void Haptics.selectionAsync();
    else void Haptics.impactAsync(kind === 'medium' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
  } catch {}
}

/** Barre latérale des onglets : iPad paysage, grand iPad portrait, ordinateur (fenêtre ≥ 1024). */
export const SIDEBAR_MIN_WINDOW = 1024;
export const SIDEBAR_WIDTH = 232;
export function hasSidebar(windowWidth: number) {
  return windowWidth >= SIDEBAR_MIN_WINDOW;
}

/**
 * Largeur responsive : téléphone, tablette (≥ 768), bureau (≥ 1200).
 * `inTabs` : écran affiché à côté de la barre latérale, on raisonne sur la largeur réellement disponible
 * (sinon les colonnes deviennent trop étroites sur iPad en paysage / Split View).
 */
export function useLayout(opts?: { inTabs?: boolean }) {
  const { width: win } = useWindowDimensions();
  const width = opts?.inTabs && hasSidebar(win) ? win - SIDEBAR_WIDTH : win;
  return { width, windowWidth: win, sidebar: hasSidebar(win), tablet: width >= 768, wide: width >= 960, desktop: width >= 1200, cols: width >= 1200 ? 3 : width >= 768 ? 2 : 1 };
}

/** Conteneur centré à largeur maximale. */
export function Container({ children, max = 1120, style }: { children: ReactNode; max?: number; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ width: '100%', maxWidth: max, alignSelf: 'center' }, style]}>{children}</View>;
}

/** Titre de section : libellé + action optionnelle « Tout voir ». */
export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 22, marginBottom: 10 }}>
      <Text accessibilityRole="header" style={{ color: b.ink, fontSize: 18, fontWeight: '800', letterSpacing: -0.2 }}>
        {title}
      </Text>
      {action && onAction ? (
        <Pressable accessibilityRole="button" onPress={onAction} hitSlop={10} style={{ minHeight: 44, justifyContent: 'center' }}>
          <Text style={{ color: b.green, fontWeight: '700', fontSize: 14 }}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Pastille d'icône teintée. */
export function IconBadge({ icon, color = b.green, size = 40 }: { icon: IconName; color?: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.32, backgroundColor: alpha(color, 0.14), alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={icon} size={size * 0.52} color={color} />
    </View>
  );
}

/** Tuile d'accès rapide (grille). */
export function Tile({ icon, title, subtitle, onPress, color = b.green, style }: { icon: IconName; title: string; subtitle?: string; onPress: () => void; color?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${L(title)}. ${L(subtitle)}` : L(title)}
      onPress={() => {
        tapHaptic('select');
        onPress();
      }}
      style={({ pressed }) => [
        { backgroundColor: b.paper, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: b.line, minHeight: 104, gap: 10, ...elevation(1) },
        pressed && { opacity: 0.9, transform: [{ scale: 0.97 }] },
        style,
      ]}
    >
      <IconBadge icon={icon} color={color} size={38} />
      <View>
        <Text maxFontSizeMultiplier={1.3} style={{ color: b.ink, fontWeight: '700', fontSize: 15 }} numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text maxFontSizeMultiplier={1.3} style={{ color: b.inkMuted, fontSize: 12, marginTop: 2 }} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

/** Grille responsive (n colonnes, gouttière constante). */
export function Grid({ children, cols, gap = 10 }: { children: ReactNode[]; cols: number; gap?: number }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -gap / 2 }}>
      {children.map((c, i) => (
        <View key={i} style={{ width: `${100 / cols}%`, padding: gap / 2 }}>
          {c}
        </View>
      ))}
    </View>
  );
}

/** Anneau de progression SVG. */
export function ProgressRing({ size = 56, stroke = 6, progress, color = b.green, track, children }: { size?: number; stroke?: number; progress: number; color?: string; track?: string; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, progress || 0));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track ?? alpha(color, 0.16)} strokeWidth={stroke} fill="none" />
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={`${c} ${c}`} strokeDashoffset={c * (1 - p)} />
      </Svg>
      {children}
    </View>
  );
}

/** Barre de progression fine. */
export function ProgressBar({ progress, color = b.green, height = 6 }: { progress: number; color?: string; height?: number }) {
  return (
    <View style={{ height, borderRadius: height, backgroundColor: alpha(color, 0.15), overflow: 'hidden' }}>
      <View style={{ width: `${Math.round(Math.max(0, Math.min(1, progress || 0)) * 100)}%`, height, borderRadius: height, backgroundColor: color }} />
    </View>
  );
}

/** Bloc squelette animé (chargement). */
export function Skeleton({ w = '100%', h = 14, r = 8, style }: { w?: number | `${number}%`; h?: number; r?: number; style?: StyleProp<ViewStyle> }) {
  const [o] = useState(() => new Animated.Value(0.45));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(o, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: native }),
        Animated.timing(o, { toValue: 0.45, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: native }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [o]);
  return <Animated.View accessibilityLabel={L("Chargement")} style={[{ width: w, height: h, borderRadius: r, backgroundColor: b.line, opacity: o }, style]} />;
}

/** Apparition douce (fondu + léger glissement). */
export function FadeIn({ children, delay = 0, style }: { children: ReactNode; delay?: number; style?: StyleProp<ViewStyle> }) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 320, delay, easing: Easing.out(Easing.cubic), useNativeDriver: native }).start();
  }, [v, delay]);
  return <Animated.View style={[{ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }, style]}>{children}</Animated.View>;
}

/** En-tête « héros » émeraude avec motif discret. */
export function HeroHeader({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ backgroundColor: b.hero, borderRadius: 24, padding: 20, overflow: 'hidden' }, style]}>{children}</View>;
}
