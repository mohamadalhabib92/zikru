/**
 * Hauteurs estimées des versets pour getItemLayout.
 * Un seul passage par sourate et par réglage d’affichage : le défilement relit le tableau.
 */
export type AyahMetrics = {
  arSize: number;
  lineH: number;
  trSize: number;
  showTr: boolean;
  showTl: boolean;
};

export type AyahLayout = { heights: number[]; offsets: number[]; total: number };

export function ayahHeight(text: string, m: AyahMetrics): number {
  const perLine = Math.max(16, Math.round(280 / Math.max(14, m.arSize)));
  const lines = Math.max(1, Math.ceil(Math.max(1, text.length) / perLine));
  const arabic = lines * Math.round(m.arSize * m.lineH);
  const tr = m.showTr ? Math.round(m.trSize * 1.55) + 18 : 0;
  const tl = m.showTl ? 28 : 0;
  return arabic + 72 + tr + tl;
}

export function layoutAyahs(texts: readonly string[], m: AyahMetrics): AyahLayout {
  const heights = new Array<number>(texts.length);
  const offsets = new Array<number>(texts.length);
  let y = 0;
  for (let i = 0; i < texts.length; i++) {
    const h = ayahHeight(texts[i] ?? '', m);
    heights[i] = h;
    offsets[i] = y;
    y += h;
  }
  return { heights, offsets, total: y };
}
