/**
 * Remplace `Text` de react-native : traduit automatiquement (en, ar, de / de-CH) les morceaux de texte
 * présents dans le catalogue d'interface (`src/lib/ui-cat/<langue>.ts`). Le texte arabe, coranique
 * ou absent du catalogue est rendu tel quel.
 */
import { Children, type ComponentProps, type ReactNode } from 'react';
import { Text as RNText, type TextProps } from 'react-native';
import { translatePiece, useUiLang } from '@/lib/l10n';

function tr(children: ReactNode, lang: ReturnType<typeof useUiLang>): ReactNode {
  if (lang === 'fr') return children; // translatePiece renvoie le texte tel quel pour toute langue sans catalogue
  if (typeof children === 'string') return translatePiece(children, lang);
  if (Array.isArray(children)) {
    // Phrase entière d'abord (ex. « Bonjour » + nom), sinon morceau par morceau.
    return Children.map(children, (c) => (typeof c === 'string' ? translatePiece(c, lang) : c));
  }
  return children;
}

export function Text(props: ComponentProps<typeof RNText>) {
  const lang = useUiLang();
  const { children, accessibilityLabel, ...rest } = props;
  const label = typeof accessibilityLabel === 'string' ? translatePiece(accessibilityLabel, lang) : accessibilityLabel;
  return (
    <RNText accessibilityLabel={label} {...rest}>
      {tr(children, lang)}
    </RNText>
  );
}
export type { TextProps };
