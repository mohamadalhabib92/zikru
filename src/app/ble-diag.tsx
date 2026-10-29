/**
 * Diagnostic Bluetooth : état de l'adaptateur, scan avec RSSI (avec / sans filtre de service),
 * services et caractéristiques de la dernière liaison, dernière erreur et journal copiable.
 * Rien n'est envoyé : le journal reste en mémoire et n'est partagé que par « Copier ».
 */
import Constants from 'expo-constants';
import * as Clipboard from 'expo-clipboard';
import { useEffect, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import appJson from '../../app.json';
import { servicesToRequest, profileById, shortUuid } from '@/lib/ble/core';
import { diag } from '@/lib/ble/diag';
import { bleCounter, useBleCounter } from '@/lib/ble/manager';
import { transport } from '@/lib/ble/transport';
import { Badge, Body, Button, Card, Eyebrow, H2, Muted, Notice, Row, Screen, Spacer } from '@/ui/kit';
import { theme as t } from '@/ui/theme';

const mono = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });

function useDiag() {
  const [snap, setSnap] = useState(() => diag.snapshot());
  useEffect(() => diag.subscribe(() => setSnap(diag.snapshot())), []);
  return snap;
}

export default function BleDiagScreen() {
  const s = useBleCounter();
  const d = useDiag();
  const [raw, setRaw] = useState<string>('…');
  const [copied, setCopied] = useState(false);
  const web = Platform.OS === 'web';
  const version = `${Constants.nativeAppVersion ?? appJson.expo.version}${Constants.nativeBuildVersion ? ` (${Constants.nativeBuildVersion})` : ''}`;
  const os = web
    ? `web · ${typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 120) : '?'}`
    : `${Platform.OS} ${String(Platform.Version ?? '')}${Platform.OS === 'ios' && (Platform as { isPad?: boolean }).isPad ? ' · iPad' : ''}`;

  const refresh = async () => {
    setRaw(transport.rawState ? await transport.rawState().catch((e: unknown) => String(e)) : web ? 'Web Bluetooth' : '—');
    await bleCounter.refreshAvailability();
  };
  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const header = {
    App: `Zikru ${version}`,
    Système: os,
    Transport: transport.platform,
    'État adaptateur': raw,
    Disponibilité: s.availability ? (s.availability.ok ? 'OK' : `${s.availability.kind} — ${s.availability.reason}`) : '—',
    Statut: s.status,
    Reconnexion: `${s.auto}${s.autoTarget ? ` (${s.autoTarget})` : ''}`,
    Profil: s.prefs.profileId,
    Appareil: s.device ? `${s.device.name ?? '(sans nom)'} ${s.device.id}` : '—',
    Mémorisés: s.devices.length,
    'Erreur affichée': s.error,
  };
  const copy = async () => {
    await Clipboard.setStringAsync(diag.text(header));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const known = servicesToRequest(profileById('auto'), []);

  return (
    <Screen>
      <Muted>Pour comprendre une connexion qui échoue : lancez un scan, connectez l’appareil depuis l’écran Compteur Bluetooth, puis copiez le journal et joignez-le à votre demande d’aide. Aucune donnée n’est envoyée automatiquement.</Muted>
      <Spacer />
      <Card>
        <Eyebrow>État</Eyebrow>
        {Object.entries(header).map(([k, v]) => (
          <Row key={k} style={{ alignItems: 'flex-start' }}>
            <Text style={{ color: t.muted, fontSize: 13, width: 120 }}>{k}</Text>
            <Text style={{ color: t.text, fontSize: 13, flex: 1, flexShrink: 1 }} selectable>
              {v == null || v === '' ? '—' : String(v)}
            </Text>
          </Row>
        ))}
        <Spacer h={8} />
        <Row wrap>
          <Button title="Actualiser" icon="refresh" small variant="ghost" onPress={() => void refresh()} />
          <Button title={copied ? 'Copié' : 'Copier le journal'} icon={copied ? 'checkmark' : 'copy-outline'} small onPress={() => void copy()} />
        </Row>
      </Card>

      {d.lastError ? (
        <Notice tone="danger" title={`Dernière erreur · ${new Date(d.lastError.t).toLocaleTimeString()}`} text={`[${d.lastError.tag}] ${d.lastError.msg}`} />
      ) : (
        <Notice tone="success" title="Aucune erreur enregistrée" text="Depuis l’ouverture de l’app." />
      )}

      <H2>Scan</H2>
      {web ? (
        <Muted>Web : le navigateur affiche son propre sélecteur (pas de RSSI) ; les appareils choisis apparaissent ci-dessous.</Muted>
      ) : (
        <>
          <Muted>Sans filtre : tous les appareils BLE (recommandé, la plupart des anneaux n’annoncent pas leur service). Avec filtre : seulement les services connus ({known.map(shortUuid).join(', ')}).</Muted>
          <Spacer h={8} />
          <Row wrap>
            <Button
              title={s.scanning ? 'Scan en cours…' : 'Scanner (sans filtre)'}
              icon="search-outline"
              small
              loading={s.scanning}
              onPress={() => {
                diag.clearSeen();
                void bleCounter.startScan({ ms: 20000 });
              }}
            />
            <Button
              title="Scanner (services connus)"
              icon="funnel-outline"
              small
              variant="ghost"
              disabled={s.scanning}
              onPress={() => {
                diag.clearSeen();
                void bleCounter.startScan({ services: known, ms: 20000 });
              }}
            />
            {s.scanning ? <Button title="Arrêter" small variant="ghost" onPress={() => bleCounter.stopScanning()} /> : null}
          </Row>
        </>
      )}
      <Spacer h={8} />
      {d.seen.length === 0 ? <Muted>Aucun appareil vu pour l’instant.</Muted> : null}
      {d.seen.slice(0, 40).map((x) => (
        <Card key={x.id} style={{ marginBottom: 8, padding: 12 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Body style={{ flex: 1, fontWeight: '600' }}>{x.name ?? '(sans nom)'}</Body>
            <Badge label={x.rssi != null ? `${x.rssi} dBm` : 'RSSI ?'} tone={x.rssi == null ? 'neutral' : x.rssi > -65 ? 'success' : x.rssi > -85 ? 'warning' : 'danger'} />
          </Row>
          <Text style={{ color: t.muted, fontFamily: mono, fontSize: 11 }} selectable>
            {x.id}
          </Text>
          {x.services.length ? (
            <Text style={{ color: t.muted, fontFamily: mono, fontSize: 11 }} selectable>
              {x.services.join('\n')}
            </Text>
          ) : null}
          {!web ? (
            <Row wrap style={{ marginTop: 6 }}>
              <Button title="Connecter" icon="bluetooth-outline" small variant="ghost" onPress={() => void bleCounter.connectTo(x.id)} />
            </Row>
          ) : null}
        </Card>
      ))}

      <Spacer />
      <H2>Services et caractéristiques</H2>
      {d.gatt ? (
        <Card>
          <Body style={{ fontWeight: '600' }}>
            {d.gatt.name ?? '(sans nom)'}
            {d.gatt.mtu ? ` · MTU ${d.gatt.mtu}` : ''}
          </Body>
          <Text style={{ color: t.muted, fontFamily: mono, fontSize: 11 }} selectable>
            {d.gatt.id}
          </Text>
          <Spacer h={6} />
          {[...new Set(d.gatt.chars.map((c) => c.service))].map((svc) => (
            <View key={svc} style={{ marginBottom: 8 }}>
              <Text style={{ color: t.text, fontFamily: mono, fontSize: 12, fontWeight: '700' }} selectable>
                {svc}
              </Text>
              {d.gatt!.chars
                .filter((c) => c.service === svc)
                .map((c) => (
                  <Text key={c.uuid} style={{ color: t.muted, fontFamily: mono, fontSize: 11, marginStart: 12 }} selectable>
                    {c.uuid}
                    {c.notify ? ' · notify' : ''}
                    {c.read ? ' · read' : ''}
                  </Text>
                ))}
            </View>
          ))}
          {d.gatt.chars.length === 0 ? <Muted>Aucune caractéristique accessible (web : UUID de service à déclarer).</Muted> : null}
        </Card>
      ) : (
        <Muted>Aucune liaison établie depuis l’ouverture de l’app.</Muted>
      )}

      <Spacer />
      <Row style={{ justifyContent: 'space-between' }}>
        <H2>Journal ({d.entries.length})</H2>
        <Button title="Effacer" small variant="ghost" onPress={() => diag.clear()} />
      </Row>
      <Card style={{ padding: 10 }}>
        {d.entries.length === 0 ? <Muted>Vide.</Muted> : null}
        {d.entries
          .slice(-120)
          .reverse()
          .map((e, i) => (
            <Text key={`${e.t}-${i}`} selectable style={{ fontFamily: mono, fontSize: 11, lineHeight: 16, color: e.level === 'error' ? t.danger : e.level === 'warn' ? t.warning : t.text }}>
              {new Date(e.t).toLocaleTimeString()} [{e.tag}] {e.msg}
            </Text>
          ))}
      </Card>
    </Screen>
  );
}
