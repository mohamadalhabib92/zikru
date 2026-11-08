/** Carte Ramadan (iOS/Android) : la capture en image demande un module natif absent de ce build ; l’écran partage le texte. */
export const RAMADAN_CARD_SUPPORTED = false;
export type RamadanCard = { year: number; yearLine: string; latin: string; line?: string; rtl?: boolean; brand: string };
export async function drawRamadanCard(): Promise<null> {
  return null;
}
export async function shareRamadanCard(_c: RamadanCard, _dark: boolean): Promise<'shared' | 'downloaded' | 'unsupported'> {
  return 'unsupported';
}
