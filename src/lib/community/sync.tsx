/**
 * Pont « tasbih → objectifs communs ». Chaque appui (écran, compteur Bluetooth, clavier)
 * est ajouté aux objectifs que l'utilisateur a reliés à son tasbih, sauf si son choix
 * de partage pour ce lieu est « Rien ». Les contributions sont regroupées, mises en
 * file d'attente persistante (hors-ligne) et envoyées avec un identifiant client
 * unique : aucun double comptage, aucune perte.
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { uid, usePersistentState } from '../storage';
import type { ClickSource } from '../tasbih-core';
import { allSharingModes, insertContributions, type ContributionRow, type ScopeType, type SharingMode } from './api';
import { useAuth } from './auth';
import { onClicks } from './clicks';

export type GoalLink = { goalId: string; title: string; scope: ScopeType; scopeId: string; scopeName: string; memberId?: string | null };
type Queued = ContributionRow & { tries?: number };
type Ctx = {
  links: GoalLink[];
  isLinked: (goalId: string) => boolean;
  link: (l: GoalLink) => void;
  unlink: (goalId: string) => void;
  /** Ajout manuel (ex. +33) à un objectif, avec file hors-ligne. */
  contribute: (goalId: string, n: number, source?: ContributionRow['source'], memberId?: string | null) => void;
  pending: number;
  lastSync: number | null;
  syncError: string | null;
  flush: () => Promise<void>;
  modes: Record<string, SharingMode>;
  refreshModes: () => Promise<void>;
};
const C = createContext<Ctx | null>(null);
const FLUSH_MS = 6000;

export function CommunityProvider({ children }: { children: ReactNode }) {
  const { userId } = useAuth();
  const [links, setLinks] = usePersistentState<GoalLink[]>('community-links', []);
  const [queue, setQueue, qReady] = usePersistentState<Queued[]>('community-queue', []);
  const [modes, setModes] = useState<Record<string, SharingMode>>({});
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  type Src = ContributionRow['source'];
  const acc = useRef<Map<string, { goalId: string; n: number; source: Src; memberId?: string | null }>>(new Map());
  const linksRef = useRef(links);
  const modesRef = useRef(modes);
  const queueRef = useRef(queue);
  const busy = useRef(false);
  linksRef.current = links;
  modesRef.current = modes;
  queueRef.current = queue;

  const refreshModes = useCallback(async () => {
    if (!userId) return;
    try {
      const rows = await allSharingModes(userId);
      const m: Record<string, SharingMode> = {};
      for (const r of rows) m[(r.family_id ?? r.circle_id) as string] = r.mode;
      setModes(m);
    } catch {
      // hors-ligne
    }
  }, [userId]);
  useEffect(() => {
    void refreshModes();
  }, [refreshModes]);

  /** Transfère l'accumulateur en file (une ligne par objectif) puis envoie la file. */
  const flush = useCallback(async () => {
    if (acc.current.size) {
      const rows: Queued[] = [];
      for (const v of acc.current.values()) {
        let n = v.n;
        while (n > 0) {
          const c = Math.min(n, 100000);
          rows.push({ goal_id: v.goalId, count: c, source: v.source, client_id: uid('c-'), member_id: v.memberId ?? null });
          n -= c;
        }
      }
      acc.current.clear();
      queueRef.current = [...queueRef.current, ...rows].slice(-2000);
      setQueue(queueRef.current);
    }
    if (!userId || busy.current || !queueRef.current.length) return;
    busy.current = true;
    const batch = queueRef.current.slice(0, 200);
    try {
      await insertContributions(
        userId,
        batch.map(({ tries: _t, ...r }) => r),
      );
      const sent = new Set(batch.map((b) => b.client_id));
      queueRef.current = queueRef.current.filter((r) => !sent.has(r.client_id));
      setQueue(queueRef.current);
      setLastSync(Date.now());
      setSyncError(null);
    } catch (e) {
      const m = (e as Error).message ?? '';
      if (/row-level security|violates|check constraint/i.test(m)) {
        // Objectif atteint, archivé ou accès retiré : on écarte ces lignes et on délie l'objectif.
        const bad = new Set(batch.map((b) => b.goal_id));
        queueRef.current = queueRef.current.filter((r) => !bad.has(r.goal_id));
        setQueue(queueRef.current);
        setLinks((ls) => ls.filter((l) => !bad.has(l.goalId)));
        setSyncError('Un objectif n’accepte plus de contributions (atteint ou retiré) : il a été délié.');
      } else {
        setSyncError('Hors-ligne : les contributions seront envoyées plus tard.');
      }
    } finally {
      busy.current = false;
    }
  }, [userId, setQueue, setLinks]);
  const flushRef = useRef(flush);
  flushRef.current = flush;

  const add = (goalId: string, n: number, source: Src, memberId?: string | null) => {
    const key = memberId ? `${goalId}|${memberId}` : goalId;
    const cur = acc.current.get(key);
    acc.current.set(key, { goalId, n: (cur?.n ?? 0) + n, source: cur && cur.source !== source ? 'manuel' : source, memberId });
  };

  // Appuis du tasbih → objectifs reliés (respect du choix de partage par lieu).
  useEffect(
    () =>
      onClicks((n, source: ClickSource) => {
        if (!userId) return;
        for (const l of linksRef.current) {
          if (modesRef.current[l.scopeId] === 'nothing') continue;
          add(l.goalId, n, source, l.memberId);
        }
      }),
    [userId],
  );

  // Envoi périodique + au passage en arrière-plan / retour au premier plan.
  useEffect(() => {
    if (!qReady) return;
    const t = setInterval(() => void flushRef.current(), FLUSH_MS);
    const s = AppState.addEventListener('change', () => void flushRef.current());
    void flushRef.current();
    return () => {
      clearInterval(t);
      s.remove();
    };
  }, [qReady, userId]);

  const value: Ctx = {
    links,
    isLinked: (g) => links.some((l) => l.goalId === g),
    link: (l) => setLinks((ls) => [...ls.filter((x) => x.goalId !== l.goalId), l]),
    unlink: (g) => setLinks((ls) => ls.filter((x) => x.goalId !== g)),
    contribute: (goalId, n, source = 'manuel', memberId) => {
      if (!(n > 0)) return;
      add(goalId, n, source, memberId);
      void flushRef.current();
    },
    pending: queue.reduce((a, r) => a + r.count, 0),
    lastSync,
    syncError,
    flush,
    modes,
    refreshModes,
  };
  return <C.Provider value={value}>{children}</C.Provider>;
}

export function useCommunity() {
  const v = useContext(C);
  if (!v) throw new Error('CommunityProvider manquant');
  return v;
}
