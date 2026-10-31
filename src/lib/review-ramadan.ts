/** Lignes de la fiche de relecture pour le mode Ramadan (chargées à la demande avec le module). */
import type { ReviewRow } from './review-sheet';
import { REVIEW_LABEL, reviewFor } from './reviews';

/** Mode Ramadan : mentions et choix par défaut à faire relire (aucune source inventée). */
export function ramadanRows(): ReviewRow[] {
  const row = (uid: string, title: string, o: Partial<ReviewRow>): ReviewRow => {
    const st = reviewFor(uid).status;
    return { uid, kind: 'texte', group: 'Ramadan', title, arabic: '', french: '', english: '', englishState: 'interface : traduction à relire', source: '', grading: 'À compléter', status: st, statusLabel: REVIEW_LABEL[st], note: '', ...o };
  };
  return [
    row('ramadan:odd-nights', 'Dix dernières nuits : mention des nuits impaires', {
      french: 'Une mention attribuée à la Sunna invite à la rechercher dans les nuits impaires des dix dernières. (Affiché avec le badge « Source à compléter ».)',
      source: 'Source à compléter. Piste à vérifier : Sahih al-Bukhari 2017 (« taḥarraw Laylat al-Qadr fi-l-witr min al-‘ashr al-awākhir »).',
      note: 'Confirmer la référence, son texte arabe exact et sa formulation française ; l’app n’affiche aucune date certaine pour Laylat al-Qadr.',
    }),
    row('ramadan:surah-qadr', 'Dix dernières nuits : sourate al-Qadr (97:1-5)', {
      source: 'Texte Tanzil Uthmani (CC BY 3.0), sans traduction affichée.',
      grading: 'Sans objet (Coran)',
      note: 'Vérifier que la présentation (sourate seule, sans vertu affirmée) convient.',
    }),
    row('ramadan:imsak', 'Fin du suhur : marge avant le Fajr', {
      french: 'Par défaut, le suhur se termine au Fajr calculé, sans marge. Une marge de précaution (5 à 20 min) est le choix personnel de l’utilisateur.',
      grading: 'Sans objet (réglage pratique)',
      note: 'Avis demandé sur la formulation et sur le renvoi à la mosquée locale.',
    }),
    row('ramadan:zakat-fitr', 'Zakat al-fitr : rappel sans montant', {
      french: 'Un rappel, rien de plus. Le montant et les modalités se demandent à votre mosquée. L’app ne propose aucun montant.',
      grading: 'Sans objet (rappel)',
      note: 'Vérifier la formulation et la plage de dates proposée (5 derniers jours du mois calculé, avant la prière de l’Aïd).',
    }),
    row('ramadan:qada', 'Suivi du jeûne : jours à rattraper (qada)', {
      french: 'Optionnel et privé. Les jours excusés, non jeûnés et en mode dispense sont comptés à rattraper ; pour les règles qui vous concernent, demandez à une personne de science.',
      grading: 'Sans objet (suivi personnel)',
      note: 'Vérifier que compter les jours en mode dispense comme « à rattraper » est correct dans tous les cas, ou s’il faut laisser l’utilisateur choisir.',
    }),
  ];
}
