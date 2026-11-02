import { Component, useEffect, type ErrorInfo, type ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { reportError } from '@/lib/crash-report';
import { L } from '@/lib/l10n';
import { noteAppError } from '@/lib/review-store';
import { Text } from '@/ui/Text';

// Filet de sécurité : une erreur JavaScript affiche un écran explicatif au lieu de fermer l'app.
// Racine : AppErrorBoundary + ErrorBoundary de src/app/_layout.tsx ; onglets : TabErrorBoundary
// (exporté par chaque écran de src/app/(tabs)) pour que la barre d'onglets reste utilisable.
type Props = { children: ReactNode };
type State = { error: Error | null };

export function ErrorScreen({ error, retry, inTab }: { error: Error; retry: () => void; inTab?: boolean }) {
  return (
    <View style={{ flex: 1, backgroundColor: '#0E1A17', padding: 24, paddingTop: inTab ? 32 : 72 }}>
      <Text accessibilityRole="header" style={{ color: '#F2EBDD', fontSize: 22, fontWeight: '700', marginBottom: 8 }}>
        {inTab ? L('Cet onglet a rencontré une erreur') : L('Zikru a rencontré une erreur')}
      </Text>
      <Text style={{ color: '#B8C4BE', fontSize: 15, marginBottom: 16 }}>
        {inTab
          ? L('Vos données restent sur l’appareil. Les autres onglets fonctionnent toujours. Touchez « Réessayer » ; si l’erreur persiste, faites une capture de cet écran.')
          : L("Vos données restent sur l'appareil. Touchez « Réessayer » ; si l'erreur persiste, faites une capture de cet écran.")}
      </Text>
      <ScrollView style={{ flex: 1, backgroundColor: '#15241F', borderRadius: 12, padding: 12, marginBottom: 16 }}>
        <Text selectable style={{ color: '#E8B36B', fontFamily: 'Menlo', fontSize: 12 }}>
          {String(error?.name ?? 'Error')}: {String(error?.message ?? error)}
          {'\n\n'}
          {String(error?.stack ?? '').split('\n').slice(0, 12).join('\n')}
        </Text>
      </ScrollView>
      <Pressable
        onPress={retry}
        accessibilityRole="button"
        style={{ backgroundColor: '#2E7D5B', borderRadius: 12, padding: 14, alignItems: 'center', minHeight: 48 }}
      >
        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>{L('Réessayer')}</Text>
      </Pressable>
    </View>
  );
}

/** ErrorBoundary Expo Router d'un onglet : l'erreur reste confinée à l'onglet (signalée localement). */
export function TabErrorBoundary({ error, retry }: { error: Error; retry: () => Promise<void> }) {
  useEffect(() => {
    reportError(error, { where: 'onglet' });
    noteAppError();
  }, [error]);
  return <ErrorScreen inTab error={error} retry={() => void retry()} />;
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };
  static getDerivedStateFromError(error: Error): State {
    return { error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    noteAppError();
    reportError(error, { where: 'racine' + (info?.componentStack ? ' ' + info.componentStack.split('\n').slice(0, 3).join(' ').trim() : '') });
  }
  render() {
    if (this.state.error) return <ErrorScreen error={this.state.error} retry={() => this.setState({ error: null })} />;
    return this.props.children;
  }
}
