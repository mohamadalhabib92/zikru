import type { ReactNode } from 'react';
import { Pressable, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { Text } from '@/ui/Text';
import { brand as b, elevation, fonts, onColor } from './theme';
import { L } from "@/lib/l10n";

/** Composants « cartes claires » de la palette Zikru originale. */
export function LCard({ children, style, onPress, label }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; label?: string }) {
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
    <Text accessibilityRole="header" style={[{ color: b.ink, fontSize: 18, fontWeight: '800' }, style]}>
      {children}
    </Text>
  );
}
export function LText({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[{ color: b.ink, fontSize: 15, lineHeight: 22 }, style]}>{children}</Text>;
}
export function LMuted({ children, style, numberOfLines }: { children: ReactNode; style?: StyleProp<TextStyle>; numberOfLines?: number }) {
  return (
    <Text numberOfLines={numberOfLines} style={[{ color: b.inkMuted, fontSize: 13, lineHeight: 19 }, style]}>
      {children}
    </Text>
  );
}
/** Texte arabe : police Amiri (ou Amiri Quran pour les versets), RTL, interligne généreux. */
export function Arabic({ children, size = 24, style, quran, numberOfLines }: { children: ReactNode; size?: number; style?: StyleProp<TextStyle>; quran?: boolean; numberOfLines?: number }) {
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[{ color: b.ink, fontSize: size, lineHeight: Math.round(size * (quran ? 2.1 : 1.85)), textAlign: 'right', writingDirection: 'rtl', fontFamily: quran ? fonts.quran : fonts.arabic }, style]}
    >
      {children}
    </Text>
  );
}
export function SectionLabel({ children, color = b.teal }: { children: ReactNode; color?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 18, marginBottom: 10 }}>
      <View style={{ width: 3, height: 14, borderRadius: 2, backgroundColor: color }} />
      <Text style={{ color: b.inkMuted, fontSize: 11, fontWeight: '800', letterSpacing: 1.4 }}>{children}</Text>
    </View>
  );
}
export function Pill({ label, active, onPress, color = b.green }: { label: string; active?: boolean; onPress?: () => void; color?: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      onPress={onPress}
      style={{ paddingHorizontal: 14, paddingVertical: 6, minHeight: 40, maxWidth: '100%', justifyContent: 'center', borderRadius: 19, backgroundColor: active ? color : b.paper, borderWidth: 1, borderColor: active ? color : b.line }}
    >
      <Text maxFontSizeMultiplier={1.35} style={{ color: active ? onColor(color) : b.ink, fontWeight: '700', fontSize: 14, flexShrink: 1 }}>{label}</Text>
    </Pressable>
  );
}
