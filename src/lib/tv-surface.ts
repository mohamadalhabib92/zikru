/**
 * Géométrie et télécommande du salon Apple TV.
 * Pur : pas de React, pour que les tests vérifient l’entrée, le Menu et la grille.
 * Les marges d’overscan sont les mêmes que `tvPad` (90 / 60 / 72).
 */

export const TV_FOCUS_SCALE = 1.05;
export const TV_PAD_X = 90;
export const TV_PAD_TOP = 60;
export const TV_PAD_BOTTOM = 72;

/** Carte opaque : le texte ne dépend pas du fond clair, sombre ou verre. */
export const TV_CARD_BG = '#1A2420';
export const TV_ON_CARD = '#F4F1EA';
export const TV_ON_CARD_MUTED = '#D7E0DA';
export const TV_FOCUS_FILL = '#F4EBD9';
export const TV_FOCUS_INK = '#0E2A22';
export const TV_FOCUS_BORDER = '#C8875A';
export const TV_FOCUS_BORDER_WIDTH = 3;
export const TV_FOCUS_MUTED = '#4A4336';
export const TV_BADGE_ON_CARD = '#F0D48A';

/** Bouton du salon : assez large pour un label, lisible à 3 mètres. */
export const TV_BUTTON_MIN_WIDTH = 120;
export const TV_BUTTON_LABEL_SIZE = 34;
export const TV_BUTTON_HINT_SIZE = 28;

/**
 * Colonne du texte d’un bouton.
 * `flex: 1` (flexBasis 0) dans une rangée sans largeur fixe réduit le label à 0 pt :
 * on ne voit plus que la pastille de padding. Réservé aux tuiles qui ont déjà une largeur.
 */
export function tvButtonLabelBox(block: boolean): { flexGrow: number; flexShrink: number; flexBasis: 'auto' } {
  return block
    ? { flexGrow: 1, flexShrink: 1, flexBasis: 'auto' }
    : { flexGrow: 0, flexShrink: 0, flexBasis: 'auto' };
}

/** Couleurs du texte. Au focus, titre et sous-titre sont la même encre foncée sur le fond clair. */
export function tvButtonInk(focused: boolean): { ink: string; hint: string; badge: string } {
  if (focused) return { ink: TV_FOCUS_INK, hint: TV_FOCUS_INK, badge: TV_FOCUS_INK };
  return { ink: TV_ON_CARD, hint: TV_ON_CARD_MUTED, badge: TV_BADGE_ON_CARD };
}

export type TvFocusChrome = {
  backgroundColor?: string;
  borderColor: string;
  borderWidth: number;
  scale: number;
  shadowColor: string;
  shadowOpacity: number;
  shadowRadius: number;
  shadowOffsetY: number;
  color: string;
};

/** Style unique du focus tvOS. Au repos, le fond reste celui de la carte sombre. */
export function tvFocusChrome(on: boolean): TvFocusChrome {
  if (!on) {
    return {
      borderColor: 'transparent',
      borderWidth: TV_FOCUS_BORDER_WIDTH,
      scale: 1,
      shadowColor: 'transparent',
      shadowOpacity: 0,
      shadowRadius: 0,
      shadowOffsetY: 0,
      color: TV_ON_CARD,
    };
  }
  return {
    backgroundColor: TV_FOCUS_FILL,
    borderColor: TV_FOCUS_BORDER,
    borderWidth: TV_FOCUS_BORDER_WIDTH,
    scale: TV_FOCUS_SCALE,
    shadowColor: TV_FOCUS_INK,
    shadowOpacity: 0.28,
    shadowRadius: 12,
    shadowOffsetY: 4,
    color: TV_FOCUS_INK,
  };
}

export type TvGrid = {
  columns: number;
  gap: number;
  tileWidth: number;
  contentWidth: number;
};

export function normalizeTvPath(path: string): string {
  const raw = String(path ?? '').split('?')[0].split('#')[0].trim();
  if (!raw || raw === '/') return '/';
  const withSlash = raw.startsWith('/') ? raw : `/${raw}`;
  return withSlash.replace(/\/+$/, '') || '/';
}

export function isTvRoute(path: string): boolean {
  const p = normalizeTvPath(path);
  return p === '/tv' || p.startsWith('/tv/');
}

/**
 * Expo Router (SDK 58) ignore `initialRouteName` sur `<Stack>` : l’URL de lancement
 * reste `/`, donc l’iPhone (onglets ou onboarding). Sur Apple TV on remplace par `/tv`.
 * Sur iPhone, toujours `null` : aucune route n’est forcée.
 */
/** Après une connexion, l’Apple TV reste sur le salon. Une route iPhone (Communauté, invitation) laisserait un écran vide. */
export function routeAfterAuth(isTV: boolean, phoneRoute: string): string {
  return isTV ? '/tv' : phoneRoute;
}

export function tvLaunchHref(path: string, isTV: boolean): '/tv' | null {
  if (!isTV) return null;
  if (isTvRoute(path)) return null;
  return '/tv';
}

/** Vrai seulement hors de l’accueil `/tv`, là où Menu doit revenir en arrière. */
export function tvMenuCaptures(path: string): boolean {
  return normalizeTvPath(path).startsWith('/tv/');
}

export function tvContentWidth(screenWidth: number): number {
  if (!Number.isFinite(screenWidth)) return 0;
  return Math.max(0, Math.round(screenWidth) - TV_PAD_X * 2);
}

