/** iOS / Android : fichiers choisis par l'utilisateur (Fichiers / iCloud Drive), copiés dans le dossier privé de l'app. */
import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import { uid } from './storage';
import { titleFromName, type Track } from './songs-types';

function dir() {
  const d = new Directory(Paths.document, 'songs');
  if (!d.exists) d.create({ intermediates: true, idempotent: true });
  return d;
}

export async function importFiles(): Promise<Track[]> {
  const r = await DocumentPicker.getDocumentAsync({ type: 'audio/*', multiple: true, copyToCacheDirectory: true });
  if (r.canceled) return [];
  const out: Track[] = [];
  const d = dir();
  for (const a of r.assets) {
    const id = uid('song-');
    const ext = (a.name.match(/\.[a-z0-9]{2,5}$/i)?.[0] ?? '.mp3').toLowerCase();
    const dest = new File(d, `${id}${ext}`);
    try {
      await new File(a.uri).copy(dest);
      out.push({ id, title: titleFromName(a.name), kind: 'file', uri: `${id}${ext}`, addedAt: Date.now() }); // nom relatif : le chemin du conteneur iOS change entre les mises à jour
    } catch {
      // fichier illisible : ignoré
    }
  }
  return out;
}

export async function resolveUri(t: Track): Promise<string | null> {
  if (t.kind === 'url') return t.uri;
  const f = t.uri.includes('/') ? new File(t.uri) : new File(dir(), t.uri);
  return f.exists ? f.uri : null;
}

export async function removeFile(t: Track) {
  if (t.kind !== 'file') return;
  try {
    const f = t.uri.includes('/') ? new File(t.uri) : new File(dir(), t.uri);
    if (f.exists) f.delete();
  } catch {}
}
