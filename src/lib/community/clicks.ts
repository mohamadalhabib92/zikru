/** Bus minimal des appuis du tasbih (écran, Bluetooth, clavier) vers les communautés. */
import type { ClickSource } from '../tasbih-core';
type L = (n: number, source: ClickSource) => void;
const listeners = new Set<L>();
export function emitClicks(n: number, source: ClickSource) {
  for (const l of listeners) {
    try {
      l(n, source);
    } catch {
      // un abonné défaillant ne doit jamais casser le compteur
    }
  }
}
export function onClicks(l: L): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
