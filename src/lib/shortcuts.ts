/**
 * Raccourcis (Siri, actions rapides de l’icône) : liste FERMÉE d’actions → écrans.
 * Une valeur inconnue venant du système est ignorée (jamais de navigation arbitraire).
 */
export type ShortcutId = 'prayers' | 'wird' | 'tasbih';
export const SHORTCUTS: { id: ShortcutId; path: string; icon: string }[] = [
  { id: 'prayers', path: '/prayers', icon: 'clock' },
  { id: 'wird', path: '/tijani', icon: 'leaf' },
  { id: 'tasbih', path: '/tasbih', icon: 'circle.dotted' },
];
export const pathForShortcut = (id: unknown): string | null => SHORTCUTS.find((s) => s.id === id)?.path ?? null;

/** Ne traite qu’une fois chaque invocation Siri (livraison « au moins une fois »). */
export function freshInvocations<T extends { id: string; name: string }>(list: T[], seen: Set<string>): T[] {
  const out: T[] = [];
  for (const inv of list) {
    if (seen.has(inv.id)) continue;
    seen.add(inv.id);
    out.push(inv);
  }
  return out;
}
