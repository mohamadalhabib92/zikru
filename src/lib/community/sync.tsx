/**
 * Pont « tasbih → objectifs communs ». Chaque appui (écran, compteur Bluetooth, clavier)
 * est ajouté aux objectifs que l'utilisateur a reliés à son tasbih, sauf si son choix
 * de partage pour ce lieu est « Rien ». Les contributions sont regroupées, mises en
 * file d'attente persistante (hors-ligne) et envoyées avec un identifiant client
 * unique : aucun double comptage, aucune perte.
 */
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { flushStorage, uid, usePersistentState } from '../storage';
import type { ClickSource } from '../tasbih-core';
import { allSharingModes, insertContributions, type ContributionRow, type ScopeType, type SharingMode } from './api';
import { useAuth } from './auth';
import { onClicks } from './clicks';
import { ackAttempts, autoShareTargets, classifyContributionError, coalesceQueue, partitionByOwner, sealAttempts, shareAllowsSend, type OutboxRow } from './queue';

export type GoalLink = { goalId: string; title: string; scope: ScopeType; scopeId: string; scopeName: string; memberId?: string | null; focused?: boolean };
type Queued = ContributionRow & OutboxRow & { tries?: number };
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
/** Au-delà, les lignes en attente sont regroupées par objectif (avant : les plus anciennes étaient supprimées). */
const QUEUE_SOFT_MAX = 1000;


