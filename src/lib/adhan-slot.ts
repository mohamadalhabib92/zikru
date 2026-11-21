/** Fenêtre anti-doublon : la notification arrive et l’utilisateur l’ouvre presque en même temps. */
export const ADHAN_DEDUPE_MS = 20_000;

/**
 * Réserve le créneau de lecture de l’adhan.
 * Si la voix n’est pas prête, le créneau n’est pas consommé : un essai plus tard reste possible
 * (démarrage à froid, réglage pas encore lu).
 * Une même notification déjà réservée dans la fenêtre est ignorée.
 */
export function claimAdhanSlot(id: string, now: number, recent: Map<string, number>, canPlay: boolean, windowMs = ADHAN_DEDUPE_MS): boolean {
  if (!canPlay) return false;
  if (id) {
    const prev = recent.get(id);
    if (prev != null && now - prev < windowMs) return false;
    recent.set(id, now);
  }
  return true;
}

/** La lecture a échoué (réseau, fichier absent) : le geste suivant peut réessayer. */
export function releaseAdhanSlot(id: string, recent: Map<string, number>): void {
  if (id) recent.delete(id);
}
