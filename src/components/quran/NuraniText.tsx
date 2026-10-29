import { memo, type ReactNode } from 'react';
import { Text } from 'react-native';
import { muqattaatPrefix, segmentNurani } from '@/lib/nuraniyya';

/**
 * Texte coranique avec, en option, les « lettres lumineuses » en doré discret et/ou les lettres isolées d’ouverture.
 * Le texte n’est jamais modifié : il est seulement découpé en segments imbriqués (même police, seule la couleur change),
 * ce qui garde les liaisons de l’écriture arabe (vérifié dans Chromium : largeur identique au texte non coloré).
 * Chaque lettre conserve ses voyelles et signes dans son segment.
 */
/** Mélange deux couleurs #RRGGBB ; renvoie `b` si l’une n’est pas au format hexadécimal. */
export function mixHex(a: string, b: string, t: number): string {
  const ok = /^#[0-9a-f]{6}$/i;
  if (!ok.test(a) || !ok.test(b)) return b;
  const ch = (h: string, i: number) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
  return '#' + [0, 1, 2].map((i) => Math.round(ch(a, i) * (1 - t) + ch(b, i) * t).toString(16).padStart(2, '0')).join('');
}

type Props = { text: string; surah: number; ayah: number; nurani: boolean; muqattaat: boolean; gold: string; ink?: string };
export const NuraniText = memo(function NuraniText({ text, surah, ayah, nurani, muqattaat, gold, ink }: Props): ReactNode {
  const pre = muqattaat ? muqattaatPrefix(surah, ayah, text) : 0;
  if (!nurani && !pre) return text;
  const head = pre ? text.slice(0, pre) : '';
  const rest = pre ? text.slice(pre) : text;
  // Doré discret : mélange 70 % doré / 30 % encre (les 14 lettres couvrent environ la moitié du texte, un doré pur serait trop vif).
  const soft = ink ? mixHex(ink, gold, 0.7) : gold;
  return (
    <>
      {head ? (
        <Text style={{ color: gold, textDecorationLine: 'underline', textDecorationColor: gold }} accessibilityLabel="الحروف المقطعة">
          {head}
        </Text>
      ) : null}
      {nurani
        ? segmentNurani(rest).map((s, i) =>
            s.on ? (
              <Text key={i} style={{ color: soft }}>
                {s.t}
              </Text>
            ) : (
              s.t
            ),
          )
        : rest}
    </>
  );
});
