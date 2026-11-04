/**
 * Verrouillage du téléphone sur l'app : ce que la plateforme permet réellement.
 * - iOS (iPhone personnel) : aucune API publique ne verrouille l'appareil depuis l'app.
 *   `requestGuidedAccessSession` ne fonctionne que sur un appareil supervisé (MDM) ;
 *   on guide donc vers l'Accès guidé (triple-clic) et une Concentration iOS.
 * - Android : épinglage d'écran (`startLockTask`, confirmation système). Le module natif
 *   optionnel « FocusLock » (native/focus-lock, non activé) est utilisé s'il est présent ;
 *   sinon, on guide vers Paramètres › Sécurité › Épinglage d'application.
 */
import { requireOptionalNativeModule } from 'expo';
import { Linking, Platform } from 'react-native';

type FocusLockNative = { start: () => Promise<boolean>; stop: () => Promise<boolean>; isPinned: () => boolean };
const native = Platform.OS === 'android' ? requireOptionalNativeModule<FocusLockNative>('FocusLock') : null;

/** Vrai seulement si le module natif Android a été activé et l'app recompilée. */
export const canPinNatively = () => native != null;

export async function pinApp(): Promise<boolean> {
  if (!native) return false;
  try {
    return await native.start();
  } catch {
    return false;
  }
}
export function unpinApp() {
  if (!native) return;
  void native.stop().catch(() => {});
}

/** Ouvre les réglages les plus proches de l'étape : Sécurité (Android), page de l'app dans Réglages (iOS). */
export async function openLockSettings() {
  try {
    if (Platform.OS === 'android') {
      await Linking.sendIntent('android.settings.SECURITY_SETTINGS');
      return;
    }
    await Linking.openSettings();
  } catch {
    try {
      await Linking.openSettings();
    } catch {
      /* rien à ouvrir sur cette plateforme */
    }
  }
}
