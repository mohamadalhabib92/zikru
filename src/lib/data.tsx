import { createContext, useContext, useEffect, useSyncExternalStore, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';
import { emitClicks } from './community/clicks';
import { bleCounter, type BleCursor } from './ble/manager';
import { SEED_CONTENT, type ContentItem } from './content';
import { feedback } from './feedback';
import { durable, flushStorage, onStorageCleared, storageKey, uid, usePersistentState } from './storage';
import { closeSession, type ClickSource, type Tasbih } from './tasbih-core';
import { createTasbihStore } from './tasbih-store';

/**
 * Données locales partagées.
 * Le compteur de dhikr passe par un magasin durable (tasbih-store.ts) : chaque appui est en mémoire
 * immédiatement, écrit sans attendre (écritures sérialisées, atomiques, réessayées et signalées),
 * forcé sur disque au passage en arrière-plan, et rejoué s'il a eu lieu pendant le chargement.
 * MMKV / SQLite ne fonctionnent pas dans la PWA (GitHub Pages) : AsyncStorage/localStorage partout.
 */
export type { Tasbih, TasbihSession } from './tasbih-core';

/** Magasin unique du compteur (hors React : le Bluetooth et l'arrière-plan y accèdent aussi). */
export const tasbihStore = createTasbihStore({ durable, key: storageKey('tasbih'), makeDev: () => uid('d-') });
onStorageCleared(() => tasbihStore.reset());

/** Force l'écriture du compteur et des autres données (arrière-plan, fermeture de l'onglet). */
function flushAll() {
  void tasbihStore.flush();
  void flushStorage();
}

type Ctx = {
  content: ContentItem[];
  setContent: (f: (c: ContentItem[]) => ContentItem[]) => void;
  tasbih: Tasbih;
  setTasbih: (f: (t: Tasbih) => Tasbih) => void;
  /** Ajoute n appuis (bouton à l'écran, compteur Bluetooth ou clavier) avec retour haptique/sonore. */
  addClicks: (n: number, source: ClickSource, cursor?: BleCursor) => void;
  increment: () => void;
  saveSession: () => void;
  ready: boolean;
};
const C = createContext<Ctx | null>(null);

const addClicks = (n: number, source: ClickSource, cursor?: BleCursor) => {
  const r = tasbihStore.addClicks(n, source, cursor);
  if (!r.added) return; // rafale Bluetooth déjà comptée
  const p = bleCounter.state.prefs;
  feedback(r.cycleCompleted ? 'cycle' : 'tap', { sound: p.sound, haptics: p.haptics });
  if (r.cycleCompleted && source !== 'manuel') void bleCounter.vibrate();
  emitClicks(r.added, source);
};
const setTasbih = (f: (t: Tasbih) => Tasbih) => tasbihStore.set(f);
const increment = () => addClicks(1, 'manuel');
const saveSession = () => tasbihStore.set((t) => closeSession(t, uid('s'), new Date().toISOString()));

export function DataProvider({ children }: { children: ReactNode }) {
  const [content, setContent, r1] = usePersistentState<ContentItem[]>('content', SEED_CONTENT);
  const tasbih = useSyncExternalStore(tasbihStore.subscribe, tasbihStore.get, tasbihStore.get);
  const r2 = useSyncExternalStore(tasbihStore.subscribe, tasbihStore.ready, tasbihStore.ready);

  useEffect(() => {
    void tasbihStore.load();
    // Curseurs Bluetooth enregistrés avec le compte (aucun double comptage après un arrêt brutal).
    bleCounter.setCursorStore({ get: tasbihStore.cursor, set: (c) => tasbihStore.setCursor(c), drop: (id) => tasbihStore.dropCursor(id) });
    // Pont compteur Bluetooth / clavier → compteur de session (actif sur tous les écrans).
    const off = bleCounter.onClicks((n, src, cursor) => addClicks(n, src === 'clavier' ? 'clavier' : src === 'simulation' ? 'manuel' : 'bluetooth', src === 'bluetooth' ? cursor : undefined));
    // Écriture forcée au passage en arrière-plan (iOS/Android) et à la fermeture/masquage de l'onglet (web).
    const sub = AppState.addEventListener('change', (st) => {
      if (st !== 'active') flushAll();
    });
    const hide = () => {
      if (typeof document === 'undefined' || document.visibilityState === 'hidden') flushAll();
    };
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.addEventListener('pagehide', hide);
      document.addEventListener('visibilitychange', hide);
    }
    return () => {
      off();
      sub.remove();
      bleCounter.setCursorStore(null);
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.removeEventListener('pagehide', hide);
        document.removeEventListener('visibilitychange', hide);
      }
    };
  }, []);
  // Reconnexion automatique seulement une fois le compteur chargé (aucun appui rattrapé ne peut être perdu).
  useEffect(() => {
    if (r2) void bleCounter.init();
  }, [r2]);

  return <C.Provider value={{ content, setContent, tasbih, setTasbih, addClicks, increment, saveSession, ready: r1 && r2 }}>{children}</C.Provider>;
}

export function useData() {
  const v = useContext(C);
  if (!v) throw new Error('DataProvider manquant');
  return v;
}
