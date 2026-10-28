/** Route à rouvrir après un changement d'apparence (l'arbre est remonté). */
let pending: string | null = null;
export const setPendingRoute = (r: string) => {
  pending = r;
};
export const takePendingRoute = () => {
  const r = pending;
  pending = null;
  return r;
};
