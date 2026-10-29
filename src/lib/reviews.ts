/**
 * Statut de validation savante des contenus. Par défaut, TOUT est « à valider ».
 * Pour marquer un élément validé : ajouter une entrée ici, avec le rôle du validateur (pas de nom sans son accord),
 * la date et la version validée. Exemple :
 *   'duas:sabah': { status: 'valide', role: 'muhaddith', date: '2026-11-15', version: '1.0.25' },
 */
import type { Review } from './provenance-types';

export const REVIEWS: Record<string, Review> = {};

export function reviewFor(uid: string): Review {
  return REVIEWS[uid] ?? { status: 'a_valider' };
}

export const REVIEW_LABEL: Record<Review['status'], string> = {
  a_valider: 'À valider',
  valide: 'Validé',
  a_corriger: 'À corriger',
};
