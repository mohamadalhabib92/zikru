/**
 * Compositions de zikr personnelles — logique pure (testée par scripts/test-zikr.mjs).
 * Une composition = suite ordonnée d’éléments (Nom, verset, du‘a, ṣalāt, texte libre), chacun avec ses répétitions.
 */
import { computeAbjad, type AbjadOptions, type AbjadSystem } from './abjad';

export type ZikrKind = 'name' | 'quran' | 'verse' | 'dua' | 'salat' | 'free';
/** abjadAr : texte servant au calcul abjad s’il diffère du texte récité (Noms : sans « yā » ni article, Yā Laṭīf → لطيف = 129). */
export type ZikrItem = {
  id: string;
  kind: ZikrKind;
  ref?: string;
  label: string;
  ar: string;
  abjadAr?: string;
  tr?: string;
  fr?: string;
  reps: number;
  /** Texte importé par copier-coller ou photo (reconnaissance de texte sur l’appareil). */
  via?: 'paste' | 'photo';
  /** Vrai si le texte n’a pas été reconnu tel quel dans le Coran : à présenter « non vérifié », jamais comme sourcé. */
  unverified?: boolean;
  /** Photo d’origine (fichier local de l’appareil, jamais envoyé ni partagé). */
  photo?: string;
};
/** Mention ajoutée aux textes importés non reconnus dans le Coran. */
export const UNVERIFIED_NOTE = 'Non vérifié — source à vérifier';
export type ZikrGoal = { perDay: number; moment?: string };
export type Zikr = {
  id: string;
  name: string;
  niyya: string;
  items: ZikrItem[];
  goal?: ZikrGoal;
  createdAt: string;
  updatedAt: string;
  done?: Record<string, number>;
  /** Compteurs par id d’étape. Une édition de libellé ne les réécrit pas. */
  practice?: { counts: Record<string, number>; focus?: string };
};

export const KIND_LABEL: Record<ZikrKind, string> = {
  name: 'Nom d’Allah',
  quran: 'Du‘a coranique',
  verse: 'Verset',
  dua: 'Du‘a prophétique',
  salat: 'Ṣalāt sur le Prophète ﷺ',
  free: 'Texte libre',
};
export const MOMENTS = ['Libre', 'Après Fajr', 'Matin', 'Après ‘Asr', 'Soir', 'Après ‘Ishā’', 'Vendredi'];
export const MAX_REPS = 100000;

export function clampReps(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.min(MAX_REPS, Math.max(1, Math.round(n)));
}

export function itemAbjad(item: Pick<ZikrItem, 'ar' | 'abjadAr'>, sys: AbjadSystem, opts: AbjadOptions = {}): number {
  return computeAbjad(item.abjadAr ?? item.ar, sys, opts).total;
}

export type Totals = {
  perRecitation: number;
  withReps: number;
  totalReps: number;
  items: { abjad: number; times: number }[];
};
/** Abjad d’une composition : somme d’une récitation de chaque élément, et somme pondérée par les répétitions. */
export function compositionTotals(items: ZikrItem[], sys: AbjadSystem, opts: AbjadOptions = {}): Totals {
  const per = items.map((it) => {
    const abjad = itemAbjad(it, sys, opts);
    return { abjad, times: abjad * it.reps };
  });
  return {
    perRecitation: per.reduce((a, x) => a + x.abjad, 0),
    withReps: per.reduce((a, x) => a + x.times, 0),
    totalReps: items.reduce((a, it) => a + it.reps, 0),
    items: per,
  };
}

/** Raccourci « valeur abjad = nombre de répétitions » (au moins 1). */
export function abjadAsReps(item: ZikrItem, sys: AbjadSystem, opts: AbjadOptions = {}): ZikrItem {
  return { ...item, reps: clampReps(itemAbjad(item, sys, opts) || 1) };
}

export function moveItem<T>(list: T[], i: number, dir: -1 | 1): T[] {
  const j = i + dir;
  if (i < 0 || i >= list.length || j < 0 || j >= list.length) return list;
  const out = list.slice();
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}
export function removeItem<T>(list: T[], i: number): T[] {
  return list.filter((_, k) => k !== i);
}
export function duplicateItem(list: ZikrItem[], i: number, newId: string): ZikrItem[] {
  if (i < 0 || i >= list.length) return list;
  const out = list.slice();
  out.splice(i + 1, 0, { ...list[i], id: newId });
  return out;
}

/** Progression globale d’une pratique (étape courante + compte de l’étape). */
export function progress(items: ZikrItem[], step: number, count: number): { done: number; total: number; ratio: number } {
  const total = items.reduce((a, it) => a + it.reps, 0);
  let done = 0;
  for (let k = 0; k < Math.min(step, items.length); k++) done += items[k].reps;
  if (step < items.length) done += Math.min(count, items[step].reps);
  else done = total;
  return { done, total, ratio: total ? done / total : 0 };
}

export type PracticeState = { step: number; count: number };
/**
 * Compteurs par identifiant d’étape. Une clé inconnue (étape supprimée) reste dans `counts`
 * et n’est jamais recopiée sur une autre étape.
 */
export type PracticeLedger = { counts: Record<string, number>; focus?: string };

