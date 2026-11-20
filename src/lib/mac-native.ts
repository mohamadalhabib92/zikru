/**
 * Lit isiOSAppOnMac une fois, au chargement du module. Absent du binaire : on reste sur iPhone/iPad.
 * Importer ce fichier depuis la racine de l’app, avant les ponts montre et widgets.
 */
import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';
import { setIosAppOnMac } from './mac';

type Native = { isIosAppOnMac?: () => boolean; installKeys?: () => void; addListener?: (event: string, fn: (e: { key?: string }) => void) => { remove(): void } };

function read(): boolean {
  if (Platform.OS !== 'ios') return false;
  try {
    const m = requireOptionalNativeModule<Native>('ZikruMac');
    if (m && typeof m.isIosAppOnMac === 'function') return !!m.isIosAppOnMac();
  } catch {
    /* binaire d’avant le module */
  }
  const idiom = (Platform as { constants?: { interfaceIdiom?: string } }).constants?.interfaceIdiom;
  return idiom === 'mac';
}

setIosAppOnMac(read());

export function macNative(): Native | null {
  if (Platform.OS !== 'ios') return null;
  try {
    return requireOptionalNativeModule<Native>('ZikruMac');
  } catch {
    return null;
  }
}
