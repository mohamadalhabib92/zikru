/**
 * Mode Focus : état partagé (séance en cours, historique, série), persisté sous des clés
 * additives dédiées (aucune donnée existante touchée), suivi du premier / arrière-plan,
 * écran maintenu allumé pendant la séance.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { requireOptionalNativeModule } from 'expo';
import { useSyncExternalStore } from 'react';
import { AppState, Platform } from 'react-native';
import * as C from './focus-core';
import { pinApp, unpinApp } from './focus-lock';

const PREFIX = '@zikru';
/** Clés additives (nouvelles). */
export const FOCUS_ACTIVE_KEY = `${PREFIX}/focus.active`;
export const FOCUS_HISTORY_KEY = `${PREFIX}/focus.history`;
export const FOCUS_SETUP_KEY = `${PREFIX}/focus.lockSetupSeen`;

export type FocusState = {
  ready: boolean;
  active: C.FocusSession | null;
  history: C.FocusRecord[];
  /** Dernière absence à signaler en douceur au retour (ms), sinon 0. */
  lastAwayMs: number;
  /** Séance qui vient de se terminer (moment de réussite), sinon null. */
  finished: C.FocusRecord | null;
  setupSeen: boolean;
};
let state: FocusState = { ready: false, active: null, history: [], lastAwayMs: 0, finished: null, setupSeen: false };
const subs = new Set<() => void>();
function set(p: Partial<FocusState>) {
  state = { ...state, ...p };
  subs.forEach((f) => f());
}
const subscribe = (cb: () => void) => {
  subs.add(cb);
  return () => {
    subs.delete(cb);
  };
};
export const getFocus = () => state;
/** Vrai pendant une séance : sert à taire les confirmations et à masquer la barre d'onglets. */
export const focusActive = () => state.active != null;
export const useFocus = () => useSyncExternalStore(subscribe, () => state, () => state);

const write = (key: string, v: unknown) => {
  try {
    void (v == null ? AsyncStorage.removeItem(key) : AsyncStorage.setItem(key, JSON.stringify(v))).catch(() => {});
  } catch {
    /* stockage indisponible : la séance continue en mémoire */
  }
};
const saveActive = () => write(FOCUS_ACTIVE_KEY, state.active);
const saveHistory = () => write(FOCUS_HISTORY_KEY, state.history);
async function read<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

/* ---------- Écran allumé (module natif ExpoKeepAwake déjà embarqué par expo ; Wake Lock sur le web) ---------- */
type KeepAwakeNative = { activate?: (tag: string) => Promise<void>; deactivate?: (tag: string) => Promise<void> };
const keepAwakeNative = Platform.OS === 'web' ? null : requireOptionalNativeModule<KeepAwakeNative>('ExpoKeepAwake');
let webLock: { release: () => Promise<void> } | null = null;
function keepAwake(on: boolean) {
  try {
    if (keepAwakeNative) {
      void (on ? keepAwakeNative.activate?.('focus') : keepAwakeNative.deactivate?.('focus'))?.catch(() => {});
      return;
    }
    const nav = (globalThis as { navigator?: { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } } }).navigator;
    if (on && nav?.wakeLock && !webLock) {
      void nav.wakeLock
        .request('screen')
        .then((l) => {
          webLock = l;
        })
        .catch(() => {});
    } else if (!on && webLock) {
      void webLock.release().catch(() => {});
      webLock = null;
    }
  } catch {
    /* sans effet sur cette plateforme */
  }
}

/* ---------- Cycle de vie ---------- */
async function hydrate() {
  const [rawActive, history, seen] = await Promise.all([
    read<unknown>(FOCUS_ACTIVE_KEY, null),
    read<C.FocusRecord[]>(FOCUS_HISTORY_KEY, []),
    read<boolean>(FOCUS_SETUP_KEY, false),
  ]);
  const h = Array.isArray(history) ? history : [];
  const r = C.restoreFocus(rawActive, Date.now());
  let hist = h;
  if (r.stale) hist = C.addRecord(h, C.finishFocus(r.stale, r.stale.seenAt, false));
  set({ ready: true, history: hist, setupSeen: !!seen, active: r.session, lastAwayMs: r.awayMs });
  if (r.stale) saveHistory();
  if (r.session) {
    saveActive();
    keepAwake(true);
  } else if (rawActive) write(FOCUS_ACTIVE_KEY, null);
}
void hydrate();

try {
  AppState.addEventListener('change', (st) => {
    const a = state.active;
    if (!a) return;
    const now = Date.now();
    // Seul le vrai arrière-plan compte (« inactive » = centre de contrôle, appel entrant affiché…).
    if (st === 'background') {
      set({ active: C.pauseFocus(a, now) });
      saveActive();
    } else if (st === 'active') {
      const r = C.resumeFocus(a, now);
      set({ active: r.session, lastAwayMs: r.awayMs || state.lastAwayMs });
      saveActive();
      keepAwake(true);
    }
  });
} catch {
  /* plateforme sans AppState */
}

/* ---------- Actions ---------- */
export function startFocusSession(minutes: number, activity?: string) {
  const s = C.startFocus(minutes, Date.now(), activity);
  set({ active: s, finished: null, lastAwayMs: 0 });
  saveActive();
  keepAwake(true);
  void pinApp();
  return s;
}

function end(completed: boolean) {
  const a = state.active;
  if (!a) return null;
  const rec = C.finishFocus(a, Date.now(), completed);
  set({ active: null, history: C.addRecord(state.history, rec), finished: rec.completed ? rec : null, lastAwayMs: 0 });
  saveActive();
  saveHistory();
  keepAwake(false);
  unpinApp();
  return rec;
}

/** À appeler chaque seconde par l'écran ou la pastille : termine la séance quand la durée est atteinte. */
let lastBeat = 0;
export function tickFocus(): C.FocusRecord | null {
  const a = state.active;
  if (!a || C.isPaused(a)) return null;
  const now = Date.now();
  if (C.isComplete(a, now)) return end(true);
  if (now - lastBeat > 15_000) {
    lastBeat = now;
    set({ active: C.heartbeat(a, now) });
    saveActive();
  }
  return null;
}

/** Sortie d'urgence (appui long + confirmation) : la séance est notée « interrompue ». */
export const emergencyExitFocus = () => end(false);
export const dismissFocusAway = () => set({ lastAwayMs: 0 });
export const dismissFocusFinished = () => set({ finished: null });
export function markLockSetupSeen() {
  set({ setupSeen: true });
  write(FOCUS_SETUP_KEY, true);
}
