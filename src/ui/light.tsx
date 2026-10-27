import type { ReactNode } from 'react';
import { Pressable, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { brand as b } from './theme';

/** Composants « cartes claires » de la palette Zikru originale. */
export function LCard({ children, style, onPress, label }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; label?: string }) {
  const base: ViewStyle = { backgroundColor: b.paper, borderRadius: 18, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: b.line, shadowColor: '#5A3A1E', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2 };
  if (onPress)
    return (
      <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [base, pressed && { opacity: 0.85 }, style]}>
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
export function LMuted({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[{ color: b.inkMuted, fontSize: 13, lineHeight: 19 }, style]}>{children}</Text>;
}
export function Arabic({ children, size = 24, style }: { children: ReactNode; size?: number; style?: StyleProp<TextStyle> }) {
  return <Text style={[{ color: b.ink, fontSize: size, lineHeight: size * 1.8, textAlign: 'right', writingDirection: 'rtl' }, style]}>{children}</Text>;
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
      style={{ paddingHorizontal: 14, minHeight: 38, justifyContent: 'center', borderRadius: 19, backgroundColor: active ? color : b.paper, borderWidth: 1, borderColor: active ? color : b.line }}
    >
      <Text style={{ color: active ? '#fff' : b.ink, fontWeight: '700', fontSize: 14 }}>{label}</Text>
    </Pressable>
  );
}
