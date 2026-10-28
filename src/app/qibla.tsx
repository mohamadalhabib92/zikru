import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import Svg, { Circle, Defs, G, Line, Path, RadialGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { getGpsPlace } from '@/lib/location';
import { distanceToKaabaKm, qiblaBearing } from '@/lib/prayer';
import { useSettings } from '@/lib/settings';
import { HeroHeader, IconBadge, tapHaptic, useLayout } from '@/ui/ds';
import { Button, Card, Muted, Notice, Screen, Spacer } from '@/ui/kit';
import { alpha, brand as b, elevation, theme as t } from '@/ui/theme';

/** Cap de l'appareil : natif via expo-location, web via DeviceOrientationEvent (si disponible). */
type Heading = { deg: number; poor: boolean };
function useHeading(): Heading | null {
  const [h, setH] = useState<Heading | null>(null);
  useEffect(() => {
    let sub: { remove: () => void } | null = null;
    let alive = true;
    if (Platform.OS === 'web') {
      if (typeof window === 'undefined') return;
      const on = (e: DeviceOrientationEvent & { webkitCompassHeading?: number }) => {
        const acc = (e as { webkitCompassAccuracy?: number }).webkitCompassAccuracy;
        if (typeof e.webkitCompassHeading === 'number') setH({ deg: e.webkitCompassHeading, poor: typeof acc === 'number' && (acc < 0 || acc > 25) });
        else if (e.absolute && typeof e.alpha === 'number') setH({ deg: (360 - e.alpha) % 360, poor: false });
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
        // accuracy : iOS = marge d’erreur en degrés ; Android = niveau de calibration 0..3.
        sub = await Location.watchHeadingAsync((v) =>
          setH({ deg: v.trueHeading >= 0 ? v.trueHeading : v.magHeading, poor: Platform.OS === 'ios' ? v.accuracy < 0 || v.accuracy > 25 : v.accuracy < 2 }),
        );
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
  const h = useHeading();
  const heading = h?.deg ?? null;
  const { width } = useLayout();
  const [busy, setBusy] = useState(false);
  const bearing = qiblaBearing(s.place);
  const km = Math.round(distanceToKaabaKm(s.place));
  const rot = heading == null ? 0 : -heading;
  // diff > 0 : tourner à droite (sens horaire), diff < 0 : à gauche
  const diff = heading == null ? 0 : ((bearing - heading + 540) % 360) - 180;
  const aligned = heading != null && Math.abs(diff) < 5;
  const was = useRef(false);
  useEffect(() => {
    if (aligned && !was.current) tapHaptic('success');
    was.current = aligned;
  }, [aligned]);
  const size = Math.min(320, width - 48);
  const ring = aligned ? b.green : b.gold;

  return (
    <Screen>
      <HeroHeader>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: alpha(b.gold, 0.18), alignItems: 'center', justifyContent: 'center' }}>
            <Svg width={26} height={26} viewBox="0 0 26 26">
              <Rect x={4} y={6} width={18} height={16} rx={2} fill="#111" />
              <Rect x={4} y={10} width={18} height={3} fill={b.gold} />
            </Svg>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: b.heroMuted, fontSize: 12, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' }}>{tr.qibla_title}</Text>
            <Text style={{ color: b.heroText, fontSize: 15, fontWeight: '700' }} numberOfLines={1}>
              {s.place.label}
              {s.place.source === 'example' ? ' (exemple)' : ''}
            </Text>
          </View>
          <Text style={{ color: b.heroText, fontFamily: 'Amiri_700Bold', fontSize: 22 }}>القبلة</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginTop: 16, gap: 16 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: b.gold, fontSize: 44, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{Math.round(bearing)}°</Text>
            <Text style={{ color: b.heroMuted, fontSize: 13 }}>{tr.qibla_from_north}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ color: b.heroText, fontSize: 22, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{`${km.toLocaleString('fr-CH')} km`}</Text>
            <Text style={{ color: b.heroMuted, fontSize: 13 }}>{tr.distance_mecca}</Text>
          </View>
        </View>
      </HeroHeader>
      <Spacer h={20} />
      <View style={{ alignItems: 'center' }} accessible accessibilityLabel={`${tr.qibla_title} ${Math.round(bearing)} degrés ${tr.qibla_from_north}`}>
        <View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: b.paper }, elevation(2)]}>
          <Svg width={size} height={size} viewBox="-160 -160 320 320">
            <Defs>
              <RadialGradient id="face" cx="0" cy="0" r="150" gradientUnits="userSpaceOnUse">
                <Stop offset="0" stopColor={b.paper} />
                <Stop offset="1" stopColor={alpha(b.green, 0.08)} />
              </RadialGradient>
            </Defs>
            <G rotation={rot}>
              <Circle r={152} fill="url(#face)" stroke={ring} strokeWidth={aligned ? 5 : 3} />
              <Circle r={140} fill="none" stroke={alpha(ring, 0.35)} strokeWidth={1} />
              {Array.from({ length: 72 }, (_, i) => (
                <Line key={i} x1={0} y1={-140} x2={0} y2={i % 18 === 0 ? -122 : i % 2 === 0 ? -130 : -134} stroke={i % 18 === 0 ? b.ink : b.inkMuted} strokeWidth={i % 18 === 0 ? 2.5 : 1} rotation={i * 5} />
              ))}
              {['N', 'E', 'S', 'O'].map((c, i) => (
                <SvgText key={c} x={0} y={-100} fill={c === 'N' ? t.danger : b.ink} fontSize={18} fontWeight="800" textAnchor="middle" rotation={i * 90}>
                  {c}
                </SvgText>
              ))}
              {[30, 60, 120, 150, 210, 240, 300, 330].map((d) => (
                <SvgText key={d} x={0} y={-108} fill={b.inkMuted} fontSize={10} textAnchor="middle" rotation={d}>
                  {String(d)}
                </SvgText>
              ))}
              <G rotation={bearing}>
                <Path d="M 0 0 L -26 -147.7 A 150 150 0 0 1 26 -147.7 Z" fill={alpha(b.green, aligned ? 0.2 : 0.1)} />
                <Line x1={0} y1={0} x2={0} y2={-90} stroke={b.green} strokeWidth={5} strokeLinecap="round" />
                <Path d="M -13 -80 L 0 -104 L 13 -80 Z" fill={b.green} />
                <Rect x={-11} y={-132} width={22} height={20} rx={2} fill="#111" />
                <Rect x={-11} y={-127} width={22} height={4} fill={b.gold} />
                <Line x1={0} y1={0} x2={0} y2={40} stroke={alpha(b.inkMuted, 0.6)} strokeWidth={3} strokeLinecap="round" />
              </G>
              <Circle r={9} fill={b.paper} stroke={b.green} strokeWidth={3} />
            </G>
            {/* Repère fixe : direction du téléphone */}
            <Path d="M -9 -160 L 0 -146 L 9 -160 Z" fill={aligned ? b.green : b.goldDeep} />
          </Svg>
        </View>
      </View>
      <Spacer h={16} />
      {heading != null ? (
        <View
          accessibilityLiveRegion="polite"
          style={{ alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 999, backgroundColor: aligned ? b.green : b.paper, borderWidth: 1, borderColor: aligned ? b.green : b.line }}
        >
          {!aligned ? <Text style={{ color: b.goldDeep, fontSize: 18, fontWeight: '900' }}>{diff > 0 ? '↻' : '↺'}</Text> : null}
          <Text style={{ color: aligned ? '#fff' : b.ink, fontSize: 17, fontWeight: '800', textAlign: 'center' }}>
            {aligned ? `✓ ${tr.qibla_aligned}` : `${tr.qibla_turn} ${Math.round(Math.abs(diff))}° ${diff > 0 ? tr.qibla_right : tr.qibla_left}`}
          </Text>
        </View>
      ) : null}
      {heading != null ? (
        <Text style={{ color: b.inkMuted, textAlign: 'center', marginTop: 8, fontSize: 12, fontWeight: '700' }}>{`${tr.compass_live} · ${Math.round(heading)}°`}</Text>
      ) : null}
      <Spacer />
      {heading == null ? <Notice tone="info" title={tr.compass_unavailable} icon="compass-outline" /> : null}
      {h?.poor || heading == null ? (
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', padding: 14, borderRadius: 16, backgroundColor: b.goldSoft, marginBottom: 12 }}>
          <Text style={{ fontSize: 26, color: b.goldDeep }}>∞</Text>
          <Text style={{ flex: 1, color: b.ink, lineHeight: 20 }}>{tr.qibla_calib}</Text>
        </View>
      ) : null}
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <IconBadge icon="location" color={b.green} />
          <View style={{ flex: 1 }}>
            <Muted>{tr.last_position}</Muted>
            <Text style={{ color: b.ink, fontSize: 16, fontWeight: '700', marginTop: 2 }}>{s.place.label}</Text>
            <Muted>{`${s.place.lat.toFixed(4)}, ${s.place.lng.toFixed(4)} · ${tr.distance_kaaba} : ${km.toLocaleString('fr-CH')} km`}</Muted>
          </View>
        </View>
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
