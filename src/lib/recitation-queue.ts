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

/** Lecture bloquée ? (lecture demandée, pas d’attente programmée, position figée trop longtemps).
 * Une mise en mémoire, une interruption du système ou une pause utilisateur ne sont pas un blocage :
 * les relancer couperait la récitation ou reprendrait malgré l’utilisateur / iOS. */
export function isStalled(p: {
  playing: boolean;
  waitingGap: boolean;
  now: number;
  lastProgressAt: number;
  limitMs?: number;
  buffering?: boolean;
  interrupted?: boolean;
  userPaused?: boolean;
}): boolean {
  if (!p.playing || p.waitingGap || p.buffering || p.interrupted || p.userPaused) return false;
  return p.now - p.lastProgressAt > (p.limitMs ?? 12000);
}

/**
 * Pause native alors que l’app croit encore lire.
 * - interruption : le verset avait commencé (appel, Siri…) — ne pas rappeler play().
 * - startup-stall : play() n’a jamais démarré (session iOS coupée) — la reprise réseau peut réessayer.
 * - buffering : le flux charge — ne pas remplacer le verset.
 */
export function nativePauseKind(p: {
  intentPlaying: boolean;
  userPaused: boolean;
  didJustFinish: boolean;
  isBuffering: boolean;
  nativePlaying: boolean;
  currentTime: number;
  duration?: number;
  loading: boolean;
  waitingGap: boolean;
}): 'none' | 'buffering' | 'interruption' | 'startup-stall' {
  if (!p.intentPlaying || p.userPaused || p.didJustFinish || p.nativePlaying || p.waitingGap) return 'none';
  if (p.isBuffering || p.loading) return 'buffering';
  // Fin de piste : ce n’est pas un appel téléphonique. La file décide d’enchaîner ou de s’arrêter.
  if ((p.duration ?? 0) > 0 && p.currentTime + 0.4 >= (p.duration ?? 0)) return 'none';
  if (p.currentTime > 0.25) return 'interruption';
  return 'startup-stall';
}

/** Ne pas attribuer une fin (souvent périmée) au chargement qui vient de commencer. */
export function nextLoadedToken(p: { didJustFinish: boolean; isLoaded: boolean; playingIntent: boolean; loadedToken: number; token: number }): number {
  if (p.didJustFinish) return p.loadedToken;
  if (p.isLoaded && p.playingIntent && p.loadedToken !== p.token) return p.token;
  return p.loadedToken;
}

/** Une fin n’avance la file que si ce chargement a vraiment joué, une seule fois (voir le jeton). */
export function canAcceptFinish(p: { didJustFinish: boolean; playingIntent: boolean; loadedToken: number; token: number; sawProgress: boolean }): boolean {
  return p.didJustFinish && p.playingIntent && p.loadedToken === p.token && p.sawProgress;
}

export type ReadingMode = 'normal' | 'meditative';
/** Silence après chaque verset en lecture méditative, puis enchaînement automatique. */
export const MEDITATIVE_GAP_MS = 5000;

export type VersePlan =
  | { type: 'end' }
  | { type: 'now'; next: number; same: boolean }
  | { type: 'wait'; delayMs: number; next: number; same: boolean };

/**
 * À la fin d’un verset.
 * - normale : enchaîne tout de suite (ou après la pause de mémorisation déjà réglée).
 * - méditative : 5 s fixes, quel que soit le débit, puis le verset suivant.
 * Dernier verset sans boucle : fin, sans recommencer.
 */
export function planVerseEnd(p: { queue: Step[]; pos: number; loop: boolean; mode: ReadingMode; normalDelayMs: number }): VersePlan {
  const nx = advance(p.queue, p.pos, p.loop);
  if (!nx) return { type: 'end' };
  if (p.mode === 'meditative') return { type: 'wait', delayMs: MEDITATIVE_GAP_MS, next: nx.next, same: nx.same };
  if (p.normalDelayMs > 0) return { type: 'wait', delayMs: p.normalDelayMs, next: nx.next, same: nx.same };
  return { type: 'now', next: nx.next, same: nx.same };
}
