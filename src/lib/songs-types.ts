export type Track = { id: string; title: string; kind: 'file' | 'url'; uri: string; addedAt: number };

/** Nettoie un nom de fichier pour en faire un titre lisible. */
export function titleFromName(name: string) {
  return name.replace(/\.[a-z0-9]{2,5}$/i, '').replace(/[_]+/g, ' ').trim() || 'Piste';
}

/** Accepte uniquement des URL http(s) — l'utilisateur doit détenir les droits sur ce qu'il ajoute. */
export function validUrl(u: string) {
  try {
    const x = new URL(u.trim());
    return x.protocol === 'https:' || x.protocol === 'http:';
  } catch {
    return false;
  }
}
