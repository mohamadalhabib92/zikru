/**
 * Partage d’un verset en image (web/PWA) : dessin sur <canvas> (texte arabe uthmani inchangé, sourate et numéro,
 * traduction UNIQUEMENT si sa licence est vérifiée, ligne de sources), puis partage natif du navigateur
 * (Web Share avec fichier) ou téléchargement PNG. Rien n’est envoyé à un serveur.
 */
import { fonts } from '@/ui/theme';

export const VERSE_IMAGE_SUPPORTED = typeof document !== 'undefined';
export type VerseCard = { s: number; a: number; ar: string; surahName: string; tr?: string; trSource?: string; textSource: string; brand: string };

function wrap(ctx: CanvasRenderingContext2D, text: string, max: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(t).width > max && cur) {
      lines.push(cur);
      cur = w;
    } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}

/** Dessine la carte ; renvoie le canvas (exporté pour l’aperçu et les tests manuels). */
export async function drawVerseCard(c: VerseCard, dark: boolean): Promise<HTMLCanvasElement> {
  const W = 1080;
  const pad = 90;
  const cv = document.createElement('canvas');
  const ctx = cv.getContext('2d')!;
  const arFont = (px: number) => `${px}px "${fonts.quran}", "Amiri Quran", "Amiri", serif`;
  try {
    await document.fonts?.load(arFont(56), c.ar);
  } catch {}
  // mise en page : taille de l’arabe réduite tant que le texte dépasse
  let ar = 64;
  let arLines: string[] = [];
  ctx.direction = 'rtl';
  for (; ar >= 30; ar -= 4) {
    ctx.font = arFont(ar);
    arLines = wrap(ctx, c.ar, W - pad * 2);
    if (arLines.length * ar * 1.9 <= 760) break;
  }
  ctx.direction = 'ltr';
  ctx.font = '34px system-ui, -apple-system, "Segoe UI", sans-serif';
  const trLines = c.tr ? wrap(ctx, c.tr, W - pad * 2).slice(0, 8) : [];
  const H = Math.max(1080, pad + 80 + arLines.length * ar * 1.9 + (trLines.length ? 40 + trLines.length * 48 : 0) + 200);
  cv.width = W;
  cv.height = Math.round(H);
  const bg = dark ? '#0B1512' : '#FAF6EC';
  const ink = dark ? '#ECE6D6' : '#1C1B18';
  const muted = dark ? '#A3ADA7' : '#5F5A50';
  const gold = dark ? '#D9B65C' : '#8C6A1C';
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, cv.height);
  ctx.strokeStyle = gold;
  ctx.lineWidth = 3;
  ctx.strokeRect(36, 36, W - 72, cv.height - 72);
  let y = pad + 40;
  // en-tête
  ctx.fillStyle = gold;
  ctx.font = '600 32px system-ui, -apple-system, "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${c.surahName} · ${c.s}:${c.a}`, W / 2, y);
  y += 70;
  // arabe (RTL, centré)
  ctx.fillStyle = ink;
  ctx.direction = 'rtl';
  ctx.font = arFont(ar);
  for (const l of arLines) {
    y += ar * 1.9 * 0.75;
    ctx.fillText(l, W / 2, y);
    y += ar * 1.9 * 0.25;
  }
  ctx.direction = 'ltr';
  if (trLines.length) {
    y += 40;
    ctx.fillStyle = ink;
    ctx.globalAlpha = 0.9;
    ctx.font = '34px system-ui, -apple-system, "Segoe UI", sans-serif';
    for (const l of trLines) {
      y += 48;
      ctx.fillText(l, W / 2, y);
    }
    ctx.globalAlpha = 1;
  }
  // sources (bas de carte)
  ctx.fillStyle = muted;
  ctx.font = '24px system-ui, -apple-system, "Segoe UI", sans-serif';
  const foot = [c.textSource, c.trSource].filter(Boolean).join(' · ');
  const fl = wrap(ctx, foot, W - pad * 2);
  let fy = cv.height - 70 - (fl.length - 1) * 32;
  for (const l of fl) {
    ctx.fillText(l, W / 2, fy);
    fy += 32;
  }
  ctx.fillStyle = gold;
  ctx.font = '700 26px system-ui, -apple-system, "Segoe UI", sans-serif';
  ctx.fillText(c.brand, W / 2, cv.height - 70 - fl.length * 32 - 6);
  return cv;
}

export async function shareVerseImage(c: VerseCard, dark: boolean): Promise<'shared' | 'downloaded' | 'unsupported'> {
  if (!VERSE_IMAGE_SUPPORTED) return 'unsupported';
  const cv = await drawVerseCard(c, dark);
  const blob: Blob | null = await new Promise((r) => cv.toBlob(r, 'image/png'));
  if (!blob) return 'unsupported';
  const name = `coran-${c.s}-${c.a}.png`;
  const file = new File([blob], name, { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: `${c.surahName} ${c.s}:${c.a}` });
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
