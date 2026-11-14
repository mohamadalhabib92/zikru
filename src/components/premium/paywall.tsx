/**
 * Mur d’achat pour une fonction Premium. Restaurer interroge le compte du magasin, sans quitter l’écran.
 */
import { useState } from 'react';
import { router } from 'expo-router';
import { usePremium } from '@/lib/premium';
import { Button, Card, Muted, Spacer } from '@/ui/kit';
import { Text } from '@/ui/Text';
import { theme as t } from '@/ui/theme';

export function PremiumPaywall({ title, text }: { title: string; text: string }) {
  const p = usePremium();
  const [restored, setRestored] = useState<boolean | null>(null);
  return (
    <Card>
      <Text style={{ color: t.text, fontWeight: '700', fontSize: 18 }}>{title}</Text>
      <Muted>{text}</Muted>
      <Spacer h={8} />
      <Button title="Zikru Premium" icon="star-outline" onPress={() => router.push('/premium')} />
      <Button
        title="Restaurer les achats"
        variant="secondary"
        icon="refresh-outline"
        loading={p.phase === 'pending'}
        onPress={() => void p.restore().then(setRestored)}
      />
      {restored === true ? <Muted>Restauration terminée.</Muted> : null}
      {restored === false && p.phase !== 'offline' ? <Muted>Aucun achat Premium à restaurer pour ce compte Apple.</Muted> : null}
    </Card>
  );
}
