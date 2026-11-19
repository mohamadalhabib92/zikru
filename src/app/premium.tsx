import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, View } from 'react-native';
import { Text } from '@/ui/Text';
import { usePremium } from '@/lib/premium';
import { L } from '@/lib/l10n';
import { Button, Card, H1, Muted, Notice, Screen, Spacer } from '@/ui/kit';

const EULA = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';

export default function PremiumScreen() {
  const p = usePremium();
  const [restored, setRestored] = useState<boolean | null>(null);
  const phaseText =
    p.phase === 'pending'
      ? L('Achat en attente d’approbation.')
      : p.phase === 'cancelled'
        ? L('Achat annulé. Aucun changement.')
        : p.phase === 'failed'
          ? L('L’achat n’a pas abouti. Réessayez quand la connexion sera revenue. Votre droit déjà vérifié reste en place hors ligne.')
          : p.phase === 'offline'
            ? L('L’achat n’a pas abouti. Réessayez quand la connexion sera revenue. Votre droit déjà vérifié reste en place hors ligne.')
            : null;
  return (
    <Screen>
      <H1>{L('Zikru Premium')}</H1>
      <Muted>{L('Achat unique à vie. Ce n’est pas un abonnement : un seul paiement, sans renouvellement.')}</Muted>
      <Spacer />
      {p.canCreate ? <Notice tone="success" title={L('Zikru Premium')} text={L('Premium est actif sur cet appareil.')} /> : null}
      <Card>
        <Text style={{ fontWeight: '800' }}>{L('Ce qui est inclus')}</Text>
        <Muted>{L('Créer vos propres zikrs, avec vos objectifs et vos répétitions.')}</Muted>
        <Muted>{L('Créer des groupes : familles, cercles et programmes de groupe. Vous en êtes l’administrateur.')}</Muted>
      </Card>
      <Spacer />
      <Card>
        <Text style={{ fontWeight: '800' }}>{L('Ce qui reste gratuit')}</Text>
        <Muted>{L('Le téléchargement de Zikru reste gratuit.')}</Muted>
        <Muted>{L('Rejoindre avec une invitation ou une demande acceptée reste gratuit, comme les horaires, la qibla, le Coran, l’adhan, le tasbih et les zikrs déjà inclus.')}</Muted>
      </Card>
      <Spacer />
      {p.payments ? (
        <Muted>{p.price ? p.price : L('Le prix s’affiche depuis l’App Store, dans votre devise. Il n’est pas écrit dans l’application.')}</Muted>
      ) : (
        <Notice tone="info" title={L('Zikru Premium')} text={L('Premium s’achète dans l’application iOS. Aucun paiement n’est proposé sur le web.')} />
      )}
      {phaseText ? <Muted>{phaseText}</Muted> : null}
      {restored === true ? <Muted>{L('Restauration terminée.')}</Muted> : null}
      {restored === false && p.phase !== 'offline' ? <Muted>{L('Aucun achat Premium à restaurer pour ce compte Apple.')}</Muted> : null}
      <Spacer />
      {p.payments && !p.canCreate ? (
        <Button title={p.price ? `${L('Acheter Premium')} · ${p.price}` : L('Acheter Premium')} icon="card-outline" loading={p.phase === 'pending'} onPress={() => void p.buy()} />
      ) : null}
      {p.payments ? (
        <Button
          variant="secondary"
          title={L('Restaurer les achats')}
          icon="refresh-outline"
          onPress={() => void p.restore().then(setRestored)}
        />
      ) : null}
      <Spacer />
      <View style={{ gap: 8 }}>
        <Button variant="ghost" title={L('Politique de confidentialité')} icon="shield-checkmark-outline" onPress={() => router.push('/privacy')} />
        <Button variant="ghost" title={L('Conditions d’utilisation')} icon="document-text-outline" onPress={() => router.push('/terms')} />
        <Button variant="ghost" title={L('Contrat Apple (EULA)')} icon="open-outline" onPress={() => void Linking.openURL(EULA)} />
      </View>
    </Screen>
  );
}
