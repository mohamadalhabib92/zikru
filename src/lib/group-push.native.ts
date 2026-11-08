/**
 * Notifications push des messages de groupe (Passe 6) — iOS/Android.
 * DERRIÈRE UN DRAPEAU : inactif tant que EXPO_PUBLIC_GROUP_PUSH n'est pas « 1 » au build. Demande un NOUVEAU build
 * natif (clé APNs / FCM dans les identifiants EAS) et les migrations passe 5 + passe 6 appliquées — rien de cela
 * n'est fait : accord explicite de Mohamed nécessaire.
 *
 * Fonctionnement : l'utilisateur active l'interrupteur → autorisation système → jeton Expo enregistré sur le serveur
 * (register_push_token). Le serveur n'envoie que « Nouveau message » + le nom du groupe, jamais le texte.
 * Désactiver retire le jeton du serveur. Le toucher d'une notification ouvre la discussion (data.url, géré par
 * l'écouteur de reminders.native.ts).
 */
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { loadJSON, saveJSON } from './storage';
import { getSupabase } from './supabase';

const KEY = 'group-push';
type Saved = { on: boolean; token: string | null; lang?: string };

export const groupPushAvailable = () => process.env.EXPO_PUBLIC_GROUP_PUSH === '1' && (Platform.OS === 'ios' || Platform.OS === 'android');

export async function groupPushEnabled(): Promise<boolean> {
  if (!groupPushAvailable()) return false;
  return (await loadJSON<Saved>(KEY, { on: false, token: null })).on;
}

async function token(): Promise<string | null> {
  const projectId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return null;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('groups', { name: 'Discussions de groupe', importance: 5 /* AndroidImportance.DEFAULT (enum expo-notifications) */ as Notifications.NotificationChannelInput['importance'], sound: 'default' });
  }
  return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
}

async function register(t: string, lang: string) {
  const c = await getSupabase();
  if (!c) throw new Error('Serveur non configuré.');
  const { error } = await c.rpc('register_push_token', { p_token: t, p_platform: Platform.OS, p_lang: lang });
  if (error) throw new Error(error.message);
}

export async function enableGroupPush(lang: string): Promise<'ok' | 'denied' | 'unavailable'> {
  if (!groupPushAvailable()) return 'unavailable';
  const cur = await Notifications.getPermissionsAsync();
  const ok = cur.granted || (cur.canAskAgain && (await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: true, allowBadge: false } })).granted);
  if (!ok) return 'denied';
  const t = await token();
  if (!t) return 'unavailable';
  await register(t, lang);
  await saveJSON<Saved>(KEY, { on: true, token: t, lang });
  return 'ok';
}

export async function disableGroupPush(): Promise<void> {
  const s = await loadJSON<Saved>(KEY, { on: false, token: null });
  await saveJSON<Saved>(KEY, { on: false, token: null });
  if (!s.token) return;
  try {
    const c = await getSupabase();
    await c?.rpc('unregister_push_token', { p_token: s.token });
  } catch {
    // hors ligne : le jeton sera purgé côté serveur après 90 jours sans renouvellement
  }
}

/** À l'ouverture (connecté) : renouvelle le jeton si activé (il peut changer ; garde last_seen_at à jour). */
export async function refreshGroupPush(): Promise<void> {
  if (!groupPushAvailable()) return;
  const s = await loadJSON<Saved>(KEY, { on: false, token: null });
  if (!s.on) return;
  try {
    const t = await token();
    if (!t) return;
    await register(t, s.lang ?? 'fr');
    await saveJSON<Saved>(KEY, { ...s, token: t });
  } catch {
    // réessayé à la prochaine ouverture
  }
}
