import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { onClicks } from './community/clicks';
import type { PrayerKey } from './prayer';
import { uid, usePersistentState } from './storage';

/**
 * Plateforme de progression (100 % locale, hors-ligne) :
 * dhikr par jour (parcours spirituel), prières cochées, jardin d'habitudes, planificateur.
 */
import { dayKey } from './streak';
export { dayKey };

export type Habit = { id: string; title: string; anchor: string; tiny: string; icon: string; done: string[]; createdAt: string };
export type Block = 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha';
export type Task = { id: string; title: string; block: Block; done: boolean };

export const HABIT_PRESETS: Omit<Habit, 'id' | 'done' | 'createdAt'>[] = [
  { title: 'Prier à l’heure', anchor: 'Quand j’entends l’heure de la prière', tiny: 'je pose ce que je fais et je fais mes ablutions', icon: 'time-outline' },
  { title: '100 istighfar', anchor: 'Après la prière de l’aube', tiny: 'je dis « astaghfiru-llāh » au moins 10 fois', icon: 'water-outline' },
  { title: 'Lire le Coran', anchor: 'Après Maghrib', tiny: 'je lis au moins un verset', icon: 'book-outline' },
  { title: 'Salawat sur le Prophète ﷺ', anchor: 'Quand je monte en voiture ou dans le bus', tiny: 'je dis une salat al-Fatih', icon: 'heart-outline' },
  { title: 'Invocations du matin', anchor: 'En buvant mon premier café/thé', tiny: 'je récite une invocation du matin', icon: 'sunny-outline' },
  { title: 'Gratitude du soir', anchor: 'En me couchant', tiny: 'je dis « al-ḥamdu li-llāh » pour 3 bienfaits de la journée', icon: 'moon-outline' },
];

/** Paliers de motivation (ce ne sont pas des grades spirituels). */
export const LEVELS = [
  { min: 0, name: 'Murid', fr: 'Aspirant' },
  { min: 1_000, name: 'Talib', fr: 'Chercheur' },
  { min: 10_000, name: 'Salik', fr: 'Cheminant' },
  { min: 50_000, name: 'Mudawim', fr: 'Persévérant' },
  { min: 100_000, name: 'Muhibb', fr: 'Aimant' },
  { min: 500_000, name: 'Dhakir', fr: 'Invocateur assidu' },
];
export function levelFor(total: number) {
  let i = 0;
  LEVELS.forEach((l, k) => total >= l.min && (i = k));
  const next = LEVELS[i + 1];
  return { index: i + 1, ...LEVELS[i], next, progress: next ? (total - LEVELS[i].min) / (next.min - LEVELS[i].min) : 1 };
}

export { streak, bestStreak, type NeutralFn } from './streak';

type Ctx = {
  days: Record<string, number>;
  prayed: Record<string, PrayerKey[]>;
  togglePrayed: (k: PrayerKey, day?: string) => void;
  habits: Habit[];
  addHabit: (h: Omit<Habit, 'id' | 'done' | 'createdAt'>) => void;
  toggleHabit: (id: string, day?: string) => void;
  removeHabit: (id: string) => void;
  tasks: Record<string, Task[]>;
  addTask: (title: string, block: Block, day?: string) => void;
  toggleTask: (id: string, day?: string) => void;
  removeTask: (id: string, day?: string) => void;
};
const C = createContext<Ctx | null>(null);

export function GrowthProvider({ children }: { children: ReactNode }) {
  const [days, setDays] = usePersistentState<Record<string, number>>('growth-days', {});
  const [prayed, setPrayed] = usePersistentState<Record<string, PrayerKey[]>>('growth-prayed', {});
  const [habits, setHabits] = usePersistentState<Habit[]>('growth-habits', []);
  const [tasks, setTasks] = usePersistentState<Record<string, Task[]>>('growth-tasks', {});

  useEffect(
    () =>
      onClicks((n) => {
        const k = dayKey();
        setDays((d) => ({ ...d, [k]: (d[k] ?? 0) + n }));
      }),
    [setDays],
  );

  const value: Ctx = {
    days,
    prayed,
    togglePrayed: (k, day = dayKey()) =>
      setPrayed((p) => {
        const cur = p[day] ?? [];
        const next = cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k];
        // On ne garde que 60 jours.
        const keep = Object.fromEntries(Object.entries({ ...p, [day]: next }).sort(([a], [b]) => (a < b ? 1 : -1)).slice(0, 60));
        return keep;
      }),
    habits,
    addHabit: (h) => setHabits((hs) => [...hs, { ...h, id: uid('h'), done: [], createdAt: new Date().toISOString() }]),
    toggleHabit: (id, day = dayKey()) => setHabits((hs) => hs.map((h) => (h.id !== id ? h : { ...h, done: h.done.includes(day) ? h.done.filter((x) => x !== day) : [...h.done, day].slice(-800) }))),
    removeHabit: (id) => setHabits((hs) => hs.filter((h) => h.id !== id)),
    tasks,
    addTask: (title, block, day = dayKey()) => setTasks((t) => ({ ...t, [day]: [...(t[day] ?? []), { id: uid('t'), title, block, done: false }] })),
    toggleTask: (id, day = dayKey()) => setTasks((t) => ({ ...t, [day]: (t[day] ?? []).map((x) => (x.id === id ? { ...x, done: !x.done } : x)) })),
    removeTask: (id, day = dayKey()) => setTasks((t) => ({ ...t, [day]: (t[day] ?? []).filter((x) => x.id !== id) })),
  };
  return <C.Provider value={value}>{children}</C.Provider>;
}

export function useGrowth() {
  const c = useContext(C);
  if (!c) throw new Error('GrowthProvider manquant');
  return c;
}
