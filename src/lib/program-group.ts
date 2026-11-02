/**
 * Programme importé → objectifs communs d’une famille ou d’un cercle (sans nouvelle table) : une étape validée
 * = un objectif (shared_goals), dans l’ordre. Logique pure, testée par scripts/test-programs.mjs.
 * Seul le texte validé est partagé : jamais la photo. Le texte n’est jamais réécrit ; s’il dépasse la limite
 * du serveur, il est coupé (marque « … ») et l’aperçu le signale avant tout envoi.
 */

/** Limites du schéma (shared_goals.title ≤ 80, formula ≤ 200, families.wird ≤ 500 ; char_length = points de code). */
export const GOAL_TITLE_MAX = 80;
export const GOAL_FORMULA_MAX = 200;
export const WIRD_MAX = 500;
export const GOAL_TARGET_MAX = 100000;

export type GroupScope = 'family' | 'circle';
export type GroupDest = { scope: GroupScope; id: string; name: string; role: string; wird?: string | null };

/** Étape validée, telle que produite par stepToItem (texte officiel ou texte de l’utilisateur). */
export type GoalSource = { label: string; ar: string; tr?: string; reps: number; unverified?: boolean; ref?: string };
export type GoalDraft = {
  step: number;
  title: string;
  formula: string | null;
  target: number;
  /** Titre / formule coupés pour tenir dans la limite du serveur (avertissement visible). */
  titleCut: boolean;
  formulaCut: boolean;
  /** Texte non reconnu tel quel (Coran / catalogue) : reste « non vérifié » dans l’aperçu. */
  unverified: boolean;
  ref: string;
};

const len = (s: string) => [...s].length;

/** Coupe à `max` points de code, de préférence sur un espace, avec « … » visible. Texte intact s’il tient. */
export function clip(s: string, max: number): { text: string; cut: boolean } {
  if (len(s) <= max) return { text: s, cut: false };
  const cps = [...s].slice(0, max - 2);
  let head = cps.join('');
  const sp = head.search(/\s\S*$/u);
  if (sp > 0 && len(head.slice(0, sp)) >= Math.floor(max * 0.6)) head = head.slice(0, sp);
  return { text: head.trimEnd() + ' …', cut: true };
}

/** Une étape → un objectif commun : titre « N. libellé », formule = texte validé, cible = nombre validé. */
export function stepsToGoals(items: GoalSource[]): GoalDraft[] {
  return items.map((it, i) => {
    const ar = it.ar.trim();
    const label = it.label.trim() || (it.tr ?? '').trim() || ar;
    const title = clip(`${i + 1}. ${label}`, GOAL_TITLE_MAX);
    const formula = ar ? clip(ar, GOAL_FORMULA_MAX) : null;
    return {
      step: i + 1,
      title: title.text,
      formula: formula ? formula.text : null,
      target: Math.max(1, Math.min(GOAL_TARGET_MAX, Math.round(it.reps))),
      titleCut: title.cut,
      formulaCut: !!formula?.cut,
      unverified: !!it.unverified,
      ref: it.ref ?? '',
    };
  });
}

/**
 * Ordre d’envoi : la liste des objectifs d’un groupe est affichée du plus récent au plus ancien ;
 * l’étape 1 est donc envoyée en dernier pour apparaître en haut, dans l’ordre du programme.
 */
export const insertionOrder = (n: number) => Array.from({ length: n }, (_, i) => n - 1 - i);

/** Résumé pour le wird familial (« Nom : 1. … × 33 · 2. … × 100 ») ; null s’il dépasse 500 caractères. */
export function wirdSummary(name: string, items: GoalSource[]): string | null {
  const parts = items.map((it, i) => `${i + 1}. ${it.label.trim() || it.ar.trim()} × ${it.reps}`);
  const s = `${name.trim() ? name.trim() + ' : ' : ''}${parts.join(' · ')}`;
  return items.length && len(s) <= WIRD_MAX ? s : null;
}

/** Empreinte du lot (destination + contenu exact) : un nouvel essai du même lot réutilise les mêmes identifiants. */
export function batchSignature(dest: Pick<GroupDest, 'scope' | 'id'>, drafts: GoalDraft[]): string {
  const s = JSON.stringify([dest.scope, dest.id, drafts.map((d) => [d.title, d.formula, d.target])]);
  let h1 = 0x811c9dc5;
  let h2 = 5381;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = (Math.imul(h2, 33) + c) >>> 0;
  }
  return `${h1.toString(36)}${h2.toString(36)}:${drafts.length}`;
}

export type PendingBatch = { sig: string; ids: string[] };
/** Identifiants des objectifs : ceux du lot en attente s’il s’agit du même lot (pas de doublon), sinon nouveaux. */
export function planIds(pending: PendingBatch | null, sig: string, n: number, newId: () => string): string[] {
  if (pending && pending.sig === sig && pending.ids.length === n) return pending.ids;
  return Array.from({ length: n }, () => newId());
}

/** Destinations autorisées — mêmes règles que la RLS (shared_goals_insert → private.scope_admin) : famille = parent ou adulte, cercle = fondateur ou modérateur. Jamais pour un compte enfant. */
export function allowedDestinations(
  families: { id: string; name: string; wird?: string | null }[],
  circles: { id: string; name: string }[],
  roles: { family: Record<string, string>; circle: Record<string, string> },
  isMinor: boolean,
): GroupDest[] {
  if (isMinor) return [];
  const fam = families.filter((f) => ['parent', 'adult'].includes(roles.family[f.id] ?? '')).map((f) => ({ scope: 'family' as const, id: f.id, name: f.name, role: roles.family[f.id], wird: f.wird ?? null }));
  const cir = circles.filter((c) => ['founder', 'moderator'].includes(roles.circle[c.id] ?? '')).map((c) => ({ scope: 'circle' as const, id: c.id, name: c.name, role: roles.circle[c.id] }));
  return [...fam, ...cir];
}
/** Le wird familial ne peut être modifié que par un parent (RLS families_update). */
export const canSetWird = (d: GroupDest | null) => !!d && d.scope === 'family' && d.role === 'parent';
