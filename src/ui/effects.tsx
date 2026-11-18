import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

export type VisualTier = 'full' | 'lite' | 'solid';

export type VisualEffects = {
  /** Faux si « Réduire la transparence » est actif, ou sur une montre. */
  blur: boolean;
  /** Faux si « Réduire les animations » est actif. */
  motion: boolean;
  tier: VisualTier;
  /** Intensité expo-blur (0 = pas de flou). Plus basse sur tvOS. */
  intensity: number;
  tv: boolean;
};

const FULL: VisualEffects = { blur: true, motion: true, tier: 'full', intensity: 48, tv: false };

function deviceKind(): { watch: boolean; tv: boolean } {
  const os = String(Platform.OS);
  return { watch: os === 'watchos' || os === 'wearos', tv: Platform.isTV === true };
}

/** Règle pure : plein si la transparence est réduite ou si l’écran est une montre ; léger sur tvOS. */
export function resolveEffects(reduceTransparency: boolean, reduceMotion: boolean): VisualEffects {
  const { watch, tv } = deviceKind();
  if (reduceTransparency || watch) return { blur: false, motion: !reduceMotion, tier: 'solid', intensity: 0, tv };
  if (tv) return { blur: true, motion: !reduceMotion, tier: 'lite', intensity: 18, tv: true };
  return { blur: true, motion: !reduceMotion, tier: 'full', intensity: 48, tv: false };
}

const Ctx = createContext<VisualEffects>(FULL);

export function useVisualEffects(): VisualEffects {
  return useContext(Ctx);
}

function webPref(query: string): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(query).matches;
}

export function VisualEffectsProvider({ children }: { children: ReactNode }) {
  const [fx, setFx] = useState<VisualEffects>(() => resolveEffects(webPref('(prefers-reduced-transparency: reduce)'), webPref('(prefers-reduced-motion: reduce)')));
  useEffect(() => {
    let alive = true;
    const apply = (transparency: boolean, motion: boolean) => {
      if (alive) setFx(resolveEffects(transparency, motion));
    };
    let transparency = webPref('(prefers-reduced-transparency: reduce)');
    let motion = webPref('(prefers-reduced-motion: reduce)');
    apply(transparency, motion);
    const ai = AccessibilityInfo as typeof AccessibilityInfo & { isReduceTransparencyEnabled?: () => Promise<boolean> };
    void ai.isReduceMotionEnabled?.().then((v) => {
      motion = v;
      apply(transparency, motion);
    }).catch(() => {});
    void ai.isReduceTransparencyEnabled?.().then((v) => {
      transparency = v || transparency;
      apply(transparency, motion);
    }).catch(() => {});
    const subs: { remove(): void }[] = [];
    try {
      subs.push(AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => {
        motion = v;
        apply(transparency, motion);
      }));
    } catch {}
    try {
      subs.push(AccessibilityInfo.addEventListener('reduceTransparencyChanged', (v) => {
        transparency = v;
        apply(transparency, motion);
      }));
    } catch {}
    let mqT: MediaQueryList | null = null;
    let mqM: MediaQueryList | null = null;
    const onT = () => {
      transparency = webPref('(prefers-reduced-transparency: reduce)');
      apply(transparency, motion);
    };
    const onM = () => {
      motion = webPref('(prefers-reduced-motion: reduce)');
      apply(transparency, motion);
    };
    if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      mqT = window.matchMedia('(prefers-reduced-transparency: reduce)');
      mqM = window.matchMedia('(prefers-reduced-motion: reduce)');
      mqT.addEventListener?.('change', onT);
      mqM.addEventListener?.('change', onM);
    }
    return () => {
      alive = false;
      subs.forEach((s) => s.remove());
      mqT?.removeEventListener?.('change', onT);
      mqM?.removeEventListener?.('change', onM);
    };
  }, []);
  return <Ctx.Provider value={fx}>{children}</Ctx.Provider>;
}
