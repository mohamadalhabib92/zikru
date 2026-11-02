import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Platform } from 'react-native';
import { tasbihCsv } from '@/lib/csv';
import { useData } from '@/lib/data';
import { downloadText } from '@/lib/download';
import { disableGroupPush, enableGroupPush, groupPushAvailable, groupPushEnabled } from '@/lib/group-push';
import { useAuth } from '@/lib/community/auth';
import { isPlatformModerator, moderationBackend } from '@/lib/community/moderation-api';
import { exportAll } from '@/lib/storage';
import { Card, Divider, ListItem, Notice, Toggle } from '@/ui/kit';
import { L } from '@/lib/l10n';

/** Passe 6 — export local : tout ce que Zikru enregistre sur CET appareil, en un fichier JSON. Rien n'est envoyé. */
export function DataExportItem() {
  const [busy, setBusy] = useState(false);
  return (
    <ListItem
      title="Exporter mes données (fichier JSON)"
      subtitle={busy ? L('Préparation…') : L('Tout ce qui est enregistré sur cet appareil. Rien n’est envoyé.')}
      icon="download-outline"
      onPress={async () => {
        if (busy) return;
        setBusy(true);
        try {
          const data = await exportAll();
          const day = new Date().toISOString().slice(0, 10);
          const file = { app: 'Zikru', format: 1, exported_at: new Date().toISOString(), note: L('Données de cet appareil uniquement (pas celles du serveur).'), data };
          await downloadText('zikru-export-' + day + '.json', JSON.stringify(file, null, 2), 'application/json;charset=utf-8');
        } catch (e) {
          const m = e instanceof Error ? e.message : String(e);
          if (Platform.OS === 'web') window.alert(m);
          else Alert.alert(L('Export impossible'), m);
        } finally {
          setBusy(false);
        }
      }}
    />
  );
}

/** v2 — Historique du tasbih en CSV (tableur). Fichier local, rien n'est envoyé. */
export function TasbihCsvItem() {
  const { tasbih } = useData();
  return (
    <ListItem
      title={L('Exporter l’historique du tasbih (CSV)')}
      subtitle={L('{n} sessions · pour un tableur. Rien n’est envoyé.', { n: tasbih.sessions.length })}
      icon="grid-outline"
      onPress={async () => {
        try {
          const day = new Date().toISOString().slice(0, 10);
          await downloadText('zikru-tasbih-' + day + '.csv', tasbihCsv(tasbih.sessions), 'text/csv;charset=utf-8');
        } catch (e) {
          const m = e instanceof Error ? e.message : String(e);
          if (Platform.OS === 'web') window.alert(m);
          else Alert.alert(L('Export impossible'), m);
        }
      }}
    />
  );
}

/** Lien vers la file de modération : affiché seulement pour le rôle serveur « moderator » / « admin ». */
export function ModerationLink() {
  const auth = useAuth();
  const router = useRouter();
  const [show, setShow] = useState(false);
  const be = moderationBackend();
  const signedIn = be.demo || (auth.enabled && !!auth.session);
  useEffect(() => {
    if (!signedIn) return;
    let alive = true;
    be.roles()
      .then((r) => alive && setShow(isPlatformModerator(r)))
      .catch(() => alive && setShow(false));
    return () => {
      alive = false;
    };
  }, [be, signedIn, auth.userId]);
  if (!show || !signedIn) return null;
  return (
    <>
      <Divider />
      <ListItem title="Modération" subtitle="File des signalements (équipe)" icon="flag-outline" onPress={() => router.push('/moderation')} />
    </>
  );
}

/** Notifications des discussions de groupe (natif seulement, derrière EXPO_PUBLIC_GROUP_PUSH=1, connecté). */
export function GroupPushToggle({ lang }: { lang: string }) {
  const auth = useAuth();
  const [on, setOn] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    void groupPushEnabled().then(setOn);
  }, []);
  if (!groupPushAvailable() || !auth.session) return null;
  return (
    <Card>
      <Toggle
        label="Nouveaux messages de mes groupes"
        hint="Notification avec le nom du groupe seulement, jamais le texte du message. Les groupes en sourdine ne notifient pas."
        value={on}
        onChange={async (v) => {
          setMsg(null);
          try {
            if (!v) {
              await disableGroupPush();
              setOn(false);
              return;
            }
            const r = await enableGroupPush(lang);
            setOn(r === 'ok');
            if (r === 'denied') setMsg(L('Notifications refusées : autorisez-les dans les Réglages du téléphone.'));
            if (r === 'unavailable') setMsg(L('Notifications indisponibles sur cet appareil.'));
          } catch (e) {
            setMsg(e instanceof Error ? e.message : String(e));
          }
        }}
      />
      {msg ? <Notice tone="warning" title={msg} /> : null}
    </Card>
  );
}
