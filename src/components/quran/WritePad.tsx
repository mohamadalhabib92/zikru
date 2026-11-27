import { useCallback, useMemo, useState } from 'react';
import { PanResponder, View } from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';

/** Point dans la feuille, en pixels de la vue. */
export type DrawPoint = { x: number; y: number };
export type DrawStroke = { id: number; pts: DrawPoint[] };

const ERASER_R = 24;
type RawTouch = { locationX: number; locationY: number; touchType?: number | string };

function round1(v: number): string {
  return (Math.round(v * 10) / 10).toString();
}

/** Trait lissé. Un point isolé reste un point visible. */
export function inkPath(pts: readonly DrawPoint[]): string {
  if (!pts.length) return '';
  if (pts.length === 1) return `M ${round1(pts[0].x)} ${round1(pts[0].y)} h 0.8`;
  let d = `M ${round1(pts[0].x)} ${round1(pts[0].y)}`;
  if (pts.length === 2) return `${d} L ${round1(pts[1].x)} ${round1(pts[1].y)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i].x + pts[i + 1].x) / 2;
    const my = (pts[i].y + pts[i + 1].y) / 2;
    d += ` Q ${round1(pts[i].x)} ${round1(pts[i].y)} ${round1(mx)} ${round1(my)}`;
  }
  const last = pts[pts.length - 1];
  return `${d} L ${round1(last.x)} ${round1(last.y)}`;
}

function segmentHits(a: DrawPoint, b: DrawPoint, p: DrawPoint, r2: number): boolean {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = dx * dx + dy * dy;
  const t = len === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len));
  const ex = p.x - (a.x + t * dx);
  const ey = p.y - (a.y + t * dy);
  return ex * ex + ey * ey <= r2;
}

export function strokeHits(pts: readonly DrawPoint[], p: DrawPoint, r = ERASER_R): boolean {
  const r2 = r * r;
  for (let i = 0; i < pts.length; i++) {
    if (i > 0 && segmentHits(pts[i - 1], pts[i], p, r2)) return true;
    const dx = pts[i].x - p.x;
    const dy = pts[i].y - p.y;
    if (dx * dx + dy * dy <= r2) return true;
  }
  return false;
}

function isPencil(t: RawTouch): boolean {
  return t.touchType === 2 || t.touchType === 'stylus' || t.touchType === 'pen';
}

function rawTouches(e: { nativeEvent: { locationX: number; locationY: number; touches?: readonly RawTouch[] } }): readonly RawTouch[] {
  const touches = e.nativeEvent.touches;
  if (touches?.length) return touches;
  return [{ locationX: e.nativeEvent.locationX, locationY: e.nativeEvent.locationY }];
}

/** Crayon s’il est posé (la paume ne trace pas), sinon un seul doigt. Deux doigts laissent défiler. */
function drawPoint(e: { nativeEvent: { locationX: number; locationY: number; touches?: readonly RawTouch[] } }): DrawPoint | null {
  const ts = rawTouches(e);
  const pen = ts.find(isPencil);
  const t = pen ?? (ts.length === 1 ? ts[0] : null);
  if (!t || !Number.isFinite(t.locationX) || !Number.isFinite(t.locationY)) return null;
  return { x: t.locationX, y: t.locationY };
}

function wantsDraw(e: { nativeEvent: { locationX: number; locationY: number; touches?: readonly RawTouch[] } }): boolean {
  const ts = rawTouches(e);
  if (ts.some(isPencil)) return true;
  return ts.length <= 1;
}

type InkState = { strokes: DrawStroke[]; past: DrawStroke[][]; seq: number; eraseBase: DrawStroke[] | null };
const EMPTY_INK: InkState = { strokes: [], past: [], seq: 1, eraseBase: null };

/** Traits, gomme et retour en arrière. L’historique est une pile de feuilles. */
export function useInk() {
  const [hist, setHist] = useState<InkState>(EMPTY_INK);

  const penStart = useCallback((p: DrawPoint) => {
    setHist((h) => ({
      ...h,
      seq: h.seq + 1,
      past: [...h.past.slice(-40), h.strokes],
      strokes: [...h.strokes, { id: h.seq, pts: [p] }],
    }));
  }, []);

  const penMove = useCallback((p: DrawPoint) => {
    setHist((h) => {
      const last = h.strokes[h.strokes.length - 1];
      if (!last) return h;
      const prev = last.pts[last.pts.length - 1];
      if (prev && Math.abs(prev.x - p.x) < 0.5 && Math.abs(prev.y - p.y) < 0.5) return h;
      const strokes = h.strokes.slice();
      strokes[strokes.length - 1] = { ...last, pts: [...last.pts, p] };
      return { ...h, strokes };
    });
  }, []);

  const erase = useCallback((p: DrawPoint) => {
    setHist((h) => {
      const next = h.strokes.filter((s) => !strokeHits(s.pts, p));
      if (next.length === h.strokes.length) return h;
      return { ...h, strokes: next, eraseBase: h.eraseBase ?? h.strokes };
    });
  }, []);

  const eraseEnd = useCallback(() => {
    setHist((h) => (h.eraseBase ? { ...h, eraseBase: null, past: [...h.past.slice(-40), h.eraseBase] } : h));
  }, []);

  const undo = useCallback(() => {
    setHist((h) => {
      if (!h.past.length) return h;
      return { ...h, strokes: h.past[h.past.length - 1], past: h.past.slice(0, -1), eraseBase: null };
    });
  }, []);

  const clearPage = useCallback(() => {
    setHist((h) => (h.strokes.length ? { ...h, strokes: [], past: [...h.past.slice(-40), h.strokes], eraseBase: null } : h));
  }, []);

  const reset = useCallback(() => setHist(EMPTY_INK), []);

  return { strokes: hist.strokes, canUndo: hist.past.length > 0, penStart, penMove, erase, eraseEnd, undo, clearPage, reset };
}

/**
 * Feuille lignée pour l’arabe : lignes horizontales, marge à droite.
 * Le geste (crayon et doigt) passe par le responder, le trait par react-native-svg.
 * Pas de module natif ajouté, pas de reconnaissance.
 */
export function WritePad({
  height,
  strokes,
  eraser,
  enabled,
  ink,
  rule,
  margin,
  paper,
  label,
  onPenStart,
  onPenMove,
  onErase,
  onEraseEnd,
  onActive,
}: {
  height: number;
  strokes: readonly DrawStroke[];
  eraser: boolean;
  enabled: boolean;
  ink: string;
  rule: string;
  margin: string;
  paper: string;
  label: string;
  onPenStart: (p: DrawPoint) => void;
  onPenMove: (p: DrawPoint) => void;
  onErase: (p: DrawPoint) => void;
  onEraseEnd: () => void;
  onActive: (active: boolean) => void;
}) {
  const [width, setWidth] = useState(0);
  const [cursor, setCursor] = useState<DrawPoint | null>(null);
  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponderCapture: (e) => enabled && wantsDraw(e),
        onMoveShouldSetPanResponderCapture: (e) => enabled && wantsDraw(e),
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
        onPanResponderGrant: (e) => {
          if (!enabled) return;
          onActive(true);
          const p = drawPoint(e);
          if (!p) return;
          if (eraser) {
            onErase(p);
            setCursor(p);
          } else onPenStart(p);
        },
        onPanResponderMove: (e) => {
          if (!enabled) return;
          const p = drawPoint(e);
          if (!p) return;
          if (eraser) {
            onErase(p);
            setCursor(p);
          } else onPenMove(p);
        },
        onPanResponderRelease: () => {
          onActive(false);
          setCursor(null);
          if (eraser) onEraseEnd();
        },
        onPanResponderTerminate: () => {
          onActive(false);
          setCursor(null);
          if (eraser) onEraseEnd();
        },
      }),
    [enabled, eraser, onActive, onErase, onEraseEnd, onPenMove, onPenStart],
  );

  const rules: { y: number }[] = [];
  if (width > 0) {
    for (let y = 48; y < height - 8; y += 44) rules.push({ y });
  }
  const marginX = Math.max(28, width - 36);

  return (
    <View
      accessibilityLabel={label}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      {...pan.panHandlers}
      style={{ width: '100%', height, backgroundColor: paper, borderRadius: 18, overflow: 'hidden', direction: 'ltr' }}
    >
      {width > 0 ? (
        <Svg width={width} height={height} pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0 }}>
          {rules.map((r) => (
            <Line key={r.y} x1={16} y1={r.y} x2={width - 16} y2={r.y} stroke={rule} strokeWidth={1} />
          ))}
          <Line x1={marginX} y1={12} x2={marginX} y2={height - 12} stroke={margin} strokeWidth={1.5} />
        </Svg>
      ) : null}
      {width > 0 ? (
        <Svg width={width} height={height} pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0 }}>
          {strokes.map((s) => (
            <Path key={s.id} d={inkPath(s.pts)} stroke={ink} strokeWidth={2.6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          ))}
          {eraser && cursor ? (
            <Path
              d={`M ${round1(cursor.x - ERASER_R)} ${round1(cursor.y)} a ${ERASER_R} ${ERASER_R} 0 1 0 ${ERASER_R * 2} 0 a ${ERASER_R} ${ERASER_R} 0 1 0 -${ERASER_R * 2} 0`}
              stroke={margin}
              strokeWidth={1.5}
              fill="none"
            />
          ) : null}
        </Svg>
      ) : null}
    </View>
  );
}
