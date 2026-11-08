/**
 * File d'attente des contributions (logique pure, testée par scripts/test-tasbih-log.mjs
 * et scripts/test-preserve.mjs).
 *
 * Une ligne `attempt: 0` n'a jamais été soumise : on peut la fusionner.
 * Dès qu'un envoi est décidé, `attempt` passe à 1 et le couple (client_id, count)
 * ne change plus. Une ligne ancienne sans `attempt` est traitée comme déjà soumise :
 * on ne la fusionne pas et on ne change pas son identifiant (elle a peut-être été reçue).
 */
export type OutboxAttempt = 0 | 1;

export type OutboxRow = {
  goal_id: string;
  count: number;
  source: string;
  client_id: string;
  member_id?: string | null;
  attempt?: OutboxAttempt;
  /**
   * Compte qui a produit la ligne. Absent = tentative ancienne, propriétaire inconnu :
   * on ne le remplit jamais avec le compte actuellement connecté.
   */
  owner?: string;
};

const CAP = 100000;

export function isFrozenAttempt(row: { client_id: string; attempt?: number }, inflight: ReadonlySet<string>): boolean {
  if (inflight.has(row.client_id)) return true;
  return row.attempt !== 0;
}

function groupKey(r: { goal_id: string; member_id?: string | null; source: string; owner?: string }): string {
  return `${r.owner ?? ''}|${r.goal_id}|${r.member_id ?? ''}|${r.source}`;
}

/**
 * Sépare la file selon le compte connecté.
 * Une ligne sans `owner`, ou avec un autre compte, reste en attente : elle n'est pas réattribuée.
 */
export function partitionByOwner<R extends { owner?: string }>(rows: readonly R[], userId: string): { mine: R[]; held: R[] } {
  const mine: R[] = [];
  const held: R[] = [];
  for (const r of rows) {
    if (r.owner === userId) mine.push(r);
    else held.push(r);
  }
  return { mine, held };
}

/** Partage connu : « nothing » n'envoie pas. Tant que les modes ne sont pas chargés, on n'envoie pas. */
export function shareAllowsSend(mode: string | undefined, modesLoaded: boolean): boolean {
  if (!modesLoaded) return false;
  return mode !== 'nothing';
}

/**
 * Borne la file sans retirer d'appuis.
 * Les lignes gelées (envoi décidé, envoi en cours, ou format ancien) sortent inchangées.
 * Les lignes ouvertes du même objectif sont additionnées sous le premier `client_id`.
 */
export function coalesceQueue<R extends OutboxRow>(rows: R[], inflight: ReadonlySet<string>, newId: () => string): R[] {
  const keep: R[] = [];
  const groups = new Map<string, R>();
  for (const r of rows) {
    if (isFrozenAttempt(r, inflight)) {
      keep.push(r);
      continue;
    }
    const k = groupKey(r);
    const g = groups.get(k);
    if (g && g.count + r.count <= CAP) {
      g.count += r.count;
      for (const [key, val] of Object.entries(r)) {
        if (!(key in g) && key !== 'count' && key !== 'client_id') (g as Record<string, unknown>)[key] = val;
      }
    } else {
      const c = { ...r, attempt: 0 as const, client_id: g ? newId() : r.client_id };
      groups.set(k, c);
      keep.push(c);
    }
  }
  return keep;
}

/** Fige le couple identifiant + nombre avant l'appel réseau. Les autres lignes restent telles quelles. */
export function sealAttempts<R extends OutboxRow>(rows: R[], ids: readonly string[]): R[] {
  const set = new Set(ids);
  return rows.map((r) => (set.has(r.client_id) ? { ...r, attempt: 1 as const } : r));
}

/** Retire les lignes dont le serveur a accepté l'identifiant (ou l'avait déjà). */
export function ackAttempts<R extends OutboxRow>(rows: R[], ids: readonly string[]): R[] {
  const set = new Set(ids);
  return rows.filter((r) => !set.has(r.client_id));
}

/**
 * 23505 / duplicate key : l'identifiant est déjà en base, on peut retirer la ligne locale.
 * Toute autre erreur (réseau, RLS, contrainte) : on garde la ligne gelée. On ne la supprime pas.
 */
export function classifyContributionError(e: unknown): 'already-stored' | 'keep' {
  const o = (e ?? {}) as { message?: string; code?: string };
  const code = o.code ?? '';
  const message = o.message ?? '';
  if (code === '23505' || /duplicate key value violates unique/i.test(message)) return 'already-stored';
  return 'keep';
}
