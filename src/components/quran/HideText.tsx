import { useEffect, useState } from 'react';
import { type TextStyle } from 'react-native';
import { Text } from '@/ui/Text';
import type { HideMode } from '@/lib/quran-store';
import { alpha, fonts } from '@/ui/theme';
import { L } from '@/lib/l10n';

/** Jeton qui n’est pas un mot : signes de pause, ۞ (début de hizb), ۩ (prosternation), numéro de verset. */
const MARK = /^[\u06D6-\u06ED\u06DE\u06E9\u0660-\u0669\u06DD]+$/;
export const isMark = (w: string) => MARK.test(w);

/** Indique si le mot n° k (hors signes) est masqué pour ce mode. */
export function hiddenAt(mode: HideMode, k: number) {
  if (mode === 'all' || mode === 'blur') return true;
  if (mode === 'first') return k > 0;
  if (mode === 'alt') return k % 2 === 1;
  return false;
}

/**
 * Texte coranique avec masquage pour la mémorisation : premier mot seul, un mot sur deux, tout, ou flou.
 * Toucher un mot le révèle ; `revealAll` révèle tout le verset.
 */
export function HideText({ text, mode, revealAll, size, lineH, color, suffix, style, onRevealWord }: { text: string; mode: HideMode; revealAll?: boolean; size: number; lineH: number; color: string; suffix?: string; style?: TextStyle; onRevealWord?: () => void }) {
  const [shown, setShown] = useState<Set<number>>(new Set());
  useEffect(() => setShown(new Set()), [text, mode]);
  const words = text.split(/\s+/).filter(Boolean);
  let k = -1;
  const base: TextStyle = { fontFamily: fonts.quran, fontSize: size, lineHeight: Math.round(size * lineH), color, textAlign: 'right', writingDirection: 'rtl', ...style };
  if (mode === 'none' || revealAll)
    return (
      <Text style={base}>
        {text}
        {suffix ? ` ${suffix}` : ''}
      </Text>
    );
  return (
    <Text style={base} accessibilityHint={L("Touchez un mot masqué pour le révéler")}>
      {words.map((w, i) => {
        const mark = isMark(w);
        if (!mark) k++;
        const idx = k;
        const hide = !mark && hiddenAt(mode, idx) && !shown.has(i);
        const sep = i < words.length - 1 ? ' ' : '';
        if (!hide)
          return (
            <Text key={i}>
              {w}
              {sep}
            </Text>
          );
        const st: TextStyle =
          mode === 'blur'
            ? { color: alpha(color, 0.1), textShadowColor: alpha(color, 0.75), textShadowRadius: Math.round(size / 3), textShadowOffset: { width: 0, height: 0 } }
            : { color: 'transparent', backgroundColor: alpha(color, 0.13), borderRadius: 6 };
        return (
          <Text key={i}>
            <Text
              style={st}
              accessibilityRole="button"
              accessibilityLabel={L("Mot masqué, toucher pour révéler")}
              onPress={() => {
                setShown((s) => new Set(s).add(i));
                onRevealWord?.();
              }}
            >
              {w}
            </Text>
            {sep}
          </Text>
        );
      })}
      {suffix ? ` ${suffix}` : ''}
    </Text>
  );
}
