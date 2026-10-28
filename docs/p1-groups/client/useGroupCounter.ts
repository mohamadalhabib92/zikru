/**
 * Zikru P1 — compteur de groupe temps réel + file hors-ligne (BROUILLON, non branché).
 *
 * Emplacement prévu dans l'app : src/lib/groups/useGroupCounter.ts (chemins d'import ci-dessous).
 * Dépendance à ajouter le moment venu : `npx expo install expo-crypto` (octets aléatoires pour l'UUID).
 *
 * Fonctionnement :
 *   tap() → counterQueue.addTaps (mémoire + persistance) → flush toutes les 4 s, au retour au premier plan
 *   et au retour du réseau → seal → PERSISTANCE → markSent → PERSISTANCE → RPC ingest_counter_events
 *   → applyResult + totaux serveur. Les totaux des autres membres arrivent par broadcast privé
 *   « goal:<uuid> » (politique RLS sur realtime.messages). Affichage = total serveur + local non acquitté.
 *
 * Remplacera, une fois validé, l'envoi direct dans goal_contributions de src/lib/community/sync.tsx.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import type { RealtimeChannel } from '@supabase/supabase-js';
import * as Crypto from 'expo-crypto';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AppState, Platform } from 'react-native';
import { supabase } from '../supabase';
import * as Q from './counterQueue';

const STORE_KEY = 'zikru-counter-queue-v1';
const FLUSH_MS = 4000;

// ---------------------------------------------------------------- Magasin unique (module)
// Une seule file par appareil, partagée par tous les écrans qui affichent un compteur.
type Totals = Record<string, { total: number; at: number }>;
let state: Q.QueueState | null = null;
let totals: Totals = {};
let loading: Promise<Q.QueueState> | null = null;
let flushing = false;
let lastError: string | null = null;
const listeners = new Set<() => void>();
let version = 0;
const emit = () => {
  version++;
  listeners.forEach((l) => l());
};

async function persist(s: Q.QueueState): Promise<void> {
  await AsyncStorage.setItem(STORE_KEY, Q.serialize(s));
}

function newDeviceId(): string {
  return Q.uuidV4(Crypto.getRandomBytes(16));
}

async function load(): Promise<Q.QueueState> {
  if (state) return state;
  if (!loading) {
    loading = (async () => {
      const raw = await AsyncStorage.getItem(STORE_KEY);
      // État absent ou illisible → NOUVEL appareil (jamais de seq réutilisé sous le même identifiant).
      const s = Q.deserialize(raw) ?? Q.createQueue(newDeviceId());
      if (!raw) await persist(s);
      state = s;
      emit();
      return s;
    })();
  }
  return loading;
}

async function update(fn: (s: Q.QueueState) => Q.QueueState): Promise<Q.QueueState> {
  const s = fn(await load());
  state = s;
  emit();
  await persist(s);
  return s;
}

function mergeTotal(goalId: string, total: number, at?: string | number) {
  totals = { ...totals, [goalId]: Q.mergeServerTotal(totals[goalId], { total, at }) };
  emit();
}

/** Envoie la file au serveur. Sans effet hors connexion, sans compte ou si un envoi est en cours. */
export async function flushCounter(): Promise<void> {
  if (!supabase || flushing) return;
  const { data: sess } = await supabase.auth.getSession();
  if (!sess.session) return;
  flushing = true;
  try {
    let s = await update((x) => Q.compact(Q.seal(x))); // 1. sceller puis PERSISTER avant tout envoi
    if (!s.registered) {
      const kind = Platform.OS === 'web' ? 'web' : Platform.OS === 'ios' && Platform.isPad ? 'tablet' : 'phone';
      const { error } = await supabase.rpc('register_device', { p_id: s.deviceId, p_kind: kind, p_label: Platform.OS });
      if (error) {
        // Identifiant déjà pris par un autre compte (changement de compte sur l'appareil) : nouvel appareil.
        if (/déjà utilisé/.test(error.message)) {
          // Rien n'a jamais été accepté sous cet identifiant pour ce compte : on renumérote sous un nouveau.
          s = await update((x) => {
            const pending = x.pending.map((e, i) => ({ ...e, seq: i + 1, sent: false }));
            return { ...Q.createQueue(newDeviceId()), open: x.open, pending, nextSeq: pending.length + 1 };
          });
        }
        throw error;
      }
      s = await update((x) => ({ ...x, registered: true }));
    }
    for (let round = 0; round < 10; round++) {
      const batch = Q.nextBatch(s);
      if (batch.length === 0) break;
      s = await update((x) => Q.markSent(x, batch)); // 2. immuable à partir d'ici
      const { data, error } = await supabase.rpc('ingest_counter_events', {
        p_device: s.deviceId,
        p_events: batch.map(({ seq, goal_id, count, at, source }) => ({ seq, goal_id, count, at, source })),
      });
      if (error) throw error; // réseau / débit : on réessaiera, le renvoi sera dédoublonné
      const r = data as Q.IngestResult;
      s = await update((x) => Q.applyResult(x, r));
      for (const [g, t] of Object.entries(r.totals ?? {})) mergeTotal(g, Number(t), Date.now());
      if (r.rejected.length) console.warn('[zikru] événements refusés', r.rejected.map((x) => x.reason));
    }
    lastError = null;
  } catch (e) {
    lastError = e instanceof Error ? e.message : String(e);
  } finally {
    flushing = false;
    emit();
  }
}

