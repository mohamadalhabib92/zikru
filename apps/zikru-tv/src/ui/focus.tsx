import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

export const ink = {
  bg: '#0A1210',
  card: '#12201B',
  line: '#1E332B',
  text: '#F4EFE4',
  muted: '#A9C3B7',
  gold: '#D9B65C',
  green: '#0F3D30',
};

export function Focusable({
  children,
  onPress,
  style,
  preferred,
}: {
  children: ReactNode;
  onPress?: PressableProps['onPress'];
  style?: StyleProp<ViewStyle>;
  preferred?: boolean;
}) {
  const [on, setOn] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      hasTVPreferredFocus={preferred}
      onFocus={() => setOn(true)}
      onBlur={() => setOn(false)}
      style={[styles.hit, style, on && styles.on]}
    >
      {children}
    </Pressable>
  );
}

export function Screen({ children }: { children: ReactNode }) {
  return <ScrollView style={styles.screen} contentContainerStyle={styles.pad}>{children}</ScrollView>;
}

export function Title({ children }: { children: ReactNode }) {
  return <Text style={styles.title}>{children}</Text>;
}

export function Muted({ children }: { children: ReactNode }) {
  return <Text style={styles.muted}>{children}</Text>;
}

export function Arabic({ children, size = 40 }: { children: ReactNode; size?: number }) {
  return (
    <Text style={[styles.ar, { fontSize: size, lineHeight: Math.round(size * 1.8) }]} accessibilityLanguage="ar">
      {children}
    </Text>
  );
}

export function ChipRow({ children }: { children: ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: ink.bg },
  pad: { padding: 36, paddingBottom: 80 },
  hit: { borderRadius: 16, borderWidth: 3, borderColor: 'transparent' },
  on: { borderColor: ink.gold, transform: [{ scale: 1.02 }] },
  title: { color: ink.text, fontSize: 40, fontWeight: '700', marginBottom: 8 },
  muted: { color: ink.muted, fontSize: 20, lineHeight: 28 },
  ar: { color: ink.text, textAlign: 'right', writingDirection: 'rtl', fontFamily: 'Amiri_400Regular' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginVertical: 12 },
});
