/**
 * Regroupe des morceaux de texte positionnés (pdf.js, Apple Vision) en lignes lisibles, de haut en bas.
 * Module pur. Repère : y vers le haut (PDF et Vision). Ligne majoritairement arabe : morceaux de droite à gauche.
 * Les lettres ne sont jamais modifiées. Nettoyage minimal (cleanLine) : caractères de contrôle retirés, espaces parasites
 * devant une voyelle arabe retirés (une voyelle ne commence jamais un mot : ces espaces viennent du placement des glyphes
 * dans le PDF), lettres latines isolées collées à un mot arabe retirées (glyphes mal encodés).
 */
export type TextPiece = { str: string; x: number; y: number; w: number; h: number };

const AR = /[\u0600-\u06FF\uFB50-\uFDFF\uFE70-\uFEFF]/g;
const LAT = /[A-Za-z0-9\u00C0-\u024F]/g;

export function itemsToLines(items: TextPiece[]): string[] {
  // Largeur nulle sur beaucoup de morceaux : la géométrie n’est pas fiable (positions des espaces incluses).
  const noWidth = items.filter((p) => p.str.trim() && !(p.w > 0)).length > items.filter((p) => p.str.trim()).length / 2;
  const pieces = items.filter((p) => p.str && p.str.trim()).map((p) => ({ ...p, str: markFirst(p.str) }));
  // tri de haut en bas, puis regroupement par hauteur (tolérance : moitié de la hauteur du texte)
  const sorted = [...pieces].sort((a, b) => b.y - a.y);
  const rows: TextPiece[][] = [];
  for (const p of sorted) {
    const row = rows[rows.length - 1];
    const ref = row?.[0];
    const tol = Math.max(ref?.h ?? 0, p.h, 1e-6) * 0.5;
    if (row && Math.abs(ref.y - p.y) <= tol) row.push(p);
    else rows.push([p]);
  }
  return rows
    .map((row) => {
      const txt = row.map((p) => p.str).join('');
      const rtl = (txt.match(AR)?.length ?? 0) >= (txt.match(LAT)?.length ?? 0);
      const ordered = [...row].sort((a, b) => (rtl ? b.x - a.x : a.x - b.x));
      let out = '';
      let prev: TextPiece | null = null;
      for (const p of ordered) {
        if (prev) {
          const gap = rtl ? prev.x - (p.x + p.w) : p.x - (prev.x + prev.w);
          const spaced = /\s$/.test(out) || /^\s/.test(p.str);
          if (!spaced && !noWidth && gap > Math.max(prev.h, p.h) * 0.15) out += ' ';
        }
        out += p.str;
        prev = p;
      }
      return cleanLine(out);
    })
    .filter(Boolean);
}

const MARK = '\u064B-\u065F\u0670';
/**
 * Un morceau qui commence par une voyelle a été retourné lettre par lettre (voyelle avant sa lettre) : on remet chaque
 * voyelle après sa lettre. Un texte dans le bon ordre ne commence jamais par une voyelle, il n’est donc pas touché.
 */
export function markFirst(s: string): string {
  const t = s.replace(/^[\u0000-\u001F\s]+/, '');
  if (!new RegExp(`^[${MARK}]`).test(t)) return s;
  return t.replace(new RegExp(`([${MARK}]+)([\u0621-\u064A])`, 'g'), '$2$1');
}
/** Nettoyage minimal d’une ligne extraite d’un PDF (voir l’en-tête). */
export function cleanLine(s: string): string {
  return s
    .replace(/[\u0000-\u0008\u000B-\u001F\u007F\uFFFD]/g, '')
    .replace(new RegExp(`(?<=[\u0621-\u064A${MARK}])[A-Za-z&*#@^~|]{1,2}(?![A-Za-z0-9])`, 'g'), '')
    .replace(new RegExp(`(?<=[\u0621-\u064A${MARK}])\\s+(?=[${MARK}])`, 'g'), '')
    // chiffre collé à un mot arabe (« الله١٠٠ ») : on les sépare, sans rien changer d’autre
    .replace(/(?<=[\u0621-\u064A\u064B-\u065F\u0670])(?=[0-9\u0660-\u0669\u06F0-\u06F9])/g, ' ')
    .replace(/(?<=[0-9\u0660-\u0669\u06F0-\u06F9])(?=[\u0621-\u064A])/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
/**
 * Le texte encodé de la page est-il inutilisable ? Certains PDF (ex. imprimés depuis un navigateur) n’indiquent pas
 * quelles lettres arabes correspondent aux formes jointes : pdf.js renvoie alors U+0000 à leur place.
 * Une telle page est traitée comme une page scannée (lecture de l’image), jamais devinée.
 */
export function brokenGlyphs(items: { str: string }[]): boolean {
  const all = items.map((i) => i.str).join('');
  const bad = (all.match(/[\u0000\uFFFD]/g) ?? []).length;
  const ar = (all.match(/[\u0600-\u06FF]/g) ?? []).length;
  return bad >= 3 && bad >= 0.05 * (ar + bad);
}
