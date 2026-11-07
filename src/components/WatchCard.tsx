import { L } from '@/lib/l10n';
import { useWatchLink } from '@/lib/watch-sync';
import { H2, Muted, Spacer } from '@/ui/kit';

/** État du compagnon watchOS. Les heures partent toutes seules ; rien à saisir ici. */
export function WatchCard() {
  const link = useWatchLink();
  const line = !link.supported
    ? L('Le compagnon montre est dans le build iOS. Il n’est pas dans Expo Go ni sur Android.')
    : link.paired && link.installed
      ? L('Montre jumelée, application installée.')
      : link.paired
        ? L('Montre jumelée : installez Zikru depuis l’application iPhone.')
        : L('Aucune montre jumelée à cet iPhone.');
  return (
    <>
      <Spacer h={20} />
      <H2>{L('Montre Apple')}</H2>
      <Muted>{L('Les horaires de cet iPhone (même lieu, même méthode) et le compteur partent vers la montre. L’adhan y est un signal court, pas la voix complète.')}</Muted>
      <Muted>{line}</Muted>
      {link.received === 1 ? <Muted>{L('{n} appui reçu de la montre', { n: 1 })}</Muted> : null}
      {link.received > 1 ? <Muted>{L('{n} appuis reçus de la montre', { n: link.received })}</Muted> : null}
    </>
  );
}
