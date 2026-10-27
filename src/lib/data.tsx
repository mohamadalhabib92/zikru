import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';
import { bleCounter } from './ble/manager';
import { SEED_CONTENT, type ContentItem } from './content';
import { feedback } from './feedback';
import { uid, usePersistentState } from './storage';
import { applyClicks, closeSession, type ClickSource, type Tasbih } from './tasbih-core';

/**
 * Données locales partagées (persistées à chaque modification → aucune perte au kill de l'app).
 * Note : la spec demande MMKV ; ici AsyncStorage/localStorage en écriture immédiate
 * (MMKV exige un build natif et n'est pas disponible pour la PWA). Voir docs/AUDIT.md.
 */
export type { Tasbih, TasbihSession } from './tasbih-core';
const TASBIH0: Tasbih = { count: 0, target: 33, dhikrId: 'subhanallah', total: 0, sessions: [] };

type Ctx = {
  content: ContentItem[];
  setContent: (f: (c: ContentItem[]) => ContentItem[]) => void;
  tasbih: Tasbih;
  setTasbih: (f: (t: Tasbih) => Tasbih) => void;
  /** Ajoute n appuis (bouton à l'écran, compteur Bluetooth ou clavier) avec retour haptique/sonore. */
  addClicks: (n: number, source: ClickSource) => void;
  increment: () => void;
  saveSession: () => void;
  ready: boolean;
};
const C = createContext<Ctx | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [content, setContent, r1] = usePersistentState<ContentItem[]>('content', SEED_CONTENT);
  const [tasbih, setTasbih, r2] = usePersistentState<Tasbih>('tasbih', TASBIH0);
  const ref = useRef(tasbih);
  useEffect(() => {
    ref.current = tasbih;
  }, [tasbih]);

  const addClicks = (n: number, source: ClickSource) => {
    const { next, cycleCompleted } = applyClicks(ref.current, n, source);
    ref.current = next;
    setTasbih((t) => applyClicks(t, n, source).next);
    const p = bleCounter.state.prefs;
    feedback(cycleCompleted ? 'cycle' : 'tap', { sound: p.sound, haptics: p.haptics });
    if (cycleCompleted && source !== 'manuel') void bleCounter.vibrate();
  };
  const addRef = useRef(addClicks);
  useEffect(() => {
    addRef.current = addClicks;
  });

  // Pont compteur Bluetooth / clavier → compteur de session (actif sur tous les écrans).
  useEffect(() => {
    void bleCounter.init();
    return bleCounter.onClicks((n, src) => addRef.current(n, src === 'clavier' ? 'clavier' : src === 'simulation' ? 'manuel' : 'bluetooth'));
  }, []);

  const increment = () => addClicks(1, 'manuel');
  const saveSession = () => setTasbih((t) => closeSession(t, uid('s'), new Date().toISOString()));
  return <C.Provider value={{ content, setContent, tasbih, setTasbih, addClicks, increment, saveSession, ready: r1 && r2 }}>{children}</C.Provider>;
}
export function useData() {
  const v = useContext(C);
  if (!v) throw new Error('DataProvider manquant');
  return v;
}
