import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { readerPrefs } from './quran-store';
import { nextSurahQueue, type Step } from './recitation';
import { useShared } from './shared-state';
import { armSleep, sleepDue, SLEEP_OFF, type Sleep } from './sleep-timer';
import { useRecitation } from './use-recitation';

/**
 * Lecteur de récitation global (un seul pour toute l’app) : la lecture continue quand on quitte la sourate
 * (mini-lecteur persistant), enchaîne la sourate suivante si « Lecture continue » est activée, et porte la
 * minuterie de sommeil. Les lecteurs Kahf et Nasheed restent séparés ; la séance Hifz garde son propre lecteur.
 */
export type Next = 'surah' | ((queue: Step[]) => Step[] | null);
type Rec = ReturnType<typeof useRecitation>;
export type GlobalRec = Omit<Rec, 'start'> & {
  start: (queue: Step[], pos?: number, loop?: boolean, o?: { next?: Next }) => Promise<void>;
  sleep: Sleep;
  setSleep: (choice: number | 'surah' | 'off') => void;
};

const Ctx = createContext<GlobalRec | null>(null);

export function RecitationProvider({ children }: { children: ReactNode }) {
  const [p] = useShared(readerPrefs);
  const next = useRef<Next | null>(null);
  const [sleep, setSl] = useState<Sleep>(SLEEP_OFF);
  const sleepRef = useRef(sleep);
  useEffect(() => {
    sleepRef.current = sleep;
  }, [sleep]);
  const onEnd = useCallback((q: Step[]) => {
    // « fin de sourate » : on s’arrête au lieu d’enchaîner
    if (sleepRef.current.kind === 'surah') {
      setSl(SLEEP_OFF);
      return null;
    }
    const n = next.current;
    if (!n) return null;
    if (n === 'surah') return readerPrefs.get().autoNext ? nextSurahQueue(q[q.length - 1]) : null;
    return n(q);
  }, []);
  const rec = useRecitation({ reciter: p.reciter, rate: p.rate, gap: 0, mode: p.readingMode, onEnd });
  const recRef = useRef(rec);
  useEffect(() => {
    recRef.current = rec;
  });

  useEffect(() => {
    if (sleep.kind === 'off') return;
    const id = setInterval(() => {
      const r = recRef.current;
      if (sleepDue(sleepRef.current, Date.now(), r.step)) {
        r.pause();
        setSl(SLEEP_OFF);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [sleep]);

  const start = useCallback<GlobalRec['start']>((queue, pos = 0, loop = false, o) => {
    next.current = o?.next ?? null;
    return recRef.current.start(queue, pos, loop);
  }, []);
  const setSleep = useCallback((choice: number | 'surah' | 'off') => setSl(armSleep(choice, Date.now(), recRef.current.step?.s ?? null)), []);
  const stop = rec.stop;
  const wrappedStop = useCallback(() => {
    next.current = null;
    setSl(SLEEP_OFF);
    stop();
  }, [stop]);

  const value = useMemo<GlobalRec>(() => ({ ...rec, start, stop: wrappedStop, sleep, setSleep }), [rec, start, wrappedStop, sleep, setSleep]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useGlobalRecitation(): GlobalRec {
  const c = useContext(Ctx);
  if (!c) throw new Error('RecitationProvider manquant');
  return c;
}
/** Variante tolérante (mini-lecteur, séance hifz) : null hors fournisseur. */
export const useMaybeGlobalRecitation = () => useContext(Ctx);
/** Espace à réserver en bas des listes quand le mini-lecteur est affiché (pour ne rien masquer). */
export const useMiniPlayerInset = () => {
  const rec = useContext(Ctx);
  return rec && (rec.pos >= 0 || rec.error) ? 72 : 0;
};