export function CommunityProvider({ children }: { children: ReactNode }) {
  const { userId } = useAuth();
  const [links, setLinks] = usePersistentState<GoalLink[]>('community-links', []);
  const [queue, setQueue, qReady] = usePersistentState<Queued[]>('community-queue', []);
  const [modes, setModes] = useState<Record<string, SharingMode>>({});
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  type Src = ContributionRow['source'];
  const acc = useRef<Map<string, { goalId: string; n: number; source: Src; memberId?: string | null; owner: string }>>(new Map());
  const modesLoaded = useRef(false);
  const linksRef = useRef(links);
  const modesRef = useRef(modes);
  const queueRef = useRef(queue);
  const busy = useRef(false);
  const inflight = useRef<Set<string>>(new Set());
  const qReadyRef = useRef(qReady);
  useEffect(() => {
    qReadyRef.current = qReady;
  }, [qReady]);
  useLayoutEffect(() => {
    linksRef.current = links;
    modesRef.current = modes;
    queueRef.current = queue;
  });

  const refreshModes = useCallback(async () => {
    modesLoaded.current = false;
    if (!userId) return;
    try {
      const rows = await allSharingModes(userId);
      const m: Record<string, SharingMode> = {};
      for (const r of rows) m[(r.family_id ?? r.circle_id) as string] = r.mode;
      modesLoaded.current = true;
      setModes(m);
    } catch {
      modesLoaded.current = false;
    }
  }, [userId]);
  useEffect(() => {
    if (!userId) return;
    let alive = true;
    void allSharingModes(userId)
      .then((rows) => {
        if (!alive) return;
        const m: Record<string, SharingMode> = {};
        for (const r of rows) m[(r.family_id ?? r.circle_id) as string] = r.mode;
        modesLoaded.current = true;
        setModes(m);
      })
      .catch(() => {
        modesLoaded.current = false;
      });
    return () => {
      alive = false;
    };
  }, [userId]);

  /** Transfère l'accumulateur dans la file persistante (une ligne par objectif). */
  const stash = useCallback(() => {
    // avant le chargement de la file, les appuis restent dans l'accumulateur (sinon la file chargée serait écrasée)
    if (!qReadyRef.current || !acc.current.size) return;
    {
      const rows: Queued[] = [];
      for (const v of acc.current.values()) {
        let n = v.n;
        while (n > 0) {
          const c = Math.min(n, 100000);
          rows.push({ goal_id: v.goalId, count: c, source: v.source, client_id: uid('c-'), member_id: v.memberId ?? null, attempt: 0, owner: v.owner });
          n -= c;
        }
      }
      acc.current.clear();
      let q = [...queueRef.current, ...rows];
      if (q.length > QUEUE_SOFT_MAX) q = coalesceQueue(q, inflight.current, () => uid('c-'));
      queueRef.current = q;
      setQueue(q);
    }
  }, [setQueue]);
  const stashRef = useRef(stash);
  useEffect(() => {
    stashRef.current = stash;
  }, [stash]);

  /** Range l'accumulateur en file puis envoie la file. */
  const flush = useCallback(async () => {
    stash();
    if (!userId || busy.current || !queueRef.current.length) return;
    const owned = partitionByOwner(queueRef.current, userId);
    if (!owned.mine.length) return;
    busy.current = true;
    const batch = owned.mine.slice(0, 200);
    const ids = batch.map((b) => b.client_id);
    queueRef.current = sealAttempts(queueRef.current, ids);
    setQueue(queueRef.current);
    for (const id of ids) inflight.current.add(id);
    try {
      // L'écriture locale du gel part avant le réseau : un arrêt ici laisse l'identifiant et le nombre intacts.
      const frozen = await flushStorage('community-queue');
      if (!frozen) {
        setSyncError('Les contributions restent sur cet appareil et seront renvoyées. Rien n’a été effacé.');
        return;
      }
      await insertContributions(
        userId,
        batch.map((r) => ({ goal_id: r.goal_id, count: r.count, source: r.source, client_id: r.client_id, member_id: r.member_id ?? null })),
      );
      queueRef.current = ackAttempts(queueRef.current, ids);
      setQueue(queueRef.current);
      setLastSync(Date.now());
      setSyncError(null);
    } catch (e) {
      if (classifyContributionError(e) === 'already-stored') {
        queueRef.current = ackAttempts(queueRef.current, ids);
        setQueue(queueRef.current);
        setSyncError(null);
      } else {
        // La ligne gelée reste. On ne détache pas l'objectif : le nombre local n'est pas effacé.
        setSyncError('Les contributions restent sur cet appareil et seront renvoyées. Rien n’a été effacé.');
      }
    } finally {
      busy.current = false;
      inflight.current.clear();
    }
  }, [userId, setQueue, stash]);
  const flushRef = useRef(flush);
  useLayoutEffect(() => {
    flushRef.current = flush;
  });

  const add = (goalId: string, n: number, source: Src, memberId: string | null | undefined, owner: string) => {
    const key = `${owner}|${memberId ? `${goalId}|${memberId}` : goalId}`;
    const cur = acc.current.get(key);
    acc.current.set(key, { goalId, n: (cur?.n ?? 0) + n, source: cur && cur.source !== source ? 'manuel' : source, memberId, owner });
    // Tout de suite : un arrêt dans les 400 ms ne doit pas perdre la contribution.
    stashRef.current();
  };

  // Appuis du tasbih → objectifs reliés (respect du choix de partage par lieu).
  useEffect(
    () =>
      onClicks((n, source: ClickSource) => {
        if (!userId) return;
        for (const l of autoShareTargets(linksRef.current)) {
          if (!shareAllowsSend(modesRef.current[l.scopeId], modesLoaded.current)) continue;
          add(l.goalId, n, source, l.memberId, userId);
        }
      }),
    // add lit des refs et le userId de cet effet : le relister redémarrait l’abonnement à chaque rendu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    link: (l) => setLinks((ls) => [...ls.filter((x) => x.goalId !== l.goalId).map((x) => ({ ...x, focused: false })), { ...l, focused: true }]),
    unlink: (g) => setLinks((ls) => ls.filter((x) => x.goalId !== g)),
    contribute: (goalId, n, source = 'manuel', memberId) => {
      if (!(n > 0) || !userId) return;
      add(goalId, n, source, memberId, userId);
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
