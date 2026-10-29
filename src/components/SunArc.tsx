import { View } from 'react-native';
import { Text } from '@/ui/Text';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { hhmm } from '@/lib/prayer';
import { theme as t } from '@/ui/theme';
import { L } from '@/lib/l10n';

/** Arc solaire : position du soleil entre le lever (shuruq) et le coucher (maghrib). */
export function SunArc({ sunrise, sunset, now }: { sunrise: Date; sunset: Date; now: Date }) {
  const W = 320;
  const H = 140;
  const pad = 20;
  const r = (W - pad * 2) / 2;
  const cx = W / 2;
  const cy = H - 18;
  const span = sunset.getTime() - sunrise.getTime();
  const raw = span > 0 ? (now.getTime() - sunrise.getTime()) / span : 0;
  const day = raw >= 0 && raw <= 1;
  const p = Math.min(1, Math.max(0, raw));
  const a = Math.PI * (1 - p);
  const sx = cx + r * Math.cos(a);
  const sy = cy - r * Math.sin(a) * 0.9;
  const arc = `M ${pad} ${cy} A ${r} ${r * 0.9} 0 0 1 ${W - pad} ${cy}`;
  const done = `M ${pad} ${cy} A ${r} ${r * 0.9} 0 0 1 ${sx} ${sy}`;
  return (
    <View style={{ alignItems: 'center' }} accessible accessibilityLabel={L('Soleil : lever {a}, coucher {b}', { a: hhmm(sunrise), b: hhmm(sunset) })}>
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        <Line x1={0} y1={cy} x2={W} y2={cy} stroke={t.border} strokeWidth={1} />
        <Path d={arc} stroke={t.border} strokeWidth={3} strokeDasharray="6 6" fill="none" />
        {day ? <Path d={done} stroke={t.primary} strokeWidth={3} fill="none" /> : null}
        <Circle cx={day ? sx : raw < 0 ? pad : W - pad} cy={day ? sy : cy} r={11} fill={day ? '#F2C94C' : t.muted} opacity={day ? 1 : 0.6} />
      </Svg>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%', paddingHorizontal: 8 }}>
        <Text style={{ color: t.muted }}>☀︎ {hhmm(sunrise)}</Text>
        <Text style={{ color: t.muted }}>{day ? L('{p} % du jour', { p: Math.round(p * 100) }) : 'Nuit'}</Text>
        <Text style={{ color: t.muted }}>☾ {hhmm(sunset)}</Text>
      </View>
    </View>
  );
}
