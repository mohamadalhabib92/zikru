/**
 * Chaque jugement de fiqh a une entrée par langue de l’app.
 * L’arabe cité est l’extrait de l’édition. Le français et l’anglais sont les résumés déjà dans l’app.
 * Les autres langues replient explicitement sur le français, avec le drapeau de traduction.
 * Le résumé n’est pas le texte de l’édition.
 */
import { FIQH_EN } from './i18n-content/fiqh';
import { citation, RULINGS, type FiqhRuling } from './fiqh-rulings';
import { buildLocales, FLAG_SCHOLAR, FLAG_TRANSLATION, type LocaleMap } from './religious-locale';

export type RulingLocales = { id: string; matn: LocaleMap; explanation: LocaleMap };

export function rulingLocales(r: FiqhRuling): RulingLocales {
  const cite = [r.source, ...(r.also ?? [])].map(citation).join(' ; ');
  const en = FIQH_EN[r.id];
  return {
    id: r.id,
    matn: buildLocales(
      {
        ar: { text: r.textAr, source: cite, kind: 'matn', flag: FLAG_SCHOLAR },
      },
      'ar',
    ),
    explanation: buildLocales({
      fr: {
        text: r.items.join('\n'),
        source: cite + ' — résumé français Zikru, pas le texte de l’édition.',
        kind: 'literal',
        flag: FLAG_TRANSLATION,
      },
      ...(en
        ? {
            en: {
              text: en.items.join('\n'),
              source: cite + ' — English summary by Zikru, not the edition’s wording.',
              kind: 'literal' as const,
              flag: FLAG_TRANSLATION,
            },
          }
        : {}),
    }),
  };
}

export function allRulingLocales(): RulingLocales[] {
  return RULINGS.map(rulingLocales);
}
