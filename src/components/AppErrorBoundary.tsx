import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Text } from '@/ui/Text';

// Filet de sécurité : une erreur JavaScript affiche un écran explicatif au lieu de fermer l'app.
type Props = { children: ReactNode };
type State = { error: Error | null };

export function ErrorScreen({ error, retry }: { error: Error; retry: () => void }) {
  return (
    <View style={{ flex: 1, backgroundColor: '#0E1A17', padding: 24, paddingTop: 72 }}>
      <Text style={{ color: '#F2EBDD', fontSize: 22, fontWeight: '700', marginBottom: 8 }}>
        Zikru a rencontré une erreur
      </Text>
      <Text style={{ color: '#B8C4BE', fontSize: 15, marginBottom: 16 }}>
        Vos données restent sur l'appareil. Touchez « Réessayer » ; si l'erreur persiste, faites une capture de cet écran.
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
        style={{ backgroundColor: '#2E7D5B', borderRadius: 12, padding: 14, alignItems: 'center' }}
      >
        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Réessayer</Text>
      </Pressable>
    </View>
  );
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };
  static getDerivedStateFromError(error: Error): State {
    return { error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[Zikru] erreur interceptée', error, info?.componentStack);
  }
  render() {
    if (this.state.error) return <ErrorScreen error={this.state.error} retry={() => this.setState({ error: null })} />;
    return this.props.children;
  }
}
