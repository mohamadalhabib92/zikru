/**
 * « Lettres lumineuses » (al-ḥurūf an-nūrāniyya) : les 14 lettres qui composent les lettres isolées
 * (al-ḥurūf al-muqaṭṭaʿa) ouvrant 29 sourates — ا ل م ص ر ك ه ي ع ط س ح ق ن —, résumées par la formule
 * mnémotechnique « نَصٌّ حَكِيمٌ قَاطِعٌ لَهُ سِرٌّ ». Fonctions pures, sans dépendance (testées par scripts/test-nuraniyya.mjs).
 *
 * Règles de classement — choix CONSERVATEURS, fondés sur le tracé écrit (rasm) du texte Tanzil uthmani, rien n’est ajouté
 * ni retiré au texte : on ne fait que découper l’affichage en segments.
 *  - Alif : ا (alif nu), ٱ (alif waṣla), آ (alif madda), أ / إ (hamza portée par un alif) → lumineuses : la lettre tracée
 *    est un alif (les grammairiens anciens nommaient d’ailleurs la hamza « alif »).
 *  - Hamza isolée ء, hamza sur wāw ؤ, hamza sur support yā’ ئ → NON lumineuses (la lettre tracée n’est pas un alif ;
 *    pour ئ la lecture est une hamza, pas un yā’ : on s’abstient).
 *  - ى (yā’ sans points / alif maqṣūra) → lumineuse comme yā’ : en écriture uthmani Tanzil, ى note aussi bien le yā’
 *    final (فِى ، ٱلَّذِى) que l’alif maqṣūra ; le tracé est celui du yā’.
 *  - ة (tā’ marbūṭa) → NON lumineuse (c’est un tā’, même si sa forme rappelle le hā’).
 *  - Signes suscrits (alif suscrit ٰ, petits wāw/yā’, voyelles, madd ٓ…) : ce ne sont pas des lettres ; ils restent
 *    attachés à la lettre qui les porte, dans le même segment, pour ne pas casser le rendu.
 */

export const NURANI_LETTERS = ['ا', 'ل', 'م', 'ص', 'ر', 'ك', 'ه', 'ي', 'ع', 'ط', 'س', 'ح', 'ق', 'ن'] as const;
export const NURANI_MNEMONIC = 'نَصٌّ حَكِيمٌ قَاطِعٌ لَهُ سِرٌّ';

/** Formes rattachées à une lettre lumineuse (tracé). */
const ALIF_FORMS = ['ا', 'ٱ', 'آ', 'أ', 'إ'];
const YA_FORMS = ['ي', 'ى'];
const NURANI = new Set<string>([...NURANI_LETTERS, ...ALIF_FORMS, ...YA_FORMS]);

/** Signes combinants arabes (harakat, signes coraniques suscrits/souscrits, tatwil) : jamais une lettre. */
export function isMark(ch: string): boolean {
  const c = ch.codePointAt(0) ?? 0;
  return (c >= 0x064b && c <= 0x065f) || c === 0x0670 || (c >= 0x06d6 && c <= 0x06dc) || (c >= 0x06df && c <= 0x06e8) || (c >= 0x06ea && c <= 0x06ed) || c === 0x0640;
}
/** Vrai si le caractère (lettre de base) est l’une des 14 lettres lumineuses, selon les règles ci-dessus. */
export function isNurani(ch: string): boolean {
  return NURANI.has(ch);
}

export type Seg = { t: string; on: boolean };
/**
 * Découpe un texte en segments alternés (lumineux / non lumineux). Chaque lettre garde ses signes (voyelles…) dans
 * son segment. La concaténation des segments redonne EXACTEMENT le texte d’origine (vérifié par les tests).
 */
export function segmentNurani(text: string): Seg[] {
  const out: Seg[] = [];
  let cur: Seg | null = null;
  let lastOn = false;
  for (const ch of text) {
    const on: boolean = isMark(ch) ? lastOn : isNurani(ch);
    if (!isMark(ch)) lastOn = on;
    if (cur && cur.on === on) cur.t += ch;
    else {
      cur = { t: ch, on };
      out.push(cur);
    }
  }
  return out;
}
/** Nombre de lettres lumineuses (lettres de base, hors signes) dans un texte. */
export function countNurani(text: string): number {
  let n = 0;
  for (const ch of text) if (!isMark(ch) && isNurani(ch)) n++;
  return n;
}

/** Les 29 sourates ouvertes par des lettres isolées. */
export const MUQATTAAT_SURAHS = [2, 3, 7, 10, 11, 12, 13, 14, 15, 19, 20, 26, 27, 28, 29, 30, 31, 32, 36, 38, 40, 41, 42, 43, 44, 45, 46, 50, 68] as const;
const MUQ = new Set<number>(MUQATTAAT_SURAHS);
/**
 * Longueur (en caractères) des lettres isolées au début du verset (basmala déjà retirée), 0 sinon.
 * Cas : premier mot du verset 1 des 29 sourates ; 42:2 (عٓسٓقٓ) est un verset entier de lettres isolées.
 */
export function muqattaatPrefix(surah: number, ayah: number, text: string): number {
  if (!MUQ.has(surah)) return 0;
  if (!(ayah === 1 || (surah === 42 && ayah === 2))) return 0;
  const m = /^\S+/.exec(text);
  if (!m) return 0;
  // Garde-fou : le mot doit n’être fait que de lettres lumineuses (+ signes), sinon on ne surligne rien.
  for (const ch of m[0]) if (!isMark(ch) && !isNurani(ch)) return 0;
  return m[0].length;
}
