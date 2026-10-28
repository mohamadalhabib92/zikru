import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';
import type { AbjadOptions, AbjadSystem } from './abjad';
import { uid, usePersistentState } from './storage';
import type { Zikr, ZikrItem } from './zikr';

/** Préférences abjad partagées (écran Abjad, Noms, Du‘as, Coran, compositions). */
export type AbjadView = 'both' | AbjadSystem;
export type AbjadPrefs = {
  view: AbjadView;
  ta: 'ha' | 'ta';
  hamza: 1 | 0;
  words: boolean;
};
export const ABJAD_PREFS0: AbjadPrefs = {
  view: 'both',
  ta: 'ha',
  hamza: 1,
  words: true,
};

type Ctx = {
  zikrs: Zikr[];
  ready: boolean;
  get: (id: string) => Zikr | undefined;
  save: (z: Zikr) => void;
  create: (name?: string, items?: ZikrItem[]) => Zikr;
  remove: (id: string) => void;
  /** Ajoute un élément à une composition existante. */
  addItem: (zid: string, item: Omit<ZikrItem, 'id'>) => void;
  update: (id: string, f: (z: Zikr) => Zikr) => void;
  prefs: AbjadPrefs;
  setPrefs: (patch: Partial<AbjadPrefs>) => void;
  opts: AbjadOptions;
  systems: AbjadSystem[];
  /** Système utilisé pour « abjad → répétitions » quand les deux sont affichés : mashriqi. */
  repSys: AbjadSystem;
};
const C = createContext<Ctx | null>(null);

export function ZikrProvider({ children }: { children: ReactNode }) {
  const [zikrs, setZikrs, r1] = usePersistentState<Zikr[]>('zikrs', []);
  const [prefs, setP, r2] = usePersistentState<AbjadPrefs>('abjad_prefs', ABJAD_PREFS0);
  const ref = useRef(zikrs);
  useEffect(() => {
    ref.current = zikrs;
  }, [zikrs]);
  const now = () => new Date().toISOString();
  const update = (id: string, f: (z: Zikr) => Zikr) => setZikrs((l) => l.map((z) => (z.id === id ? { ...f(z), updatedAt: now() } : z)));
  const v: Ctx = {
    zikrs,
    ready: r1 && r2,
    get: (id) => ref.current.find((z) => z.id === id),
    save: (z) =>
      setZikrs((l) => {
        const x = { ...z, updatedAt: now() };
        return l.some((y) => y.id === z.id) ? l.map((y) => (y.id === z.id ? x : y)) : [x, ...l];
      }),
    create: (name = 'Mon zikr', items = []) => {
      const z: Zikr = {
        id: uid('z'),
        name,
        niyya: '',
        items,
        createdAt: now(),
        updatedAt: now(),
      };
      ref.current = [z, ...ref.current];
      setZikrs((l) => [z, ...l]);
      return z;
    },
    remove: (id) => setZikrs((l) => l.filter((z) => z.id !== id)),
    addItem: (zid, item) =>
      update(zid, (z) => ({
        ...z,
        items: [...z.items, { ...item, id: uid('i') }],
      })),
    update,
    prefs,
    setPrefs: (patch) => setP((x) => ({ ...x, ...patch })),
    opts: { taMarbuta: prefs.ta, hamza: prefs.hamza },
    systems: prefs.view === 'both' ? ['mashriqi', 'maghribi'] : [prefs.view],
    repSys: prefs.view === 'maghribi' ? 'maghribi' : 'mashriqi',
  };
  return <C.Provider value={v}>{children}</C.Provider>;
}

export function useZikrs() {
  const v = useContext(C);
  if (!v) throw new Error('ZikrProvider manquant');
  return v;
}
