import { Linking } from 'react-native';
import { L } from '@/lib/l10n';
import { Button, Card, H1, Muted, Screen, Spacer } from '@/ui/kit';

const EULA = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';

export default function TermsScreen() {
  return (
    <Screen>
      <H1>{L('Conditions d’utilisation de Zikru Premium')}</H1>
      <Card>
        <Muted>{L('Zikru Premium est un achat intégré unique, à vie, traité par Apple. Zikru ne reçoit pas votre carte bancaire.')}</Muted>
        <Spacer />
        <Muted>{L('Il débloque seulement la création de zikrs personnels et la création de groupes. Le reste de l’application reste gratuit.')}</Muted>
        <Spacer />
        <Muted>{L('Vous pouvez restaurer cet achat sur vos appareils avec le même compte Apple, depuis l’écran Premium.')}</Muted>
        <Spacer />
        <Muted>{L('Le contrat de licence standard d’Apple s’applique à l’application.')}</Muted>
        <Spacer />
        <Muted>{L('Éditeur : Mohamed El Habib Ba, Chemin de la Suettaz 17, 1008 Prilly, Suisse.')}</Muted>
      </Card>
      <Spacer />
      <Button title={L('Contrat Apple (EULA)')} icon="open-outline" variant="secondary" onPress={() => void Linking.openURL(EULA)} />
    </Screen>
  );
}