export function countOf(ledger: PracticeLedger | undefined, id: string): number {
  const n = ledger?.counts?.[id];
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : 0;
}

/** Dernière étape encore sous sa cible, sinon la première inachevée dans l’ordre, sinon rien. */
export function unfinishedItem<T extends { id: string; reps: number }>(items: T[], ledger: PracticeLedger): T | undefined {
  if (ledger.focus) {
    const cur = items.find((i) => i.id === ledger.focus);
    if (cur && countOf(ledger, cur.id) < cur.reps) return cur;
  }
  return items.find((i) => countOf(ledger, i.id) < i.reps);
}

/**
 * Ajoute n appuis seulement à l’étape affichée. L’excédent reste sur cette étape (au-dessus de la cible).
 * Il n’est pas versé sur la suivante. L’affichage passe à la suivante seulement une fois la cible atteinte.
 */
export function applyPracticeTaps<T extends { id: string; reps: number }>(
  items: T[],
  ledger: PracticeLedger,
  n: number,
): { ledger: PracticeLedger; completedId?: string; overflow: number } {
  const add = Math.max(0, Math.floor(n));
  const cur = (ledger.focus && items.find((i) => i.id === ledger.focus)) || unfinishedItem(items, ledger);
  if (!cur || add === 0) return { ledger: { counts: { ...ledger.counts }, focus: cur?.id ?? ledger.focus }, overflow: 0 };
  const before = countOf(ledger, cur.id);
  const after = before + add;
  const counts = { ...ledger.counts, [cur.id]: after };
  const reached = before < cur.reps && after >= cur.reps;
  let focus = cur.id;
  if (reached) {
    const next = items.find((i) => i.id !== cur.id && (counts[i.id] ?? 0) < i.reps);
    if (next) focus = next.id;
  }
  return { ledger: { counts, focus }, completedId: reached ? cur.id : undefined, overflow: Math.max(0, after - cur.reps) };
}

/** Reprise : l’étape affichée inachevée, avec son compteur. Aucune clé n’est déplacée. */
export function resumePractice<T extends { id: string; reps: number }>(items: T[], ledger: PracticeLedger | undefined): PracticeLedger {
  const base: PracticeLedger = { counts: { ...(ledger?.counts ?? {}) }, focus: ledger?.focus };
  const cur = unfinishedItem(items, base);
  return { counts: base.counts, focus: cur?.id ?? items[items.length - 1]?.id };
}

/** Baisse ou hausse de cible : les compteurs restent. Le surplus n’est pas redistribué. */
export function countsAfterRetarget(ledger: PracticeLedger): PracticeLedger {
  return { counts: { ...ledger.counts }, focus: ledger.focus };
}

/**
 * Ajoute n appuis à l’étape courante seulement. L’excédent ne passe pas à l’étape suivante.
 */
export function advance(items: ZikrItem[], st: PracticeState, n: number): { state: PracticeState; completed: number[]; finished: boolean; overflow: number } {
  const add = Math.max(0, Math.floor(n));
  if (!items.length || st.step < 0 || st.step >= items.length) {
    return { state: st, completed: [], finished: items.length > 0 && st.step >= items.length, overflow: add };
  }
  const reps = items[st.step].reps;
  const after = st.count + add;
  const reached = st.count < reps && after >= reps;
  return {
    state: { step: st.step, count: after },
    completed: reached ? [st.step] : [],
    finished: false,
    overflow: Math.max(0, after - reps),
  };
}

export function dayKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function markDone(z: Zikr, key = dayKey()): Zikr {
  return { ...z, done: { ...(z.done ?? {}), [key]: (z.done?.[key] ?? 0) + 1 } };
}

const SYS_LABEL: Record<AbjadSystem, string> = {
  mashriqi: 'mashriqi',
  maghribi: 'maghribi',
};
/** Export texte (partage). */
export function exportText(z: Zikr, systems: AbjadSystem[], opts: AbjadOptions = {}): string {
  const L: string[] = [`🕌 ${z.name}`];
  if (z.niyya.trim()) L.push(`Intention : ${z.niyya.trim()}`);
  if (z.goal) L.push(`Objectif : ${z.goal.perDay}× par jour${z.goal.moment && z.goal.moment !== 'Libre' ? ` · ${z.goal.moment}` : ''}`);
  L.push('');
  z.items.forEach((it, i) => {
    L.push(`${i + 1}. ${it.label} — × ${it.reps}`);
    L.push(it.ar);
    if (it.tr) L.push(it.tr);
    if (it.fr) L.push(it.fr);
    if (it.unverified) L.push(`⚠ ${UNVERIFIED_NOTE}`);
    else if (it.ref) L.push(`(${it.ref})`);
    L.push(`Abjad : ${systems.map((s) => `${itemAbjad(it, s, opts)} (${SYS_LABEL[s]})`).join(' · ')}`);
    L.push('');
  });
  for (const s of systems) {
    const t = compositionTotals(z.items, s, opts);
    L.push(`Total abjad ${SYS_LABEL[s]} : ${t.perRecitation} par récitation · ${t.withReps} avec les répétitions`);
  }
  L.push(`Répétitions au total : ${z.items.reduce((a, it) => a + it.reps, 0)}`);
  L.push('', '— composé avec Zikru');
  return L.join('\n');
}
