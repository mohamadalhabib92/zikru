import { router, Stack } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '@/lib/community/auth';
import { Muted, Screen, Spacer } from '@/ui/kit';
import { brand as b } from '@/ui/theme';
import { L } from '@/lib/l10n';

/**
 * Retour du lien magique (PWA : …/zikru/auth-callback?code=… ; natif : zikru://auth-callback?code=…).
 * L'échange du code est fait par le client Supabase (web) ou par AuthProvider (natif) ;
 * cet écran attend la session puis renvoie vers Communauté, ou vers la connexion en cas d'échec.
 */
export default function AuthCallback() {
  const auth = useAuth();
  useEffect(() => {
    if (auth.session) {
      router.replace('/community');
      return;
    }
    if (auth.linkError || !auth.enabled) {
      router.replace('/auth');
      return;
    }
    if (!auth.ready) return;
    // Pas de session après l'échange : lien déjà utilisé, ouvert ailleurs, ou sans code.
    const id = setTimeout(() => router.replace('/auth'), 6000);
    return () => clearTimeout(id);
  }, [auth.session, auth.linkError, auth.ready, auth.enabled]);
  return (
    <Screen>
      <Stack.Screen options={{ title: L('Connexion') }} />
      <View style={{ alignItems: 'center', paddingTop: 48 }}>
        <ActivityIndicator color={b.green} />
        <Spacer />
        <Muted>Connexion en cours…</Muted>
      </View>
    </Screen>
  );
}
