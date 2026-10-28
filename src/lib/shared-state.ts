import { useSyncExternalStore } from 'react';
import { loadJSON, saveJSON } from './storage';

/**
 * État persistant partagé entre écrans (contrairement à usePersistentState, qui est local au composant) :
 * un seul exemplaire en mémoire, chargé une fois depuis le stockage, écrit à chaque changement.
 */
export type Shared<T> = {
  get: () => T;
  set: (v: T | ((prev: T) => T)) => void;
  subscribe: (fn: () => void) => () => void;
  ready: () => boolean;
  load: () => Promise<T>;
};

export function shared<T>(key: string, init: T, merge?: (stored: T) => T): Shared<T> {
  let value = init;
  let loaded = false;
  let loading: Promise<T> | null = null;
  const subs = new Set<() => void>();
  const emit = () => subs.forEach((f) => f());
  const load = () => {
    if (!loading)
      loading = loadJSON<T>(key, init).then((v) => {
        // une écriture faite avant la fin du chargement l’emporte
        if (!loaded) value = merge ? merge(v) : v;
        loaded = true;
        emit();
        return value;
      });
    return loading;
  };
  return {
    get: () => value,
    set: (v) => {
      value = typeof v === 'function' ? (v as (p: T) => T)(value) : v;
      loaded = true;
      void saveJSON(key, value);
      emit();
    },
    subscribe: (fn) => {
      subs.add(fn);
      void load();
      return () => subs.delete(fn);
    },
    ready: () => loaded,
    load,
  };
}

/** Lecture réactive d’un état partagé : [valeur, setter, prêt]. */
export function useShared<T>(s: Shared<T>): [T, Shared<T>['set'], boolean] {
  const v = useSyncExternalStore(s.subscribe, s.get, s.get);
  const ready = useSyncExternalStore(s.subscribe, s.ready, s.ready);
  return [v, s.set, ready];
}
