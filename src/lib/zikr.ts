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
  via?: 'paste' | 'photo' | 'pdf';
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
 * Ajoute n appuis à la pratique ; l’excédent passe à l’étape suivante (appuis groupés du compteur Bluetooth).
 * Renvoie les étapes complétées (index) et si la composition est terminée.
 */
export function advance(items: ZikrItem[], st: PracticeState, n: number): { state: PracticeState; completed: number[]; finished: boolean } {
  let { step, count } = st;
  const completed: number[] = [];
  let left = Math.max(0, Math.floor(n));
  while (left > 0 && step < items.length) {
    const need = items[step].reps - count;
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
  return {
    state: { step, count },
    completed,
    finished: step >= items.length && items.length > 0,
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
