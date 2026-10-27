import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, Path, Pattern, Rect } from 'react-native-svg';
import type { ReactNode } from 'react';

/** Fond à motif géométrique (étoiles à 8 branches) façon zellige, très discret. */
export function PatternBg({ color, children, style, opacity = 0.09 }: { color: string; children: ReactNode; style?: StyleProp<ViewStyle>; opacity?: number }) {
  return (
    <View style={[{ backgroundColor: color, overflow: 'hidden' }, style]}>
      <Svg style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} width="100%" height="100%" pointerEvents="none">
        <Defs>
          <Pattern id="z8" width={36} height={36} patternUnits="userSpaceOnUse">
            <Path d="M18 4 L22 14 L32 18 L22 22 L18 32 L14 22 L4 18 L14 14 Z" fill="none" stroke="#FFFFFF" strokeOpacity={opacity * 2.2} strokeWidth={1} />
            <Rect x={13} y={13} width={10} height={10} fill="none" stroke="#FFFFFF" strokeOpacity={opacity * 1.5} strokeWidth={0.8} transform="rotate(45 18 18)" />
          </Pattern>
        </Defs>
        <Rect x={0} y={0} width="100%" height="100%" fill="url(#z8)" />
      </Svg>
      {children}
    </View>
  );
}
