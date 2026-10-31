/**
 * Méditation guidée (module pur) : tafakkur (contemplation à partir de versets) et murāqaba (présence attentive).
 * Les versets sont désignés par leur référence et lus dans le texte Tanzil embarqué (jamais recopiés ici).
 * Les consignes ne sont que des indications pratiques (posture, attention, retour au texte), sans promesse
 * ni vertu attribuée ; elles figurent dans la fiche de validation (« à relire »).
 */

export type MeditationKind = 'tafakkur' | 'muraqaba';
export type ThemeId = 'creation' | 'sky' | 'sea' | 'presence';
/** Plage de versets [sourate, premier, dernier]. */
export type VerseRange = [number, number, number];
export type MeditationTheme = { id: ThemeId; kind: MeditationKind; title: string; verses: VerseRange[] };

export const THEMES: MeditationTheme[] = [
  { id: 'creation', kind: 'tafakkur', title: 'La création', verses: [[3, 190, 191], [88, 17, 20]] },
  { id: 'sky', kind: 'tafakkur', title: 'Le ciel', verses: [[67, 3, 4], [51, 47, 47]] },
  { id: 'sea', kind: 'tafakkur', title: 'La mer', verses: [[55, 19, 20], [25, 53, 53]] },
  { id: 'presence', kind: 'muraqaba', title: 'Présence', verses: [[96, 14, 14], [57, 4, 4], [50, 16, 16]] },
];
export const DURATIONS = [3, 5, 7, 10] as const;
export const MIN_MINUTES = 3;
export const MAX_MINUTES = 10;

/** Consignes pratiques (affichées une à une, en fondu). La dernière invite à revenir doucement. */
export const STEPS: Record<MeditationKind, string[]> = {
  tafakkur: [
    'Installez-vous confortablement, le dos droit.',
    'Lisez lentement le verset, une fois ou plusieurs.',
    'Gardez le texte sous les yeux, ou fermez-les.',
    'Quand l’esprit s’éloigne, revenez simplement au verset.',
    'Laissez venir les images de la création que le verset évoque.',
    'Revenez doucement, à votre rythme.',
  ],
  muraqaba: [
    'Installez-vous confortablement, le dos droit.',
    'Lisez lentement le verset.',
    'Restez quelques instants en silence avec son sens.',
    'Quand l’esprit s’éloigne, revenez simplement au verset.',
    'Revenez doucement, à votre rythme.',
  ],
};

export const clampMinutes = (m: number) => Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, Math.round(m) || MIN_MINUTES));

/** Liste à plat des références (sourate, verset) d’un thème. */
export function themeRefs(th: MeditationTheme): [number, number][] {
  const out: [number, number][] = [];
  for (const [s, a, b] of th.verses) for (let x = a; x <= b; x++) out.push([s, x]);
  return out;
}

export type MeditationState = {
  /** Consigne en cours. */
  step: number;
  /** Verset affiché (index dans themeRefs). */
  verse: number;
  /** Avancement global (0..1) : minuteur discret. */
  progress: number;
  done: boolean;
  remainingMs: number;
};
/**
 * État à l’instant t : les consignes se répartissent dans le premier tiers de la séance (puis silence, sauf la
 * dernière, donnée dans la dernière minute) ; les versets se partagent le temps à parts égales.
 */
export function meditationAt(kind: MeditationKind, verseCount: number, minutes: number, tMs: number): MeditationState {
  const total = clampMinutes(minutes) * 60000;
  const t = Math.min(Math.max(0, tMs), total);
  const steps = STEPS[kind].length;
  const lastAt = total - 60000;
  const early = (total / 3) / (steps - 1);
  const step = t >= lastAt ? steps - 1 : Math.min(steps - 2, Math.floor(t / early));
  const verse = Math.min(verseCount - 1, Math.floor((t / total) * Math.max(1, verseCount)));
  return { step, verse: Math.max(0, verse), progress: t / total, done: t >= total, remainingMs: total - t };
}

/** Instants (ms) où une consigne change : un retour haptique très léger y est joué. */
export function stepTimes(kind: MeditationKind, minutes: number): number[] {
  const out: number[] = [];
  let prev = 0;
  const total = clampMinutes(minutes) * 60000;
  for (let t = 0; t <= total; t += 1000) {
    const s = meditationAt(kind, 1, minutes, t).step;
    if (s !== prev) out.push(t);
    prev = s;
  }
  return out;
}
