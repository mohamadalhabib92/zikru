import { router, Stack } from 'expo-router';
import { Component, useEffect, type ReactNode } from 'react';
import { BackHandler, Platform } from 'react-native';
import { TvButton, TvMuted, TvRow, TvScroll, TvTitle } from '@/components/tv/ui';
import { L } from '@/lib/l10n';

export function ErrorBoundary({ error, retry }: { error: Error; retry: () => Promise<void> }) {
  return <TvRecovery message={error?.message} onRetry={() => void retry()} />;
}

export function TvRecovery({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <TvScroll>
      <TvTitle>{L('Zikru a été interrompu')}</TvTitle>
      <TvMuted>{message || L('Une erreur est survenue. Vous pouvez réessayer ou revenir à l’accueil.')}</TvMuted>
      <TvRow>
        {onRetry ? <TvButton preferred label={L('Réessayer')} onPress={onRetry} /> : null}
        <TvButton preferred={!onRetry} label={L('Accueil')} onPress={() => router.replace('/tv')} />
      </TvRow>
    </TvScroll>
  );
}

function goBackOrExit() {
  if (router.canGoBack()) {
    router.back();
    return true;
  }
  return false;
}

function TvMenuBack() {
  useEffect(() => {
    if (!Platform.isTV) return;
    type Evt = { eventType?: string };
    type Handler = { enable: (cmp: null, cb: (cmp: null, evt: Evt) => void) => void; disable: () => void };
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const tv = require('react-native') as {
      TVEventControl?: { enableTVMenuKey?: () => void; disableTVMenuKey?: () => void };
      TVEventHandler?: new () => Handler;
    };
    const control = tv.TVEventControl;
    const Ctor = tv.TVEventHandler;
    if (Ctor && control?.enableTVMenuKey) {
      control.enableTVMenuKey();
      const menu = new Ctor();
      menu.enable(null, (_cmp, evt) => {
        if (evt?.eventType !== 'menu') return;
        if (!goBackOrExit()) {
          control.disableTVMenuKey?.();
          BackHandler.exitApp();
        }
      });
      return () => {
        menu.disable();
        control.disableTVMenuKey?.();
      };
    }
    const sub = BackHandler.addEventListener('hardwareBackPress', () => goBackOrExit());
    return () => sub.remove();
  }, []);
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
