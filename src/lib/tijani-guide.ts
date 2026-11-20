/**
 * Récitation guidée des wirds tijani : étapes, progression, appuis groupés.
 * Les appuis (écran, bague Bluetooth, clavier) passent par le compteur de tasbih
 * déjà en place : ce module ne fait qu’avancer les étapes.
 * Il n’existe pas de cible watchOS dans ce dépôt. Une montre qui lira le même
 * compteur verra les sessions ; aucun protocole de montre n’est inventé ici.
 */
import { FORMULAS, PRACTICES, type Practice } from './tijani';
import { A_VERIFIER } from './tijani-sources';

export type GuideId = Practice['id'];

export type GuideStep = {
  formula: string;
  label: string;
  ar: string;
  tr: string;
  fr: string;
  en: string;
  reps: number;
  uncounted: boolean;
  review: typeof A_VERIFIER;
  note?: string;
  extra?: string;
  todos: string[];
};

export type GuideState = { step: number; count: number };

export function practiceById(id: string): Practice | undefined {
  return PRACTICES.find((p) => p.id === id);
}

export function guideSteps(p: Practice): GuideStep[] {
  return p.steps.map((s) => {
    const f = FORMULAS[s.formula];
    const uncounted = s.uncounted === true || s.count <= 0;
    return {
      formula: s.formula,
      label: f.title,
      ar: f.ar,
      tr: f.tr,
      fr: f.fr,
      en: f.en,
      reps: uncounted ? 0 : s.count,
      uncounted,
      review: A_VERIFIER,
      note: f.note,
      extra: s.extra,
      todos: [...(s.todos ?? []), ...(f.todos ?? [])].filter((t, i, a) => a.indexOf(t) === i),
    };
  });
}

/** Étapes à nombre fixé seulement : une étape sans nombre ne gonfle pas le total. */
export function guideProgress(steps: GuideStep[], step: number, count: number): { done: number; total: number; ratio: number } {
  let total = 0;
  let done = 0;
  for (let k = 0; k < steps.length; k++) {
    const s = steps[k];
    if (s.uncounted || s.reps <= 0) continue;
    total += s.reps;
    if (k < step) done += s.reps;
    else if (k === step) done += Math.min(Math.max(0, count), s.reps);
  }
  if (step >= steps.length) done = total;
  return { done, total, ratio: total ? done / total : 0 };
}

/**
 * Ajoute n appuis. L’excédent d’une étape comptée passe à la suivante.
 * Une étape sans nombre (Haylala) absorbe les appuis et n’avance pas seule.
 */
export function advanceGuide(steps: GuideStep[], st: GuideState, n: number): { state: GuideState; completed: number[]; finished: boolean } {
  let { step, count } = st;
  const completed: number[] = [];
  let left = Math.max(0, Math.floor(n));
  while (left > 0 && step < steps.length) {
    const cur = steps[step];
    if (cur.uncounted || cur.reps <= 0) {
      count += left;
      left = 0;
      break;
    }
    const need = cur.reps - count;
    if (need <= 0) {
      completed.push(step);
      step += 1;
      count = 0;
      continue;
    }
    if (left >= need) {
      left -= need;
      completed.push(step);
      step += 1;
      count = 0;
    } else {
      count += left;
      left = 0;
    }
  }
  return { state: { step, count }, completed, finished: steps.length > 0 && step >= steps.length };
}

/** L’utilisateur clôt lui-même l’étape sans nombre (fin de la Haylala, ou Maghrib). */
export function completeUncounted(steps: GuideStep[], st: GuideState): { state: GuideState; finished: boolean } {
  const cur = steps[st.step];
  if (!cur || !cur.uncounted) return { state: st, finished: false };
  const step = st.step + 1;
  return { state: { step, count: 0 }, finished: step >= steps.length };
}

/** Instantané enregistré à part des cases à cocher (`tijani-done`), pour ne pas les réinterpréter. */
export type GuideSnapshot = { v: 1; id: GuideId; step: number; count: number; at: string };
