import { useState } from 'react';
import { Platform, View } from 'react-native';
import { isRTL } from '@/lib/i18n';
import { useSettings } from '@/lib/settings';
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { hhmm, type PrayerKey } from '@/lib/prayer';

type P = { key: PrayerKey; time: Date };
/** Illustration du ciel : dégradé selon l'heure, arc du soleil (lever → coucher), points des prières. */
export function SkyArc({ list, now, names }: { list: P[]; now: Date; names: Record<PrayerKey, string> }) {
  const [w, setW] = useState(340);
  const lang = useSettings().s.lang;
  const H = 190;
  const get = (k: PrayerKey) => list.find((x) => x.key === k)!.time.getTime();
  const rise = get('sunrise');
  const set = get('maghrib');
  const t = now.getTime();
  const pad = 34;
  const cx = w / 2;
  const base = H - 44;
  const rx = (w - pad * 2) / 2;
  const ry = H - 80;
  const pos = (ms: number) => {
    const f = Math.min(1, Math.max(0, (ms - rise) / (set - rise)));
    const a = Math.PI * (1 - f);
    return { x: cx + rx * Math.cos(a), y: base - ry * Math.sin(a) };
  };
  const day = t >= rise && t <= set;
  const nearEdge = Math.min(Math.abs(t - rise), Math.abs(t - set)) < 75 * 60000;
  const [top, bottom] = !day ? (nearEdge ? ['#1B1F4F', '#C8735A'] : ['#0A1236', '#2B2F66']) : nearEdge ? ['#3D4F9A', '#F0A46B'] : ['#3B82C4', '#CFE8F7'];
  const sun = pos(t);
  const dots: PrayerKey[] = ['sunrise', 'dhuhr', 'asr', 'maghrib'];
  // Web en arabe : le texte SVG hérite de dir="rtl", où « start » / « end » s'inversent ; on garde des ancrages physiques.
  const rtlWeb = Platform.OS === 'web' && isRTL(lang);
  const A = rtlWeb ? ({ start: 'end', end: 'start' } as const) : ({ start: 'start', end: 'end' } as const);
  return (
    <View onLayout={(e) => setW(Math.max(260, e.nativeEvent.layout.width))} style={{ borderRadius: 18, overflow: 'hidden' }} accessibilityLabel="Course du soleil et horaires de prière">
      <Svg width={w} height={H}>
        <Defs>
          <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={top} />
            <Stop offset="1" stopColor={bottom} />
          </LinearGradient>
          <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#FFE9A8" stopOpacity="0.9" />
            <Stop offset="1" stopColor="#FFE9A8" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={w} height={H} fill="url(#sky)" />
        {!day
          ? [0.12, 0.27, 0.41, 0.58, 0.73, 0.88, 0.2, 0.65].map((f, i) => <Circle key={i} cx={w * f} cy={14 + ((i * 37) % 70)} r={i % 3 === 0 ? 1.6 : 1} fill="#fff" opacity={0.7} />)
          : null}
        {/* horizon */}
        <Rect x={0} y={base} width={w} height={H - base} fill="#000" opacity={0.18} />
        <Path d={`M ${cx - rx} ${base} A ${rx} ${ry} 0 0 1 ${cx + rx} ${base}`} stroke="#FFFFFF" strokeOpacity={0.55} strokeWidth={2} strokeDasharray="5 6" fill="none" />
        {dots.map((k) => {
          const p = pos(get(k));
          const past = get(k) <= t;
          return (
            <Circle key={k} cx={p.x} cy={p.y} r={5} fill={past ? '#F2C94C' : '#FFFFFF'} stroke="#0F3D30" strokeWidth={1} />
          );
        })}
        {dots.map((k, i) => {
          const p = pos(get(k));
          const anchor = i === 0 ? A.start : i === dots.length - 1 ? A.end : 'middle';
          const dy = k === 'dhuhr' ? -12 : k === 'asr' ? -12 : 18;
          return (
            <SvgText key={k + 'l'} x={p.x + (i === 0 ? -4 : i === dots.length - 1 ? 4 : 0)} y={p.y + dy} fill="#FFFFFF" fontSize={11} fontWeight="700" textAnchor={anchor}>
              {`${names[k]} ${hhmm(new Date(get(k)))}`}
            </SvgText>
          );
        })}
        {day ? (
          <>
            <Circle cx={sun.x} cy={sun.y} r={22} fill="url(#glow)" />
            <Circle cx={sun.x} cy={sun.y} r={10} fill="#FFD54A" />
          </>
        ) : (
          <>
            <Circle cx={w - 46} cy={34} r={12} fill="#F4EFD8" />
            <Circle cx={w - 41} cy={30} r={11} fill={top} />
          </>
        )}
        <SvgText x={12} y={H - 14} fill="#FFFFFF" fontSize={12} fontWeight="700" textAnchor={A.start}>{`${names.fajr} ${hhmm(new Date(get('fajr')))}`}</SvgText>
        <SvgText x={w - 12} y={H - 14} fill="#FFFFFF" fontSize={12} fontWeight="700" textAnchor={A.end}>{`${names.isha} ${hhmm(new Date(get('isha')))}`}</SvgText>
      </Svg>
    </View>
  );
}