function focusGap(tileEstimate: number): number {
  return Math.max(28, Math.ceil(tileEstimate * (TV_FOCUS_SCALE - 1)) + 8);
}

/**
 * Colonnes qui remplissent le 16:9 sans une seule colonne étirée,
 * et un écart assez large pour l’échelle de focus (1,08) ne recouvre pas le voisin.
 * Un téléviseur 1920 pt tient 4 colonnes ; 1280 pt en tient 3.
 */
export function tvGrid(screenWidth: number, opts?: { minColumns?: number; maxColumns?: number; minTile?: number }): TvGrid {
  const contentWidth = tvContentWidth(screenWidth);
  const minColumns = Math.max(1, opts?.minColumns ?? 2);
  const maxColumns = Math.max(minColumns, opts?.maxColumns ?? 4);
  const minTile = opts?.minTile ?? 280;
  if (contentWidth <= 0) return { columns: 1, gap: 0, tileWidth: 0, contentWidth: 0 };

  let columns = maxColumns;
  let gap = 0;
  let tileWidth = 0;
  while (columns >= 1) {
    gap = columns === 1 ? 0 : focusGap(contentWidth / columns);
    tileWidth = columns === 1 ? contentWidth : (contentWidth - gap * (columns - 1)) / columns;
    const needed = columns === 1 ? 0 : Math.ceil(tileWidth * (TV_FOCUS_SCALE - 1)) + 8;
    if (needed > gap) {
      gap = needed;
      tileWidth = (contentWidth - gap * (columns - 1)) / columns;
    }
    if (tileWidth >= minTile || columns <= minColumns) break;
    columns -= 1;
  }
  tileWidth = Math.floor(tileWidth);
  if (columns > 1) {
    const used = tileWidth * columns + gap * (columns - 1);
    if (used > contentWidth) gap = Math.max(0, Math.floor((contentWidth - tileWidth * columns) / (columns - 1)));
  }
  return { columns, gap, tileWidth: Math.max(0, tileWidth), contentWidth };
}

/** Écart d’une rangée libre : assez large pour l’échelle 1,08 d’une tuile d’environ un tiers d’écran. */
export function tvRowGap(screenWidth: number): number {
  const content = tvContentWidth(screenWidth);
  if (content <= 0) return 28;
  return focusGap(content / 3);
}

export function focusOverlaps(tileWidth: number, gap: number, scale = TV_FOCUS_SCALE): boolean {
  if (tileWidth <= 0) return false;
  return tileWidth * (scale - 1) > gap + 0.01;
}

/** Découpe une liste en rangées. La dernière rangée n’est pas étirée : chaque tuile garde sa largeur. */
export function chunkTv<T>(items: readonly T[], columns: number): { item: T; index: number }[][] {
  const cols = Math.max(1, Math.floor(columns) || 1);
  const rows: { item: T; index: number }[][] = [];
  for (let i = 0; i < items.length; i += cols) {
    const slice = items.slice(i, i + cols);
    rows.push(slice.map((item, offset) => ({ item, index: i + offset })));
  }
  return rows;
}

export type TvMenuEvent = { eventType?: string };
export type TvMenuSubscription = { remove: () => void };

type LegacyMenu = {
  enable: (component: null, callback: (component: null, event: TvMenuEvent) => void) => void;
  disable: () => void;
};

/**
 * react-native-tvos 0.87 expose `TVEventHandler.addListener`.
 * `new TVEventHandler()` lève TypeError et laissait le Menu capturé sans écouteur.
 * On accepte aussi l’ancienne classe, et on n’échoue jamais.
 */
export function subscribeTvMenu(handler: unknown, onMenu: () => void): TvMenuSubscription {
  const notify = (event: TvMenuEvent | null | undefined) => {
    if (event?.eventType === 'menu') onMenu();
  };
  const noop = () => {};
  try {
    if (handler && typeof handler === 'object') {
      const add = (handler as { addListener?: (listener: (event: TvMenuEvent) => void) => { remove?: () => void } | void }).addListener;
      if (typeof add !== 'function') return { remove: noop };
      const sub = add.call(handler, notify);
      return {
        remove: () => {
          try {
            sub?.remove?.();
          } catch {
            /* déjà retiré */
          }
        },
      };
    }
    if (typeof handler === 'function') {
      const menu = new (handler as new () => LegacyMenu)();
      menu.enable(null, (_component, event) => notify(event));
      return {
        remove: () => {
          try {
            menu.disable();
          } catch {
            /* déjà retiré */
          }
        },
      };
    }
  } catch {
    /* objet non constructible, ou addListener en échec */
  }
  return { remove: noop };
}

export function syncTvMenuKey(control: { enableTVMenuKey?: () => void; disableTVMenuKey?: () => void } | null | undefined, capture: boolean): void {
  if (!control) return;
  try {
    if (capture) control.enableTVMenuKey?.();
    else control.disableTVMenuKey?.();
  } catch {
    /* le module natif peut manquer hors d’un téléviseur */
  }
}

/** Un seul retour arrière si le Menu émet à la fois l’événement TV et hardwareBackPress. */
export function createTvMenuGate(back: () => void, lockMs = 400): (canGoBack: boolean) => boolean {
  let busy = false;
  return (canGoBack) => {
    if (!canGoBack || busy) return false;
    busy = true;
    back();
    const timer = setTimeout(() => {
      busy = false;
    }, lockMs);
    const maybe = timer as { unref?: () => void };
    if (typeof maybe.unref === 'function') maybe.unref();
    return true;
  };
}
