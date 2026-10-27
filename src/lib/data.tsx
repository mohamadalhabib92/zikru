import { createContext, useContext, type ReactNode } from 'react';
import { SEED_CONTENT, type ContentItem } from './content';
import { uid, usePersistentState } from './storage';

/**
 * Données locales partagées (persistées à chaque modification → aucune perte au kill de l'app).
 * Note : la spec demande MMKV ; ici AsyncStorage/localStorage en écriture immédiate
 * (MMKV exige un build natif et n'est pas disponible pour la PWA). Voir docs/AUDIT.md.
 */
export type TasbihSession = { id: string; dhikrId: string; count: number; target: number; at: string };
export type Tasbih = { count: number; target: number; dhikrId: string; total: number; sessions: TasbihSession[] };
const TASBIH0: Tasbih = { count: 0, target: 33, dhikrId: 'subhanallah', total: 0, sessions: [] };

type Ctx = {
  content: ContentItem[];
  setContent: (f: (c: ContentItem[]) => ContentItem[]) => void;
  tasbih: Tasbih;
  setTasbih: (f: (t: Tasbih) => Tasbih) => void;
  increment: () => void;
  saveSession: () => void;
  ready: boolean;
};
const C = createContext<Ctx | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [content, setContent, r1] = usePersistentState<ContentItem[]>('content', SEED_CONTENT);
  const [tasbih, setTasbih, r2] = usePersistentState<Tasbih>('tasbih', TASBIH0);
  const increment = () => setTasbih((t) => ({ ...t, count: t.count + 1, total: t.total + 1 }));
  const saveSession = () =>
    setTasbih((t) =>
      t.count === 0 ? t : { ...t, count: 0, sessions: [{ id: uid('s'), dhikrId: t.dhikrId, count: t.count, target: t.target, at: new Date().toISOString() }, ...t.sessions].slice(0, 200) },
    );
  return <C.Provider value={{ content, setContent, tasbih, setTasbih, increment, saveSession, ready: r1 && r2 }}>{children}</C.Provider>;
}
export function useData() {
  const v = useContext(C);
  if (!v) throw new Error('DataProvider manquant');
  return v;
}
