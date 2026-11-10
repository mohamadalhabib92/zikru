/** Vrai quand Amiri est chargé. Avant, le texte arabe utilise la police du système (les harakât ne sont pas coupées par une police absente). */
let ready = false;
const subs = new Set<() => void>();

export function setFontsReady(v: boolean) {
  if (ready === v) return;
  ready = v;
  subs.forEach((f) => f());
}
export function fontsAreReady() {
  return ready;
}
export function subscribeFonts(f: () => void) {
  subs.add(f);
  return () => {
    subs.delete(f);
  };
}
