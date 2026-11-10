import { useLayoutEffect, useRef } from 'react';

/** Garde la dernière valeur pour un gestionnaire, sans écrire le ref pendant le rendu. */
export function useLatest<T>(value: T) {
  const ref = useRef(value);
  useLayoutEffect(() => {
    ref.current = value;
  });
  return ref;
}
