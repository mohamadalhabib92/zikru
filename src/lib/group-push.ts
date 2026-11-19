/**
 * Notifications push des messages de groupe (Passe 6) — version web / PWA : non disponible.
 * La PWA garde la relève de la discussion à l'écran ; aucun jeton n'est créé sur le web.
 * La version iOS/Android est dans group-push.native.ts, derrière le drapeau EXPO_PUBLIC_GROUP_PUSH=1.
 */
export const groupPushAvailable = () => false;
export async function groupPushEnabled(): Promise<boolean> {
  return false;
}
export async function enableGroupPush(_lang: string): Promise<'ok' | 'denied' | 'unavailable'> {
  return 'unavailable';
}
export async function disableGroupPush(): Promise<void> {}
export async function refreshGroupPush(): Promise<void> {}
