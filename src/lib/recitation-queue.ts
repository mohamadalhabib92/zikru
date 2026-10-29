/**
 * Logique pure de la file de récitation (sans React ni expo-audio) — testée par scripts/test-recitation-queue.mjs.
 * Le hook use-recitation.ts s’appuie dessus pour passer d’un verset au suivant sans course ni double avance.
 */
import type { Step } from './recitation';

const sameVerse = (x?: Step, y?: Step) => !!x && !!y && x.s === y.s && x.a === y.a;

/** Étape suivante après la fin de `pos` : null = fin de file (sans boucle). `same` = même verset (répétition, sans recharger). */
export function advance(queue: Step[], pos: number, loop: boolean): { next: number; same: boolean } | null {
  if (!queue.length || pos < 0 || pos >= queue.length) return null;
  let next = pos + 1;
  if (next >= queue.length) {
    if (!loop) return null;
    next = 0;
  }
  return { next, same: sameVerse(queue[next], queue[pos]) };
}

/** Prochain verset *différent* à précharger (−1 si aucun). */
export function nextDistinct(queue: Step[], pos: number, loop: boolean): number {
  const n = queue.length;
  if (!n || pos < 0 || pos >= n) return -1;
  for (let k = 1; k < n; k++) {
    const i = pos + k;
    if (i >= n && !loop) return -1;
    const j = i % n;
    if (!sameVerse(queue[j], queue[pos])) return j;
  }
  return -1;
}

/** Verset suivant / précédent (et non la répétition suivante) ; −1 si hors file. Au recul, on revient au début des répétitions. */
export function skipTarget(queue: Step[], pos: number, d: number): number {
  if (!queue.length) return -1;
  const cur = queue[pos] ?? queue[0];
  let i = pos;
  do i += d;
  while (i >= 0 && i < queue.length && sameVerse(queue[i], cur));
  if (d < 0) while (i > 0 && sameVerse(queue[i - 1], queue[i])) i--;
  return i >= 0 && i < queue.length ? i : -1;
}

/**
 * Plan de reprise après l’échec n°`failures` (1 = premier échec) d’un même verset :
 * secours immédiat, puis principal à 1,5 s, puis secours à 3 s, puis abandon (null).
 * Sans CDN de secours : principal à 1,5 s puis 3 s, puis abandon.
 */
export function retryPlan(failures: number, hasFallback: boolean): { useFallback: boolean; delayMs: number } | null {
  const plan = hasFallback
    ? [
        { useFallback: true, delayMs: 0 },
        { useFallback: false, delayMs: 1500 },
        { useFallback: true, delayMs: 3000 },
      ]
    : [
        { useFallback: false, delayMs: 1500 },
        { useFallback: false, delayMs: 3000 },
      ];
  return failures >= 1 && failures <= plan.length ? plan[failures - 1] : null;
}

/**
 * Jeton par chargement : chaque lecture (verset chargé ou répétition relancée) reçoit un numéro ;
 * une fin (didJustFinish) n’est traitée qu’une fois et seulement pour le jeton courant,
 * ce qui neutralise les événements en double ou en retard d’un verset précédent.
 */
export function createTokenGate() {
  let cur = 0;
  let done = -1;
  return {
    begin() {
      cur += 1;
      return cur;
    },
    get current() {
      return cur;
    },
    /** true une seule fois pour le jeton courant. */
    finish(token = cur) {
      if (token !== cur || done === token) return false;
      done = token;
      return true;
    },
    isCurrent: (token: number) => token === cur,
  };
}

/** Lecture bloquée ? (lecture demandée, pas d’attente programmée, position figée trop longtemps) */
export function isStalled(p: { playing: boolean; waitingGap: boolean; now: number; lastProgressAt: number; limitMs?: number }): boolean {
  return p.playing && !p.waitingGap && p.now - p.lastProgressAt > (p.limitMs ?? 12000);
}
