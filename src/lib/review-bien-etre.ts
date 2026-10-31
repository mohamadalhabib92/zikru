/** Lignes de la fiche de relecture pour le module bien-être (chargées à la demande avec le module). */
import { STEPS, THEMES } from './meditation';
import type { ReviewRow } from './review-sheet';
import { REVIEW_LABEL, reviewFor } from './reviews';
import { LESSONS, TAJWID_REVIEW_NOTE } from './tajwid';

/** Module bien-être : leçons de tajwid, consignes de méditation, dhikr au souffle (tout est « à relire »). */
export function bienEtreRows(): ReviewRow[] {
  const row = (uid: string, group: string, title: string, o: Partial<ReviewRow>): ReviewRow => {
    const st = reviewFor(uid).status;
    return { uid, kind: 'texte', group, title, arabic: '', french: '', english: '', englishState: 'interface : traduction à relire', source: '', grading: 'Sans objet (règle de lecture ou consigne pratique)', status: st, statusLabel: REVIEW_LABEL[st], note: '', ...o };
  };
  const out: ReviewRow[] = LESSONS.map((l) =>
    row(`tajwid:${l.id}`, 'Bien-être — tajwid (Ḥafṣ ‘an ‘Āṣim)', `${l.title} (${l.ar})`, {
      arabic: l.ar,
      french: l.text,
      source: `Définition usuelle de tajwid (Tuḥfat al-aṭfāl, al-Jazariyya : à confirmer). Exemple : Coran ${l.ex.s}:${l.ex.a}, mots ${l.ex.w[0] + 1} à ${l.ex.w[1] + 1}, lus dans le texte Tanzil Uthmani.`,
      note: `${TAJWID_REVIEW_NOTE}. Vérifier la définition, la durée des madd et que l’exemple illustre bien la règle.`,
    }),
  );
  for (const k of ['tafakkur', 'muraqaba'] as const)
    out.push(
      row(`meditation:${k}`, 'Bien-être — méditation', k === 'tafakkur' ? 'Tafakkur : consignes et versets' : 'Murāqaba : consignes et versets', {
        french: STEPS[k].map((x, i) => `${i + 1}. ${x}`).join(' '),
        source: THEMES.filter((t) => t.kind === k).map((t) => `${t.title} : ${t.verses.map(([s, a, b]) => (a === b ? `${s}:${a}` : `${s}:${a}-${b}`)).join(', ')}`).join(' · ') + ' (texte Tanzil, sans traduction affichée)',
        note: 'Consignes pratiques rédigées par Zikru, sans vertu ni promesse. Vérifier qu’elles conviennent et que les versets choisis sont adaptés au thème.',
      }),
    );
  out.push(
    row('breath:dhikr', 'Bien-être — respiration', 'Dhikr calé sur le souffle (Nom à l’inspiration / à l’expiration)', {
      arabic: 'اللَّهُ',
      french: 'Facultatif, désactivé par défaut. Proposé : Allāh (Nom n° 1) à l’expiration ; chaque phase peut recevoir l’un des 99 Noms.',
      source: 'Noms : liste de at-Tirmidhī 3507. « Hū » à l’expiration (usage soufi) non proposé : aucune source dans le catalogue.',
      note: 'Avis demandé : convient-il d’associer un Nom au souffle ? Faut-il proposer « Hū » ou « Lā ilāha illā Llāh » (inspiration / expiration), et avec quelle source ?',
    }),
    row('names:flashcards', 'Bien-être — cartes des 99 Noms', 'Sens des Noms affichés au dos des cartes', {
      source: 'Liste : at-Tirmidhī 3507. Sens : traduction Zikru (fr) et NAMES_EN (en), sans source par sens.',
      note: 'Chaque carte porte la mention « Sens à relire ». Relire les 99 sens (fr, en).',
    }),
  );
  return out;
}
