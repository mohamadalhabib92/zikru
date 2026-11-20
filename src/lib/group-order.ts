/**
 * Ordre d’affichage des objectifs d’un groupe.
 * Sans `position` (données d’avant la colonne, ou serveur pas encore migré) : ordre actuel, du plus récent au plus ancien.
 * Avec des positions : l’ordre choisi par l’administrateur. Les compteurs ne sont pas déplacés d’un objectif à l’autre.
 */

export type OrderedGoal = { id: string; position: number | null; created_at: string };

export function orderGroupGoals<T extends OrderedGoal>(goals: readonly T[]): T[] {
  const positioned = goals.some((g) => g.position != null);
  if (!positioned) return [...goals].sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0));
  return [...goals].sort((a, b) => (a.position ?? 1_000_000) - (b.position ?? 1_000_000) || (a.created_at < b.created_at ? -1 : 1));
}

/** Nouvelles positions 1..n après un déplacement. null si le déplacement sort de la liste. Aucun compteur n’est concerné. */
export function positionsAfterMove(ordered: readonly { id: string }[], id: string, dir: -1 | 1): { id: string; position: number }[] | null {
  const i = ordered.findIndex((g) => g.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= ordered.length) return null;
  const next = ordered.slice();
  const tmp = next[i];
  next[i] = next[j];
  next[j] = tmp;
  return next.map((g, k) => ({ id: g.id, position: k + 1 }));
}
