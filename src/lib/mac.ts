/**
 * iOS app sur Mac (« Designed for iPad »), sans deuxième projet.
 * Le drapeau natif vient de ProcessInfo.isiOSAppOnMac. Tant qu’il n’est pas connu, on ne devine pas :
 * un iPad a le même idiom « pad », et l’iPhone ne doit pas changer de comportement.
 */

let known: boolean | null = null;

export function setIosAppOnMac(value: boolean) {
  known = value;
}

export function isIosAppOnMac(): boolean {
  return known === true;
}

type NktubEnv = { os: string; isPad: boolean; mac?: boolean };
type PadPlatform = { OS: string; isPad?: boolean };

/**
 * Nktub (نكتب) : écrire de mémoire, seulement sur iPad.
 * Vrai uniquement si Platform.OS === 'ios' && Platform.isPad && !isIosAppOnMac().
 * L’iPhone n’est pas un iPad. Le Mac « Designed for iPad » a isPad, et isIosAppOnMac() le retire.
 * tvOS a l’idiome « tv », donc isPad est faux.
 * `env` sert aux tests Node, qui ne chargent pas Platform.
 */
export function nktubAvailable(env?: NktubEnv): boolean {
  const mac = env && 'mac' in env ? env.mac === true : isIosAppOnMac();
  if (env) return env.os === 'ios' && env.isPad === true && !mac;
  const live = readNktubPlatform();
  return live.os === 'ios' && live.isPad === true && !mac;
}

function readNktubPlatform(): { os: string; isPad: boolean } {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Platform } = require('react-native') as { Platform: PadPlatform };
    return { os: Platform.OS, isPad: (Platform as { isPad?: boolean }).isPad === true };
  } catch {
    return { os: 'unknown', isPad: false };
  }
}

/** Largeur à partir de laquelle les onglets passent à gauche. L’iPhone reste en bas. */
export const SIDEBAR_MIN_PHONE = 1024;
export const SIDEBAR_MIN_MAC = 900;
/** Colonne de contenu : ni étirée sur une grande fenêtre, ni plus étroite que l’iPhone. */
export const CONTENT_MAX = 1040;

export function sidebarMin(mac: boolean): number {
  return mac ? SIDEBAR_MIN_MAC : SIDEBAR_MIN_PHONE;
}

export function shouldUseSidebar(windowWidth: number, mac: boolean): boolean {
  return windowWidth >= sidebarMin(mac);
}

/** Ce qui n’existe pas, ou se comporte mal, quand l’app iOS tourne sur un Mac. */
export function macLimits(mac: boolean) {
  return {
    haptics: !mac,
    watch: !mac,
    widgets: !mac,
    liveActivity: !mac,
    camera: !mac,
    remotePush: !mac,
    /** La boussole et le magnétomètre ne sont pas là. L’angle de la qibla reste affiché. */
    compass: !mac,
  };
}
