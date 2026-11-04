/**
 * Confort d'usage partagé : réglage « Vibrations » (activé par défaut, mémorisé sur l'appareil
 * sous une clé dédiée, sans toucher aux données existantes), lecteur d'écran et
 * « Réduire la transparence » (iOS), lus une fois puis suivis en direct.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import { AccessibilityInfo } from 'react-native';

/** Clé additive (nouvelle) : n'écrase aucune donnée existante. */
export const VIBRATIONS_KEY = '@zikru/pref.vibrations';

type State = { vibrations: boolean; screenReader: boolean; reduceTransparency: boolean };
let state: State = { vibrations: true, screenReader: false, reduceTransparency: false };
const subs = new Set<() => void>();
function set(p: Partial<State>) {
  state = { ...state, ...p };
  subs.forEach((f) => f());
}
const subscribe = (cb: () => void) => {
  subs.add(cb);
  return () => {
    subs.delete(cb);
  };
};

try {
  void AsyncStorage.getItem(VIBRATIONS_KEY)
    .then((v) => {
      if (v === '0') set({ vibrations: false });
    })
    .catch(() => {});
} catch {
  /* stockage indisponible : on garde la valeur par défaut */
}
try {
  void AccessibilityInfo.isScreenReaderEnabled?.()
    .then((v) => set({ screenReader: !!v }))
    .catch(() => {});
  AccessibilityInfo.addEventListener?.('screenReaderChanged', (v: boolean) => set({ screenReader: !!v }));
  void AccessibilityInfo.isReduceTransparencyEnabled?.()
    .then((v) => set({ reduceTransparency: !!v }))
    .catch(() => {});
  AccessibilityInfo.addEventListener?.('reduceTransparencyChanged', (v: boolean) => set({ reduceTransparency: !!v }));
} catch {
  /* plateforme sans ces API : valeurs par défaut */
}

/** Vibrations autorisées par l'utilisateur (Réglages → Vibrations). */
export const vibrationsEnabled = () => state.vibrations;
export function setVibrationsEnabled(on: boolean) {
  set({ vibrations: on });
  void AsyncStorage.setItem(VIBRATIONS_KEY, on ? '1' : '0').catch(() => {});
}
export function useVibrations(): [boolean, (on: boolean) => void] {
  const v = useSyncExternalStore(subscribe, () => state.vibrations, () => true);
  return [v, setVibrationsEnabled];
}

/** VoiceOver / TalkBack actif : on laisse plus de temps aux messages éphémères. */
export const screenReaderOn = () => state.screenReader;
export const useScreenReader = () => useSyncExternalStore(subscribe, () => state.screenReader, () => false);

/** « Réduire la transparence » : les voiles et fonds translucides deviennent opaques. */
export const prefersReducedTransparency = () => state.reduceTransparency;
export const useReducedTransparency = () => useSyncExternalStore(subscribe, () => state.reduceTransparency, () => false);

/** Annonce polie au lecteur d'écran, mise en file après la lecture en cours (iOS). */
export function announce(msg: string) {
  try {
    const withOpts = (AccessibilityInfo as unknown as { announceForAccessibilityWithOptions?: (m: string, o: { queue: boolean }) => void }).announceForAccessibilityWithOptions;
    if (withOpts) withOpts(msg, { queue: true });
    else AccessibilityInfo.announceForAccessibility?.(msg);
  } catch {
    /* ignoré */
  }
}

/**
 * Sens de lecture de l'interface (arabe → droite à gauche). Fixé par la racine à chaque rendu,
 * avant les enfants ; les icônes directionnelles (chevrons, flèches) se retournent en conséquence.
 */
let layoutRTL = false;
export function setLayoutRTL(rtl: boolean) {
  layoutRTL = rtl;
}
export const isLayoutRTL = () => layoutRTL;
const MIRROR: Record<string, string> = {
  'chevron-forward': 'chevron-back',
  'chevron-back': 'chevron-forward',
  'chevron-forward-outline': 'chevron-back-outline',
  'chevron-back-outline': 'chevron-forward-outline',
  'chevron-forward-circle': 'chevron-back-circle',
  'chevron-back-circle': 'chevron-forward-circle',
  'arrow-forward': 'arrow-back',
  'arrow-back': 'arrow-forward',
  'arrow-forward-outline': 'arrow-back-outline',
  'arrow-back-outline': 'arrow-forward-outline',
  'arrow-forward-circle': 'arrow-back-circle',
  'arrow-back-circle': 'arrow-forward-circle',
  'arrow-forward-circle-outline': 'arrow-back-circle-outline',
  'arrow-back-circle-outline': 'arrow-forward-circle-outline',
};
/** Nom d'icône adapté au sens de lecture (inchangé en LTR ou pour les icônes non directionnelles). */
export function directionalIcon<N extends string>(name: N): N {
  return (layoutRTL ? (MIRROR[name] ?? name) : name) as N;
}
