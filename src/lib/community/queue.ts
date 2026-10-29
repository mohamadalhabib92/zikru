/** File d'attente des contributions (logique pure, testée par scripts/test-tasbih-log.mjs). */
/**
 * Regroupe les lignes non encore envoyées (même objectif, membre et source) pour borner la file SANS perte.
 * Les lignes d'un envoi en cours gardent leur identifiant (le serveur les a peut-être déjà reçues).
 */
export function coalesceQueue<R extends { goal_id: string; count: number; source: string; client_id: string; member_id?: string | null }>(rows: R[], inflight: Set<string>, newId: () => string): R[] {
  const keep: R[] = [];
  const groups = new Map<string, R>();
  for (const r of rows) {
    if (inflight.has(r.client_id)) {
      keep.push(r);
      continue;
    }
    const k = `${r.goal_id}|${r.member_id ?? ''}|${r.source}`;
    const g = groups.get(k);
    if (g && g.count + r.count <= 100000) g.count += r.count;
    else {
      const c = { ...r, client_id: newId() };
      groups.set(k, c);
      keep.push(c);
    }
  }
  return keep;
}
