import { useSyncExternalStore, type ReactNode } from 'react';
import { View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { TVPressable as Pressable } from '@/ui/tv-pressable';
import { Text } from '@/ui/Text';
import { useVisualEffects } from './effects';
import { GlassLayers, raisedShadow, useGlassLook } from './glass';
import { brand as b, elevation, fonts, isGlass, onColor, type as typo } from './theme';
import { arLang } from './ar-lang';
import { fontsAreReady, subscribeFonts } from './fonts-ready';
import { L } from "@/lib/l10n";

/** Composants « cartes claires » de la palette Zikru originale. */
export function LCard({ children, style, onPress, label }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; label?: string }) {
  const glass = useGlassLook();
  const pad: ViewStyle = { padding: 16 };
  if (glass) {
    const inner = <View style={[pad, style]}>{children}</View>;
    if (onPress)
      return (
        <Pressable accessibilityRole="button" accessibilityLabel={typeof label === "string" ? L(label) : label} onPress={onPress} style={({ pressed }) => [{ marginBottom: 12, borderRadius: 18 }, pressed && { opacity: 0.92, transform: [{ scale: 0.985 }] }]}>
          <GlassLayers radius={18}>{inner}</GlassLayers>
        </Pressable>
      );
    return (
      <GlassLayers radius={18} style={{ marginBottom: 12 }}>
        {inner}
      </GlassLayers>
    );
  }
  const base: ViewStyle = { backgroundColor: b.paper, borderRadius: 18, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: b.line, ...elevation(1) };
  if (onPress)
    return (
      <Pressable accessibilityRole="button" accessibilityLabel={typeof label === "string" ? L(label) : label} onPress={onPress} style={({ pressed }) => [base, pressed && { opacity: 0.9, transform: [{ scale: 0.985 }] }, style]}>
        {children}
      </Pressable>
    );
  return <View style={[base, style]}>{children}</View>;
}
export function LTitle({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return (
    <Text accessibilityRole="header" style={[{ color: b.ink, fontSize: typo.headline.fontSize, fontWeight: typo.headline.fontWeight, letterSpacing: typo.headline.letterSpacing }, style]}>
      {children}
    </Text>
  );
}
export function LText({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[{ color: b.ink, ...typo.sub, lineHeight: 22 }, style]}>{children}</Text>;
}
export function LMuted({ children, style, numberOfLines }: { children: ReactNode; style?: StyleProp<TextStyle>; numberOfLines?: number }) {
  return (
    <Text numberOfLines={numberOfLines} style={[{ color: b.inkMuted, ...typo.caption, lineHeight: 19 }, style]}>
      {children}
    </Text>
  );
}
/** Texte arabe : police Amiri (ou Amiri Quran pour les versets), RTL, interligne généreux. */
export function Arabic({ children, size = 24, style, quran, numberOfLines }: { children: ReactNode; size?: number; style?: StyleProp<TextStyle>; quran?: boolean; numberOfLines?: number }) {
  const ready = useSyncExternalStore(subscribeFonts, fontsAreReady, () => false);
  return (
    <Text
      {...arLang}
      numberOfLines={numberOfLines}
      style={[{ color: b.ink, fontSize: size, lineHeight: Math.round(size * (quran ? 2.2 : 2)), textAlign: 'right', writingDirection: 'rtl', fontFamily: ready ? (quran ? fonts.quran : fonts.arabic) : undefined }, style]}
    >
      {children}
    </Text>
  );
}
export function SectionLabel({ children, color = b.teal }: { children: ReactNode; color?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 18, marginBottom: 10 }}>
      <View style={{ width: 3, height: 14, borderRadius: 2, backgroundColor: color }} />
      <Text style={{ color: b.inkMuted, fontSize: typo.overline.fontSize, fontWeight: typo.overline.fontWeight, letterSpacing: typo.overline.letterSpacing }}>{children}</Text>
    </View>
  );
}
export function Pill({ label, active, onPress, color = b.green }: { label: string; active?: boolean; onPress?: () => void; color?: string }) {
  const raised = isGlass();
  const fx = useVisualEffects();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={L(label)}
      accessibilityState={{ selected: !!active }}
      onPress={onPress}
      style={({ pressed }) => [
        { paddingHorizontal: 14, paddingVertical: 8, minHeight: 44, maxWidth: '100%', justifyContent: 'center', borderRadius: 22, backgroundColor: active ? color : b.paper, borderWidth: 1, borderColor: active ? color : b.line },
        raised && !fx.tv && raisedShadow(!!pressed, fx.motion),
      ]}
    >
      <Text maxFontSizeMultiplier={1.35} style={{ color: active ? onColor(color) : b.ink, fontWeight: '700', fontSize: 14, flexShrink: 1 }}>{label}</Text>
    </Pressable>
  );
}
