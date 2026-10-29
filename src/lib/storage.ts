import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createDurable, type StorageIssue } from './durable';

/**
 * Stockage local (AsyncStorage sur mobile, localStorage sur le web).
 * Toutes les données « cœur » vivent ici : l'app fonctionne hors-ligne,
 * sans backend ni API payante.
 *
 * Écritures sérialisées par clé, regroupées, réessayées en cas d'échec et SIGNALÉES
 * (voir durable.ts et le bandeau StorageAlert) : plus aucune erreur avalée en silence.
 */
// Préfixe propre à l'app : plusieurs PWA partagent la même origine sur GitHub Pages.
const PREFIX = '@zikru/';

export const durable = createDurable(AsyncStorage);
/** Clé complète (avec le préfixe de l'app). */
export const storageKey = (key: string) => PREFIX + key;
export type { StorageIssue };

/** Problèmes d'enregistrement en cours (affichés par le bandeau StorageAlert). */
export const storageIssues = {
  get: () => durable.issues(),
  subscribe: (f: () => void) => durable.subscribe(f),
  /** Nouvel essai immédiat de toutes les écritures en attente. */
  retry: () => durable.flush(),
  /** Masque une alerte de lecture (clé complète, telle que donnée par l'alerte). */
  dismissFull: (fullKey: string) => durable.dismiss(fullKey),
};

export async function loadJSON<T>(key: string, fallback: T): Promise<T> {
  return (await durable.read<T>(PREFIX + key, fallback)).value;
}
/** Lecture détaillée : indique si la valeur manque, est illisible ou si la lecture a échoué. */
export function readJSON<T>(key: string, fallback: T) {
  return durable.read<T>(PREFIX + key, fallback);
}

/** Écriture sérialisée et réessayée ; true si enregistrée (false : échec signalé, nouvel essai programmé). */
export function saveJSON<T>(key: string, value: T): Promise<boolean> {
  return durable.write(PREFIX + key, value);
}

/**
 * Cache re-téléchargeable (texte du Coran, météo…) : écriture directe, sans nouvel essai ni alerte.
 * À NE PAS utiliser pour des données de l'utilisateur.
 */
export async function saveCacheJSON<T>(key: string, value: T): Promise<boolean> {
  try {
    await AsyncStorage.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch {
    return false; // cache seulement : il sera re-téléchargé
  }
}

/** Force l'enregistrement des écritures en attente (passage en arrière-plan). */
export function flushStorage(key?: string): Promise<boolean> {
  return durable.flush(key == null ? undefined : PREFIX + key);
}

const clearSubs = new Set<() => void>();
/** Prévenu après « Effacer toutes les données » (les états en mémoire reviennent à zéro). */
export function onStorageCleared(f: () => void): () => void {
  clearSubs.add(f);
  return () => {
    clearSubs.delete(f);
  };
}

export async function clearAll(): Promise<void> {
  // les écritures en attente ne doivent pas recréer les données effacées
  durable.cancelAll();
  const keys = await AsyncStorage.getAllKeys();
  await AsyncStorage.multiRemove(keys.filter((k) => k.startsWith(PREFIX)));
  clearSubs.forEach((f) => f());
}

export async function exportAll(): Promise<Record<string, unknown>> {
  await durable.flush();
  const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(PREFIX));
  const pairs = await AsyncStorage.multiGet(keys);
  const out: Record<string, unknown> = {};
  for (const [k, v] of pairs) {
    try {
      out[k.slice(PREFIX.length)] = v ? JSON.parse(v) : null;
    } catch {
      out[k.slice(PREFIX.length)] = v;
    }
  }
  return out;
}

/**
 * État React persistant (écriture immédiate, sérialisée, à chaque changement).
 * Une modification faite AVANT la fin du chargement n'est plus écrasée par la valeur chargée
 * (ni ne l'écrase) : elle est rejouée sur la valeur chargée.
 */
export function usePersistentState<T>(key: string, initial: T | (() => T)) {
  const [value, setValue] = useState<T>(initial);
  const [ready, setReady] = useState(false);
  const initialRef = useRef(initial);
  const cur = useRef<T>(value);
  const loaded = useRef(false);
  const early = useRef<(T | ((prev: T) => T))[]>([]);

  useEffect(() => {
    let alive = true;
    loaded.current = false;
    const fb = typeof initialRef.current === 'function' ? (initialRef.current as () => T)() : initialRef.current;
    loadJSON<T>(key, fb).then((stored) => {
      if (!alive) return;
      let v = stored;
      const ops = early.current;
      early.current = [];
      for (const n of ops) v = typeof n === 'function' ? (n as (p: T) => T)(v) : n;
      loaded.current = true;
      cur.current = v;
      setValue(v);
      setReady(true);
      if (ops.length) void saveJSON(key, v);
    });
    return () => {
      alive = false;
    };
  }, [key]);

  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      const v = typeof next === 'function' ? (next as (p: T) => T)(cur.current) : next;
      cur.current = v;
      setValue(v);
      if (!loaded.current) {
        early.current.push(next);
        return;
      }
      void saveJSON(key, v);
    },
    [key],
  );

  return [value, set, ready] as const;
}

export function uid(prefix = ''): string {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
