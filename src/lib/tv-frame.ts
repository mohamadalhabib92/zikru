/**
 * Taille réelle d’un écran Apple TV.
 * Les images de paysage sont des portraits 720×1280 : sans largeur et hauteur explicites,
 * l’image garde ce rapport et n’occupe qu’un tiers de gauche (1080 × 720/1280 ≈ 608 pt).
 * Une FlatList dans un guide de focus tvOS mesure souvent 0 : elle ne monte aucune ligne.
 * Pur (le rendu React est un arbre d’éléments, sans yoga), pour le test des 114 sourates.
 */
import { createElement, type ReactElement } from 'react';
import { TV_CARD_BG, TV_ON_CARD, TV_PAD_BOTTOM, TV_PAD_X } from './tv-surface';

export const TV_FALLBACK_WIDTH = 1920;
export const TV_FALLBACK_HEIGHT = 1080;

/** Largeur × hauteur. Sur la télé, un rapport portrait est remis en paysage. */
export function tvFrame(width: number, height: number, landscape = false): { width: number; height: number } {
  let w = Number.isFinite(width) && width > 0 ? width : TV_FALLBACK_WIDTH;
  let h = Number.isFinite(height) && height > 0 ? height : TV_FALLBACK_HEIGHT;
  if (landscape && h > w) {
    const swap = w;
    w = h;
    h = swap;
  }
  return { width: Math.round(w), height: Math.round(h) };
}

/** Boîte cover : coins explicites, aucun `aspectRatio` (le bitmap portrait ne dicte plus la largeur). */
export function tvCoverBox(width: number, height: number): { position: 'absolute'; left: 0; top: 0; width: number; height: number } {
  const f = tvFrame(width, height, false);
  return { position: 'absolute', left: 0, top: 0, width: f.width, height: f.height };
}

export function tvContentBox(width: number): number {
  return Math.max(280, tvFrame(width, TV_FALLBACK_HEIGHT).width - TV_PAD_X * 2);
}

/** [n°, nom arabe, translittération, sens, versets, …] */
export type TvSurahInput = readonly [number, string, string, string, number, ...unknown[]];

export type TvSurahRow = {
  n: number;
  label: string;
  hint: string;
  aside: string;
  color: string;
  background: string;
  minHeight: number;
  preferred: boolean;
};

export function buildTvSurahRows(surahs: readonly TvSurahInput[]): TvSurahRow[] {
  return surahs.map((s, i) => ({
    n: s[0],
    label: `${s[0]}. ${s[2]}`,
    hint: String(s[4]),
    aside: s[1],
    color: TV_ON_CARD,
    background: TV_CARD_BG,
    minHeight: 132,
    preferred: i === 0,
  }));
}

/** Arbre des 114 lignes, hors virtualisation. Le premier bouton prend le focus. */
export function renderTvQuranList(surahs: readonly TvSurahInput[], width: number, height: number): ReactElement {
  const frame = tvFrame(width, height, true);
  const rows = buildTvSurahRows(surahs);
  const contentWidth = tvContentBox(frame.width);
  return createElement(
    'ScrollView',
    { style: { flex: 1, width: frame.width, height: frame.height, paddingBottom: TV_PAD_BOTTOM } },
    rows.map((r) =>
      createElement(
        'Pressable',
        {
          key: String(r.n),
          hasTVPreferredFocus: r.preferred,
          accessibilityLabel: r.label,
          style: { width: contentWidth, minHeight: r.minHeight, backgroundColor: r.background },
        },
        createElement('Text', { style: { color: r.color, fontSize: 34, fontWeight: '800' } }, r.label),
        createElement('Text', { style: { color: r.color, fontSize: 28 } }, r.hint),
        createElement('Text', { style: { color: r.color, fontSize: 40 } }, r.aside),
      ),
    ),
  );
}
