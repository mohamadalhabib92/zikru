import { useEffect, useState } from 'react';
import { ring } from '@/lib/ring';
import { useData } from '@/lib/data';
import { useSettings } from '@/lib/settings';
import { Badge, Body, Button, Card, H1, Muted, Notice, Row, Screen, Spacer } from '@/ui/kit';

export default function RingScreen() {
  const { t: tr } = useSettings();
  const { tasbih } = useData();
  const [connected, setConnected] = useState(ring.isConnected);
  const [battery, setBattery] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => ring.subscribe((e) => e.type === 'status' && setConnected(e.connected)), []);
  useEffect(() => {
    void ring.battery().then(setBattery);
  }, [connected]);
  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between' }}>
        <H1>{tr.ring}</H1>
        <Badge label={tr.simulation} tone="warning" />
      </Row>
      <Notice tone="warning" title="Mock / hardware non connecté" text="Aucun anneau réel n’est appairé. Cet écran simule l’API RingService (connexion, batterie, appuis) pour préparer l’intégration BLE." icon="flask-outline" />
      <Spacer />
      <Card>
        <Body>État : {connected ? 'Connecté (simulation)' : 'Déconnecté'}</Body>
        <Muted>Batterie : {battery == null ? '—' : `${battery} % (simulée)`}</Muted>
        <Muted>Compteur tasbih : {tasbih.count}</Muted>
        <Spacer />
        {connected ? (
          <>
            <Button title="Simuler un appui (+1)" icon="finger-print-outline" onPress={() => ring.simulateTap()} />
            <Spacer h={8} />
            <Button title="Déconnecter" variant="ghost" onPress={() => void ring.disconnect()} />
          </>
        ) : (
          <Button
            title="Connecter (simulation)"
            icon="bluetooth-outline"
            loading={busy}
            onPress={async () => {
              setBusy(true);
              await ring.connect();
              setBusy(false);
            }}
          />
        )}
      </Card>
    </Screen>
  );
}
