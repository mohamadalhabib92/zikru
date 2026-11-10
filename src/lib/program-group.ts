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

/** Destinations autorisées — mêmes règles que la RLS (shared_goals_insert → private.is_group_admin) : famille = parent, cercle = fondateur. Jamais un adulte, un modérateur ou un compte enfant. */
export function allowedDestinations(
  families: { id: string; name: string; wird?: string | null }[],
  circles: { id: string; name: string }[],
  roles: { family: Record<string, string>; circle: Record<string, string> },
  isMinor: boolean,
): GroupDest[] {
  if (isMinor) return [];
  const fam = families.filter((f) => roles.family[f.id] === 'parent').map((f) => ({ scope: 'family' as const, id: f.id, name: f.name, role: roles.family[f.id], wird: f.wird ?? null }));
  const cir = circles.filter((c) => roles.circle[c.id] === 'founder').map((c) => ({ scope: 'circle' as const, id: c.id, name: c.name, role: roles.circle[c.id] }));
  return [...fam, ...cir];
}
/** Le wird familial ne peut être modifié que par un parent (RLS families_update). */
export const canSetWird = (d: GroupDest | null) => !!d && d.scope === 'family' && d.role === 'parent';

// ---------- Programme de groupe (tables group_programs / group_program_steps) ----------
/** Limites du schéma group_programs / group_program_steps (char_length = points de code). */
export const PROGRAM_TITLE_MAX = 80;
export const PROGRAM_LABEL_MAX = 120;
export const PROGRAM_TEXT_MAX = 4000;
export const PROGRAM_REF_MAX = 200;
export const PROGRAM_STEPS_MAX = 100;

export type ProgramSource = GoalSource & { kind?: string; fr?: string };
export type ProgramStepDraft = {
  label: string;
  arabic: string | null;
  translit: string | null;
  translation: string | null;
  target: number;
  verification: 'unverified' | 'catalogue' | 'quran';
  source_ref: string | null;
  /** Un texte a dû être coupé (jamais l’arabe reconnu : un tel texte tient toujours dans 4000 caractères). */
  cut: boolean;
};

/**
 * Étapes validées → programme de groupe : texte arabe complet (jamais réécrit), translittération, traduction du
 * catalogue, nombre. Statut : « quran » (passage reconnu), « catalogue » (formule du catalogue), sinon « unverified ».
 */
export function stepsToProgram(name: string, items: ProgramSource[]): { title: string; titleCut: boolean; steps: ProgramStepDraft[] } {
  const t = clip(name.trim(), PROGRAM_TITLE_MAX);
  const steps = items.slice(0, PROGRAM_STEPS_MAX).map((it) => {
    const ar = it.ar.trim();
    const lab = clip(it.label.trim() || (it.tr ?? '').trim() || ar, PROGRAM_LABEL_MAX);
    const arabic = ar ? clip(ar, PROGRAM_TEXT_MAX) : null;
    const tr = (it.tr ?? '').trim() ? clip((it.tr ?? '').trim(), PROGRAM_TEXT_MAX) : null;
    const fr = (it.fr ?? '').trim() ? clip((it.fr ?? '').trim(), PROGRAM_TEXT_MAX) : null;
    const ref = (it.ref ?? '').trim() ? clip((it.ref ?? '').trim(), PROGRAM_REF_MAX) : null;
    const verification: ProgramStepDraft['verification'] = it.unverified ? 'unverified' : it.kind === 'verse' ? 'quran' : 'catalogue';
    return {
      label: lab.text,
      arabic: arabic?.text ?? null,
      translit: tr?.text ?? null,
      translation: fr?.text ?? null,
      target: Math.max(1, Math.min(GOAL_TARGET_MAX, Math.round(it.reps))),
      verification,
      source_ref: ref?.text ?? null,
      cut: lab.cut || !!arabic?.cut || !!tr?.cut || !!fr?.cut || !!ref?.cut,
    };
  });
  return { title: t.text, titleCut: t.cut, steps };
}

/** Empreinte d’un programme (destination + contenu exact) : un nouvel essai réutilise le même identifiant. */
export function programSignature(dest: Pick<GroupDest, 'scope' | 'id'>, title: string, steps: ProgramStepDraft[]): string {
  const asGoals = steps.map((s, i) => ({ step: i + 1, title: `${title}\u0000${s.label}`, formula: s.arabic ?? s.translit, target: s.target })) as GoalDraft[];
  return 'p:' + batchSignature(dest, asGoals);
}

// ---------- Tasbih de groupe : enchaînement des étapes (logique pure) ----------
export type ChainStep = { id: string; target: number };
/** Première étape non terminée (ou la dernière si tout est fait). */
export function currentStep(steps: ChainStep[], counts: Record<string, number>): number {
  const i = steps.findIndex((s) => (counts[s.id] ?? 0) < s.target);
  return i === -1 ? Math.max(0, steps.length - 1) : i;
}
export const programDone = (steps: ChainStep[], counts: Record<string, number>) => steps.length > 0 && steps.every((s) => (counts[s.id] ?? 0) >= s.target);
/**
 * Un appui (+1, ou −1 pour annuler) sur l’étape `i` : borné à 0..nombre de l’étape. Renvoie les nouveaux nombres,
 * l’étape à afficher ensuite (passage automatique à la suivante quand l’étape est complète) et si elle vient d’être finie.
 */
export function tapStep(steps: ChainStep[], counts: Record<string, number>, i: number, delta: 1 | -1 = 1): { counts: Record<string, number>; next: number; completed: boolean } {
  const s = steps[i];
  if (!s) return { counts, next: i, completed: false };
  const before = counts[s.id] ?? 0;
  const after = Math.max(0, Math.min(s.target, before + delta));
  const out = { ...counts, [s.id]: after };
  const completed = before < s.target && after >= s.target;
  const next = completed && i < steps.length - 1 ? i + 1 : i;
  return { counts: out, next, completed };
}
/** Nombres à afficher : la valeur locale non encore envoyée l’emporte ; sinon celle du serveur. */
export function mergeCounts(server: Record<string, number>, local: Record<string, number>, dirty: Set<string> | string[]): Record<string, number> {
  const d = new Set(dirty);
  const out = { ...server };
  for (const k of d) if (k in local) out[k] = local[k];
  return out;
}
