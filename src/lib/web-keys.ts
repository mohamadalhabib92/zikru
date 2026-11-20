/**
 * Raccourcis clavier du navigateur. Liste fermée : une touche ne peut pas ouvrir une adresse arbitraire.
 * Inactif pendant la saisie. Les flèches et la barre d’espace restent au défilement.
 */

export type WebAction =
  | { kind: 'none' }
  | { kind: 'help' }
  | { kind: 'back' }
  | { kind: 'search' }
  | { kind: 'go'; path: string }
  | { kind: 'reader'; cmd: 'next' | 'prev' | 'toggle' };

export type KeyInput = {
  key: string;
  meta: boolean;
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  typing: boolean;
  pendingG: boolean;
  onQuran: boolean;
};

export type KeyState = { pendingG: boolean; action: WebAction };

const GO: Record<string, string> = {
  h: '/',
  p: '/prayers',
  t: '/tasbih',
  l: '/quran',
  m: '/more',
  a: '/adhkar',
  f: '/fiqh',
  c: '/community',
  d: '/discussion',
  s: '/search',
};

export const WEB_KEY_ROWS: { keys: string; label: string }[] = [
  { keys: '?', label: 'Afficher ou masquer l’aide des raccourcis' },
  { keys: 'Échap', label: 'Revenir à l’écran précédent' },
  { keys: '/  ·  Ctrl K', label: 'Ouvrir la recherche' },
  { keys: 'g puis h', label: 'Aller à l’accueil' },
  { keys: 'g puis p', label: 'Aller aux horaires de prière' },
  { keys: 'g puis t', label: 'Aller au tasbih' },
  { keys: 'g puis l', label: 'Aller au Coran' },
  { keys: 'g puis m', label: 'Aller à Plus' },
  { keys: 'g puis a', label: 'Aller aux adhkar' },
  { keys: 'g puis f', label: 'Aller au fiqh' },
  { keys: 'g puis c', label: 'Aller à la communauté' },
  { keys: 'g puis d', label: 'Aller à la discussion' },
  { keys: 'j', label: 'Verset suivant' },
  { keys: 'k', label: 'Verset précédent' },
  { keys: 'p', label: 'Lecture ou pause de la récitation' },
];

export function isTypingTarget(tag: string | undefined, editable: boolean | undefined): boolean {
  if (editable) return true;
  const t = (tag ?? '').toLowerCase();
  return t === 'input' || t === 'textarea' || t === 'select';
}

/** Vrai seulement pour le lecteur d’une sourate (`/quran/2`), pas pour l’index. */
export function isQuranReaderPath(path: string): boolean {
  return /\/quran\/\d+(?:$|[/?#])/.test(path);
}

export function reduceWebKey(input: KeyInput): KeyState {
  const key = input.key;
  if (input.typing || input.alt) return { pendingG: false, action: { kind: 'none' } };
  const chord = key.length === 1 ? key.toLowerCase() : key;
  if ((input.meta || input.ctrl) && chord === 'k') return { pendingG: false, action: { kind: 'search' } };
  if (input.meta || input.ctrl) return { pendingG: false, action: { kind: 'none' } };
  if (key === 'Escape') return { pendingG: false, action: { kind: 'back' } };
  if (key === '?' || (key === '/' && input.shift)) return { pendingG: false, action: { kind: 'help' } };
  if (key === '/') return { pendingG: false, action: { kind: 'search' } };
  if (input.pendingG) {
    const path = GO[chord];
    if (path) return { pendingG: false, action: { kind: 'go', path } };
    return { pendingG: false, action: { kind: 'none' } };
  }
  if (chord === 'g') return { pendingG: true, action: { kind: 'none' } };
  if (input.onQuran && chord === 'j') return { pendingG: false, action: { kind: 'reader', cmd: 'next' } };
  if (input.onQuran && chord === 'k') return { pendingG: false, action: { kind: 'reader', cmd: 'prev' } };
  if (input.onQuran && chord === 'p') return { pendingG: false, action: { kind: 'reader', cmd: 'toggle' } };
  return { pendingG: false, action: { kind: 'none' } };
}

export type ReaderCmd = 'next' | 'prev' | 'toggle';
const readers = new Set<(cmd: ReaderCmd) => void>();

export function subscribeReaderKeys(fn: (cmd: ReaderCmd) => void): () => void {
  readers.add(fn);
  return () => {
    readers.delete(fn);
  };
}

/** False si aucun lecteur n’écoute : l’appelant laisse alors la touche au navigateur. */
export function emitReaderKey(cmd: ReaderCmd): boolean {
  if (readers.size === 0) return false;
  readers.forEach((fn) => fn(cmd));
  return true;
}

let openHelp: (() => void) | null = null;
export function registerWebHelp(fn: () => void): () => void {
  openHelp = fn;
  return () => {
    if (openHelp === fn) openHelp = null;
  };
}
export function requestWebHelp(): void {
  openHelp?.();
}