// Déclencheurs globaux (installés une seule fois).
let triggersInstalled = false;
function installTriggers() {
  if (triggersInstalled) return;
  triggersInstalled = true;
  setInterval(() => void flushCounter(), FLUSH_MS);
  AppState.addEventListener('change', (st) => {
    if (st === 'active') void flushCounter();
    if (st === 'background') void update(Q.seal); // ne rien perdre si l'OS tue l'app
  });
  NetInfo.addEventListener((n) => {
    if (n.isConnected) void flushCounter();
  });
}

// ---------------------------------------------------------------- Hook
export type GroupCounter = {
  ready: boolean;
  /** Total affiché = serveur + local non acquitté. */
  total: number;
  target: number | null;
  status: 'active' | 'done' | 'archived' | null;
  /** Appuis pas encore confirmés par le serveur. */
  pending: number;
  live: boolean;
  error: string | null;
  tap: (n?: number, source?: Q.CounterSource) => void;
  flush: () => Promise<void>;
};

export function useGroupCounter(goalId: string | null): GroupCounter {
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => version,
  );
  const [meta, setMeta] = useState<{ target: number; status: GroupCounter['status'] } | null>(null);
  const [live, setLive] = useState(false);
  const chan = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    installTriggers();
    void load();
  }, []);

  useEffect(() => {
    if (!goalId || !supabase) return;
    const sb = supabase;
    let alive = true;
    // Total initial + confidentialité appliquée par le serveur (goal_progress).
    void sb.rpc('goal_progress', { p_goal: goalId }).then(({ data }) => {
      if (!alive || !data) return;
      const p = data as { total: number; target: number; status: GroupCounter['status'] };
      setMeta({ target: p.target, status: p.status });
      mergeTotal(goalId, Number(p.total), 0); // horodatage 0 : tout broadcast plus récent l'emporte
    });
    // Broadcast privé : nécessite le JWT de l'utilisateur sur la connexion Realtime.
    void sb.realtime.setAuth().then(() => {
      if (!alive) return;
      chan.current = sb
        .channel(`goal:${goalId}`, { config: { private: true } })
        .on('broadcast', { event: 'progress' }, ({ payload }) => {
          const p = payload as { goal_id: string; total: number; at: string };
          if (p.goal_id === goalId) mergeTotal(goalId, Number(p.total), p.at);
        })
        .subscribe((st) => setLive(st === 'SUBSCRIBED'));
    });
    return () => {
      alive = false;
      if (chan.current) void sb.removeChannel(chan.current);
      chan.current = null;
      setLive(false);
    };
  }, [goalId]);

  const tap = useCallback(
    (n = 1, source: Q.CounterSource = 'ecran') => {
      if (!goalId || meta?.status === 'done' || meta?.status === 'archived') return;
      void update((s) => Q.addTaps(s, [goalId], n, source, new Date()));
    },
    [goalId, meta?.status],
  );

  const s = state;
  const server = goalId ? totals[goalId]?.total ?? 0 : 0;
  return {
    ready: !!s,
    total: goalId && s ? Q.displayTotal(server, s, goalId) : server,
    target: meta?.target ?? null,
    status: meta?.status ?? null,
    pending: goalId && s ? Q.localPending(s, goalId) : 0,
    live,
    error: lastError,
    tap,
    flush: flushCounter,
  };
}

/**
 * À appeler AVANT la déconnexion : envoie ce qui peut l'être puis efface la file, pour que les
 * dhikr d'un compte ne soient jamais envoyés au nom du compte suivant sur le même appareil.
 * Renvoie le nombre d'appuis non synchronisés perdus (à afficher en avertissement si > 0).
 */
export async function flushAndResetOnSignOut(): Promise<number> {
  await flushCounter();
  const s = await load();
  const lost = s.pending.reduce((n, e) => n + e.count, 0) + Object.values(s.open).reduce((n, b) => n + b.count, 0);
  state = Q.createQueue(newDeviceId());
  totals = {};
  await persist(state);
  emit();
  return lost;
}

/** Pont pour la bague / la montre / le tasbih : un appui alimente tous les objectifs liés (même seq). */
export function recordTaps(goalIds: string[], n: number, source: Q.CounterSource): Promise<Q.QueueState> {
  installTriggers();
  return update((s) => Q.addTaps(s, goalIds, n, source, new Date()));
}
