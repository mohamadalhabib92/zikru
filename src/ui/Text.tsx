/**
 * Remplace `Text` de react-native : traduit automatiquement (en, ar, de / de-CH) les morceaux de texte
 * présents dans le catalogue d'interface. Le français source, le texte arabe coranique
 * et toute chaîne absente du catalogue sont rendus tels quels.
 */
import { Children, useContext, type ComponentProps, type ReactNode } from 'react';
import { Text as RNText, type TextProps } from 'react-native';
import { translatePiece, useUiLang } from '@/lib/l10n';
import { TV_FOCUS_INK } from '@/lib/tv-surface';
import { TvFocusContext } from '@/ui/tv-pressable';

function tr(children: ReactNode, lang: ReturnType<typeof useUiLang>): ReactNode {
  if (lang === 'fr') return children;
  if (typeof children === 'string') return translatePiece(children, lang);
  if (Array.isArray(children)) {
    // Phrase entière d'abord (ex. « Bonjour » + nom), sinon morceau par morceau.
    return Children.map(children, (c) => (typeof c === 'string' ? translatePiece(c, lang) : c));
  }
  return children;
}

export function Text(props: ComponentProps<typeof RNText>) {
  const lang = useUiLang();
  const focused = useContext(TvFocusContext);
  const { children, accessibilityLabel, style, allowFontScaling, ...rest } = props;
  const label = typeof accessibilityLabel === 'string' ? translatePiece(accessibilityLabel, lang) : accessibilityLabel;
  return (
    <RNText allowFontScaling={allowFontScaling !== false} accessibilityLabel={label} style={[style, focused ? { color: TV_FOCUS_INK } : null]} {...rest}>
      {tr(children, lang)}
    </RNText>
  );
}
export type { TextProps };
