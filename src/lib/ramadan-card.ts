/**
 * Carte « Ramadan Mubarak » (web/PWA) : sobre, motifs géométriques uniquement (aucune image figurative),
 * dessinée localement sur <canvas>, puis Web Share (fichier) ou téléchargement PNG. Rien n’est envoyé à un serveur.
 */
import { fonts } from '@/ui/theme';

export const RAMADAN_CARD_SUPPORTED = typeof document !== 'undefined';
export type RamadanCard = { year: number; yearLine: string; latin: string; line?: string; rtl?: boolean; brand: string };

/** Étoile à 8 branches (deux carrés superposés), motif géométrique. */
function star(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  for (const rot of [0, Math.PI / 4]) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.strokeRect(-r, -r, 2 * r, 2 * r);
    ctx.restore();
  }
}

export async function drawRamadanCard(c: RamadanCard, dark: boolean): Promise<HTMLCanvasElement> {
  const W = 1080;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = W;
  const ctx = cv.getContext('2d')!;
  const ar = (px: number) => `${px}px "${fonts.arabicBold}", "Amiri", serif`;
  try {
    await document.fonts?.load(ar(150), 'رمضان مبارك');
  } catch {}
  const bg = dark ? '#0B1512' : '#FAF6EC';
  const ink = dark ? '#ECE6D6' : '#1C1B18';
  const muted = dark ? '#A3ADA7' : '#5F5A50';
  const gold = dark ? '#D9B65C' : '#8C6A1C';
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, W);
  // cadre double + étoiles aux angles
  ctx.strokeStyle = gold;
  ctx.lineWidth = 3;
  ctx.strokeRect(36, 36, W - 72, W - 72);
  ctx.lineWidth = 1.5;
  ctx.strokeRect(52, 52, W - 104, W - 104);
  ctx.lineWidth = 2.5;
  for (const [x, y] of [[52, 52], [W - 52, 52], [52, W - 52], [W - 52, W - 52]]) star(ctx, x, y, 22);
  // frise d’étoiles en haut et en bas
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.55;
  for (let i = 0; i < 9; i++) {
    const x = 220 + i * 80;
    star(ctx, x, 150, 12);
    star(ctx, x, W - 150, 12);
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'center';
  ctx.fillStyle = ink;
  ctx.direction = 'rtl';
  ctx.font = ar(150);
  ctx.fillText('رمضان مبارك', W / 2, 470);
  ctx.direction = 'ltr';
  ctx.fillStyle = gold;
  ctx.font = '600 64px system-ui, -apple-system, "Segoe UI", sans-serif';
  ctx.fillText(c.latin, W / 2, 600);
  ctx.fillStyle = muted;
  ctx.font = '40px system-ui, -apple-system, "Segoe UI", sans-serif';
  ctx.direction = c.rtl ? 'rtl' : 'ltr';
  ctx.fillText(c.yearLine, W / 2, 690);
  ctx.direction = 'ltr';
  if (c.line) {
    ctx.fillStyle = ink;
    ctx.font = '36px system-ui, -apple-system, "Segoe UI", sans-serif';
    ctx.fillText(c.line.slice(0, 48), W / 2, 790);
  }
  ctx.fillStyle = gold;
  ctx.font = '700 28px system-ui, -apple-system, "Segoe UI", sans-serif';
  ctx.fillText(c.brand, W / 2, W - 200);
  return cv;
}

export async function shareRamadanCard(c: RamadanCard, dark: boolean): Promise<'shared' | 'downloaded' | 'unsupported'> {
  if (!RAMADAN_CARD_SUPPORTED) return 'unsupported';
  const cv = await drawRamadanCard(c, dark);
  const blob: Blob | null = await new Promise((r) => cv.toBlob(r, 'image/png'));
  if (!blob) return 'unsupported';
  const name = `ramadan-${c.year}.png`;
  const file = new File([blob], name, { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: c.latin });
      return 'shared';
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return 'shared';
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return 'downloaded';
}
