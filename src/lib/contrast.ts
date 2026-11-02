/**
 * Contrastes WCAG 2.x (rapport de luminance relative).
 * L'or décoratif #D9B65C vaut ~1,77:1 sur le fond clair #F7F4EE : interdit pour le texte.
 * L'or de texte clair #7A5E14 est mesuré ≥ 4,5:1 sur les fonds clairs de Zikru.
 * L'or #D9B65C reste lisible (≥ 6:1) sur les fonds émeraude sombres (hero).
 */
export const GOLD_DECOR = '#D9B65C';
export const GOLD_INK_LIGHT = '#7A5E14';
export const GOLD_INK_DARK = '#D9B65C';
export const INK_ON_GOLD = '#1B1405';

function channel(c: number) {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function luminance(hex: string): number {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** Rapport WCAG entre deux couleurs hex (#RRGGBB). */
export function contrastRatio(a: string, b: string): number {
  const l1 = luminance(a);
  const l2 = luminance(b);
  const hi = Math.max(l1, l2);
  const lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}

/** Encre lisible (foncée ou blanche) sur un fond donné. */
export function inkOn(bg: string): string {
  const dark = INK_ON_GOLD;
  const light = '#FFFFFF';
  return contrastRatio(dark, bg) >= contrastRatio(light, bg) ? dark : light;
}
