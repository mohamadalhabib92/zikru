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
