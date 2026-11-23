import { router, Stack, usePathname } from 'expo-router';
import { Component, useEffect, type ReactNode } from 'react';
import { BackHandler, Platform, View } from 'react-native';
import { TvButton, TvRow } from '@/components/tv/ui';
import { L } from '@/lib/l10n';
import { Text } from '@/ui/Text';
import { createTvMenuGate, subscribeTvMenu, syncTvMenuKey, tvMenuCaptures } from '@/lib/tv-surface';

export function ErrorBoundary({ error, retry }: { error: Error; retry: () => Promise<void> }) {
  return <TvRecovery message={error?.message} onRetry={() => void retry()} />;
}

export function TvRecovery({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <View style={{ flex: 1, backgroundColor: '#10211C', paddingHorizontal: 90, paddingTop: 80 }}>
      <Text style={{ color: '#F4F1EA', fontSize: 48, fontWeight: '800' }}>{L('Zikru a été interrompu')}</Text>
      <Text style={{ color: '#F4F1EA', fontSize: 30, lineHeight: 42, marginTop: 16 }}>{message || L('Une erreur est survenue. Vous pouvez réessayer ou revenir à l’accueil.')}</Text>
      <TvRow>
        {onRetry ? <TvButton preferred label={L('Réessayer')} onPress={onRetry} /> : null}
        <TvButton preferred={!onRetry} label={L('Retour')} onPress={() => router.replace('/tv')} />
      </TvRow>
    </View>
  );
}

function TvMenuBack() {
  const path = usePathname();
  useEffect(() => {
    if (!Platform.isTV) return;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const tv = require('react-native') as {
      TVEventControl?: { enableTVMenuKey?: () => void; disableTVMenuKey?: () => void };
      TVEventHandler?: unknown;
    };
    // Accueil `/tv` : Menu reste au système (sortie vers l’écran d’accueil tvOS).
    // Écran imbriqué : on capture Menu pour revenir en arrière. Sur react-native-tvos 0.87, TVEventHandler est un objet addListener, pas une classe.
    const capture = tvMenuCaptures(path);
    syncTvMenuKey(tv.TVEventControl, capture);
    if (!capture) return () => syncTvMenuKey(tv.TVEventControl, false);
    const go = createTvMenuGate(() => router.back());
    const menu = subscribeTvMenu(tv.TVEventHandler, () => {
      if (router.canGoBack()) go(true);
    });
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!router.canGoBack()) return false;
      go(true);
      return true;
    });
    return () => {
      menu.remove();
      back.remove();
      syncTvMenuKey(tv.TVEventControl, false);
    };
  }, [path]);
  return null;
}

class TvBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) return <TvRecovery message={this.state.error.message} onRetry={() => this.setState({ error: null })} />;
    return this.props.children;
  }
}

export default function TvLayout() {
  return (
    <TvBoundary>
      <TvMenuBack />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }} />
    </TvBoundary>
  );
}
