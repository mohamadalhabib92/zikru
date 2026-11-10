import { router } from 'expo-router';
import { useState } from 'react';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import { confirmAsk, useLoad } from '@/components/community/parts';
import * as api from '@/lib/community/api';
import { L } from '@/lib/l10n';
import { Button, Card, H2, Muted, Spacer } from '@/ui/kit';
import { theme as t } from '@/ui/theme';

/** Demandes d’entrée et suppression du groupe. Réservé à l’administrateur (parent ou fondateur). */
export function GroupAdminTools({ scope, scopeId }: { scope: api.ScopeType; scopeId: string }) {
  const pending = useLoad(() => api.listJoinRequests(scope, scopeId), [scope, scopeId]);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const link = Linking.createURL('/join', { queryParams: { ask: scope, gid: scopeId } });
  const decide = async (id: string, approve: boolean) => {
    setErr(null);
    try {
      await api.reviewJoinRequest(id, approve);
      await pending.reload();
    } catch (e) {
      setErr(api.frError(e));
    }
  };
  return (
    <Card>
      <H2>{L('Demandes pour rejoindre')}</H2>
      {pending.data && !pending.data.length ? <Muted>{L('Aucune demande en attente.')}</Muted> : null}
      {pending.data?.map((r) => (
        <Card key={r.id}>
          <Muted>{r.display_name}</Muted>
          {r.message ? <Muted>{r.message}</Muted> : null}
          <Button small title={L('Accepter')} onPress={() => void decide(r.id, true)} />
          <Button small variant="ghost" title={L('Refuser')} onPress={() => void decide(r.id, false)} />
        </Card>
      ))}
      <Button
        small
        variant="secondary"
        icon="link-outline"
        title={copied ? L('Lien copié.') : L('Copier le lien de demande')}
        onPress={() =>
          void Clipboard.setStringAsync(link).then(() => {
            setCopied(true);
          })
        }
      />
      {err ? <Muted style={{ color: t.danger }}>{err}</Muted> : null}
      <Spacer />
      <Button
        variant="danger"
        icon="trash-outline"
        title={L('Supprimer le groupe')}
        onPress={() =>
          confirmAsk('Supprimer ce groupe ?', 'Les membres quittent ce groupe. Leurs zikrs personnels et les compteurs de leurs autres objectifs ne sont pas effacés.', 'Supprimer le groupe', () =>
            void api
              .deleteGroup(scope, scopeId)
              .then(() => router.back())
              .catch((e) => setErr(api.frError(e))),
          )
        }
      />
    </Card>
  );
}
