import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Text as SvgText } from 'react-native-svg';
import { getGpsPlace } from '@/lib/location';
import { distanceToKaabaKm, qiblaBearing } from '@/lib/prayer';
import { useSettings } from '@/lib/settings';
import { Badge, Button, Card, Eyebrow, H1, Muted, Notice, Row, Screen, Spacer } from '@/ui/kit';
import { theme as t } from '@/ui/theme';

/** Cap de l'appareil : natif via expo-location, web via DeviceOrientationEvent (si disponible). */
function useHeading(): number | null {
  const [h, setH] = useState<number | null>(null);
  useEffect(() => {
    let sub: { remove: () => void } | null = null;
    let alive = true;
    if (Platform.OS === 'web') {
      if (typeof window === 'undefined') return;
      const on = (e: DeviceOrientationEvent & { webkitCompassHeading?: number }) => {
        if (typeof e.webkitCompassHeading === 'number') setH(e.webkitCompassHeading);
        else if (e.absolute && typeof e.alpha === 'number') setH((360 - e.alpha) % 360);
      };
      window.addEventListener('deviceorientationabsolute' as 'deviceorientation', on as EventListener);
      window.addEventListener('deviceorientation', on as EventListener);
      return () => {
        window.removeEventListener('deviceorientationabsolute' as 'deviceorientation', on as EventListener);
        window.removeEventListener('deviceorientation', on as EventListener);
      };
    }
    (async () => {
      try {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (perm.status !== 'granted' || !alive) return;
        sub = await Location.watchHeadingAsync((v) => setH(v.trueHeading >= 0 ? v.trueHeading : v.magHeading));
      } catch {
        setH(null);
      }
    })();
    return () => {
      alive = false;
      sub?.remove();
    };
  }, []);
  return h;
}

export default function Qibla() {
  const { s, set, t: tr } = useSettings();
  const heading = useHeading();
  const [busy, setBusy] = useState(false);
  const bearing = qiblaBearing(s.place);
  const rot = heading == null ? 0 : -heading;
  const aligned = heading != null && Math.abs(((bearing - heading + 540) % 360) - 180) < 5;

  return (
    <Screen>
      <Eyebrow>{tr.qibla_title}</Eyebrow>
      <H1>
        {Math.round(bearing)}° <Text style={{ fontSize: 16, color: t.muted, fontWeight: '400' }}>{tr.qibla_from_north}</Text>
      </H1>
      <Spacer />
      <View style={{ alignItems: 'center' }} accessible accessibilityLabel={`${tr.qibla_title} ${Math.round(bearing)} degrés ${tr.qibla_from_north}`}>
        <Svg width={300} height={300} viewBox="-150 -150 300 300">
          <G rotation={rot}>
            <Circle r={140} fill={t.surface} stroke={aligned ? t.success : t.border} strokeWidth={aligned ? 4 : 2} />
            {Array.from({ length: 72 }, (_, i) => (
              <Line key={i} x1={0} y1={-140} x2={0} y2={i % 18 === 0 ? -122 : i % 2 === 0 ? -130 : -134} stroke={t.muted} strokeWidth={i % 18 === 0 ? 2 : 1} rotation={i * 5} />
            ))}
            {['N', 'E', 'S', 'O'].map((c, i) => (
              <SvgText key={c} x={0} y={-104} fill={c === 'N' ? t.danger : t.text} fontSize={18} fontWeight="700" textAnchor="middle" rotation={i * 90}>
                {c}
              </SvgText>
            ))}
            <G rotation={bearing}>
              <Line x1={0} y1={0} x2={0} y2={-96} stroke={t.primary} strokeWidth={4} strokeLinecap="round" />
              <Path d="M -12 -86 L 0 -112 L 12 -86 Z" fill={t.primary} />
              <Path d="M -9 -128 h 18 v 14 h -18 Z" fill={t.text} />
            </G>
            <Circle r={6} fill={t.primary} />
          </G>
        </Svg>
      </View>
      <Spacer />
      <Row style={{ justifyContent: 'center' }}>{heading != null ? <Badge label={aligned ? '✓ Qibla' : tr.compass_live} tone={aligned ? 'success' : 'info'} /> : null}</Row>
      {heading == null ? <Notice tone="info" title={tr.compass_unavailable} icon="compass-outline" /> : null}
      <Spacer />
      <Card>
        <Muted>{tr.last_position}</Muted>
        <Text style={{ color: t.text, fontSize: 17, fontWeight: '700', marginTop: 2 }}>
          {s.place.label}
          {s.place.source === 'example' ? ' (exemple)' : ''}
        </Text>
        <Muted>
          {s.place.lat.toFixed(4)}, {s.place.lng.toFixed(4)} · {tr.distance_kaaba} : {Math.round(distanceToKaabaKm(s.place)).toLocaleString('fr-CH')} km
        </Muted>
        <Spacer />
        <Button
          title={tr.use_gps}
          icon="locate-outline"
          variant="secondary"
          loading={busy}
          onPress={async () => {
            setBusy(true);
            const p = await getGpsPlace();
            setBusy(false);
            if (p) set({ place: p });
          }}
        />
      </Card>
    </Screen>
  );
}
