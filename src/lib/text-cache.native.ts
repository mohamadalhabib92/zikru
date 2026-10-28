import { Directory, File, Paths } from 'expo-file-system';

/** Cache de gros textes (iOS/Android) : fichiers dans Documents/texts. */
const dir = () => {
  const d = new Directory(Paths.document, 'texts');
  if (!d.exists) d.create();
  return d;
};
const fileFor = (k: string) => new File(dir(), k.replace(/[^\w.-]/g, '_') + '.txt');

export async function readText(key: string): Promise<string | null> {
  try {
    const f = fileFor(key);
    return f.exists ? await f.text() : null;
  } catch {
    return null;
  }
}

export async function writeText(key: string, value: string): Promise<void> {
  try {
    const f = fileFor(key);
    if (!f.exists) f.create();
    await f.write(value);
  } catch {}
}
