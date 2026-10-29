import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, TextInput, View } from 'react-native';
import { Text } from '@/ui/Text';
import { BleStatusChip } from '@/components/BleStatusChip';
import { bleCounter, useBleCounter } from '@/lib/ble/manager';
import { fieldLabel, isValidUuid, keyLabel, PROFILES, shortUuid } from '@/lib/ble/core';
import { bleMsg } from '@/lib/ble/messages';
import { useData } from '@/lib/data';
import { useSettings } from '@/lib/settings';
import { Badge, Body, Button, Card, Chip, Divider, Eyebrow, Field, H2, ListItem, Muted, Notice, Row, Screen, Segmented, Spacer, Toggle } from '@/ui/kit';
import { theme as t } from '@/ui/theme';
import { L, uiLang } from '@/lib/l10n';

const STATUS_TONE = { connecté: 'success', connexion: 'info', reconnexion: 'warning', déconnecté: 'neutral', erreur: 'danger' } as const;
const STATUS_HELP = {
  connecté: 'Connecté : chaque appui compte.',
  connexion: 'Connexion en cours…',
  reconnexion: 'Recherche automatique du compteur (il se reconnecte dès qu’il est allumé et à portée)…',
  déconnecté: 'Aucun appareil connecté.',
  erreur: 'Problème de connexion.',
} as const;
const mono = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });

export default function BluetoothCounterScreen() {
  const { t: tr } = useSettings();
  const { tasbih } = useData();
  const s = useBleCounter();
  const web = Platform.OS === 'web';
  const connected = s.status === 'connecté';
  const busy = s.status === 'connexion' || s.status === 'reconnexion';
  const av = s.availability;
  const custom = s.prefs.customService.trim();
  const [capture, setCapture] = useState('');
  // Ouverture de l'écran : état du Bluetooth (et autorisations Android, demandées ici seulement).
  useEffect(() => {
    void bleCounter.refreshAvailability();
  }, []);

  return (
    <Screen>
      {/* Le titre est déjà dans l'en-tête de navigation : pas de second H1 ici. */}
      <Row wrap style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <Badge label={L(s.status === 'reconnexion' ? 'recherche…' : s.status)} tone={STATUS_TONE[s.status]} />
        <Button title="Diagnostic" icon="pulse-outline" small variant="ghost" onPress={() => router.push('/ble-diag')} />
      </Row>
      <Muted>Tasbih électronique, anneau de dhikr ou télécommande : chaque appui ajoute +1 au compteur de session ({tasbih.count}{tasbih.target ? ` / ${tasbih.target}` : ''}).</Muted>
      <Muted>{STATUS_HELP[s.status]}</Muted>
      <Spacer h={8} />
      <BleStatusChip />
      <Spacer />
      {s.lastSync && Date.now() - s.lastSync.at < 10 * 60 * 1000 ? (
        <>
          <Notice tone="success" icon="sync-outline" title={L('Synchronisé : +{n}', { n: s.lastSync.added })} text="Appuis faits pendant que l’appareil était déconnecté, ajoutés une seule fois à la session et à l’historique." />
          <Spacer />
        </>
      ) : null}
      {s.similar && !connected ? (
        <>
          <Notice
            tone="warning"
            icon="help-circle-outline"
            title={L('« {n} » détecté avec un autre identifiant', { n: s.similar.name ?? L('Appareil sans nom') })}
            text={L(s.similar.by === 'nom' ? 'Même nom que votre compteur, mais identifiant différent ({id}). C’est peut-être le vôtre après une réinitialisation — ou celui de quelqu’un à côté. Zikru ne s’y connecte pas sans votre accord.' : 'Même service que votre compteur, mais identifiant différent ({id}). C’est peut-être le vôtre après une réinitialisation — ou celui de quelqu’un à côté. Zikru ne s’y connecte pas sans votre accord.', { id: `${s.similar.id}${s.similar.rssi != null ? ` · ${s.similar.rssi} dBm` : ''}` })}
          />
          <Spacer h={8} />
          <Row wrap>
            <Button title="C’est le mien" icon="checkmark-outline" onPress={() => void bleCounter.confirmSimilar()} />
            <Button title="Pas le mien" icon="close-outline" variant="ghost" onPress={() => bleCounter.rejectSimilar()} />
          </Row>
          <Spacer />
        </>
      ) : null}
      {connected && s.needsConfirm && !s.learn.active ? (
        <>
          <Notice
            tone="info"
            icon="hand-left-outline"
            title={s.mapping?.auto ? 'Compteur détecté automatiquement' : 'Appareil inconnu'}
            text={
              s.mapping?.auto
                ? L('Champ repéré : {f} sur {u}. Confirmez en appuyant 3 fois : le profil sera mémorisé pour cet appareil.', { f: s.mapping.field ? fieldLabel(s.mapping.field) : L('format connu'), u: shortUuid(s.mapping.characteristic) })
                : 'Appuyez sur « Confirmer (3 appuis) » puis 3 fois lentement sur le bouton : Zikru repère le signal et le mémorise pour cet appareil.'
            }
          />
          <Spacer h={8} />
          <Button title="Confirmer (3 appuis)" icon="school-outline" onPress={() => bleCounter.startLearn(3)} />
          <Spacer />
        </>
      ) : null}

      {av && !av.ok ? (
        <>
          <Notice
            tone={av.kind === 'disabled' ? 'info' : av.kind === 'unsupported' ? 'warning' : 'danger'}
            title={av.kind === 'expo-go' ? 'Build natif requis' : av.kind === 'disabled' ? (av.reason === bleMsg('notReady') ? 'Bluetooth pas encore prêt' : 'Bluetooth désactivé') : av.kind === 'denied' ? 'Autorisation Bluetooth requise' : 'Bluetooth indisponible'}
            text={av.kind === 'disabled' && s.devices.length && av.reason !== bleMsg('notReady') ? 'Activez le Bluetooth : vos compteurs mémorisés se reconnecteront automatiquement.' : av.reason}
            icon="bluetooth-outline"
          />
          <Spacer />
        </>
      ) : null}

      {/* -------- État de la connexion */}
      <Card>
        <Eyebrow>Appareil</Eyebrow>
        <Body>{s.device?.name ?? s.lastDevice?.name ?? (s.device || s.lastDevice ? 'Appareil sans nom' : 'Aucun appareil associé')}</Body>
        {s.device || s.lastDevice ? <Muted>ID : {(s.device ?? s.lastDevice)!.id}</Muted> : null}
        {connected ? (
          <>
            <Muted>Profil : {s.profile?.label ?? '—'}</Muted>
            <Muted>Batterie : {s.battery == null ? 'non exposée par l’appareil' : `${s.battery} %`}</Muted>
            <Muted>
              Comptage :{' '}
              {s.mapping
                ? `${s.mapping.mode === 'absolute' ? 'compteur absolu' : 'impulsions'}${s.mapping.field ? ` (${fieldLabel(s.mapping.field)})` : ''} sur ${shortUuid(s.mapping.characteristic)}${s.mapping.learnedAt ? ' · profil mémorisé' : s.mapping.auto ? ' · détecté, à confirmer' : ''}`
                : 'en attente d’appuis (détection automatique)'}
            </Muted>
            <Muted>
              Appuis reçus : {s.clicksThisConnection} · signaux : {s.notifyCount}
            </Muted>
            {s.lastHex ? <Text style={{ color: t.muted, fontFamily: mono, fontSize: 12 }}>Dernier signal : {s.lastHex}</Text> : null}
          </>
        ) : null}
        {s.error ? (
          <>
            <Spacer h={8} />
            <Text style={{ color: t.danger }}>{s.error}</Text>
          </>
        ) : null}
        <Spacer />
        {connected ? (
          <Row wrap>
            <Button title="Déconnecter" icon="close-circle-outline" variant="ghost" onPress={() => void bleCounter.disconnect()} />
            <Button title="Oublier" icon="trash-outline" variant="danger" small onPress={() => bleCounter.forget()} />
          </Row>
        ) : (
          <Row wrap>
            {web ? (
              <Button title="Rechercher un compteur" icon="bluetooth-outline" loading={busy} disabled={!!av && !av.ok} onPress={() => void bleCounter.choose()} />
            ) : (
              <Button title={s.scanning ? 'Recherche…' : 'Rechercher'} icon="search-outline" loading={s.scanning} disabled={!!av && !av.ok && av.kind !== 'disabled' && av.kind !== 'denied'} onPress={() => void bleCounter.startScan()} />
            )}
            {s.lastDevice ? <Button title="Reconnecter" icon="refresh" variant="ghost" loading={busy} onPress={() => void bleCounter.reconnect()} /> : null}
            {s.status === 'reconnexion' ? <Button title="Arrêter la recherche" variant="ghost" small onPress={() => void bleCounter.disconnect()} /> : null}
          </Row>
        )}
      </Card>

      {/* -------- Résultats du scan (natif) */}
      {!web && (s.scanning || s.scanResults.length > 0) && !connected ? (
        <>
          <Spacer />
          <H2>Appareils à proximité</H2>
          <Muted>Seuls les compteurs de dhikr (tasbih, zikr, iQibla, BW…, bague ZKR-R1) et les écouteurs sont listés ; les autres appareils Bluetooth sont ignorés. Appuyez une fois sur le bouton du compteur pour le réveiller.</Muted>
          {s.hiddenCount > 0 ? <Muted>{L('{n} appareil(s) non reconnu(s) masqué(s). Votre compteur n’apparaît pas ? Bouton « Diagnostic » › « Afficher tous les appareils ».', { n: s.hiddenCount })}</Muted> : null}
          <Spacer h={8} />
          {s.scanResults.map((r) =>
            r.kind === 'audio' ? (
              <ListItem
                key={r.id}
                title={r.name ?? 'Écouteurs'}
                subtitle={`${L('Écouteurs — gérés par le système, pas un compteur. La récitation passe par la sortie audio choisie dans les réglages du téléphone.')}${r.rssi != null ? ` · ${r.rssi} dBm` : ''}`}
                icon="headset-outline"
              />
            ) : (
              <ListItem
                key={r.id}
                title={`${r.likely ? '★ ' : ''}${r.name ?? 'Sans nom'}`}
                subtitle={`${r.likely ? `${L('Compteur ({r})', { r: r.reason })} · ` : `${L('Hors liste (mode diagnostic)')} · `}${r.id}${r.rssi != null ? ` · ${r.rssi} dBm` : ''}`}
                icon={r.likely ? 'radio-button-on-outline' : 'bluetooth-outline'}
                onPress={() => void bleCounter.connectTo(r.id)}
              />
            ),
          )}
        </>
      ) : null}

      {/* -------- Appareils mémorisés */}
      {s.devices.length > 0 ? (
        <>
          <Spacer />
          <H2>Appareils mémorisés</H2>
          <Muted>
            {web
              ? 'Chrome : reconnexion automatique dès que l’appareil émet (autorisation déjà donnée). Ailleurs : touchez « Reconnecter ».'
              : 'Reconnexion automatique, sans action : au lancement, au retour dans l’app, et dès que l’appareil revient à portée ou est rallumé — même écran verrouillé.'}
          </Muted>
          <Spacer h={8} />
          {s.devices.map((d) => {
            const isCur = s.device?.id === d.id && connected;
            return (
              <Card key={d.id} style={{ marginBottom: 8 }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Body style={{ flex: 1 }}>{d.name ?? 'Appareil sans nom'}</Body>
                  <Badge label={isCur ? 'connecté' : s.autoTarget === d.name && s.auto === 'recherche' && d.auto !== false ? 'recherche…' : 'hors connexion'} tone={isCur ? 'success' : 'neutral'} />
                </Row>
                <Muted>{d.lastSeen ? L('Vu le {d}', { d: new Date(d.lastSeen).toLocaleString(uiLang() === 'ar' ? 'ar' : uiLang() === 'en' ? 'en-GB' : 'fr-CH') }) : L('Jamais vu')}</Muted>
                <Toggle label="Reconnexion automatique" value={d.auto !== false} onChange={(v) => bleCounter.setDeviceAuto(d.id, v)} />
                <Row wrap>
                  {!isCur ? <Button title="Connecter" icon="bluetooth-outline" small variant="ghost" onPress={() => void bleCounter.reconnect(d.id)} /> : null}
                  <Button title="Oublier cet appareil" icon="trash-outline" small variant="danger" onPress={() => bleCounter.forget(d.id)} />
                </Row>
              </Card>
            );
          })}
        </>
      ) : null}

      {/* -------- Profil */}
      <Spacer />
      <H2>Type d’appareil</H2>
      <Row wrap>
        {PROFILES.map((p) => (
          <Chip key={p.id} label={p.label} active={s.prefs.profileId === p.id} onPress={() => bleCounter.setPrefs({ profileId: p.id })} />
        ))}
      </Row>
      <Muted>{PROFILES.find((p) => p.id === s.prefs.profileId)?.note}</Muted>
      {web ? (
        <>
          <Spacer h={8} />
          <Field
            label="UUID de service supplémentaire (optionnel)"
            hint="Le Bluetooth web n’accède qu’aux services déclarés. Ajoutez ici l’UUID d’un appareil non reconnu (ex. trouvé avec nRF Connect)."
            value={s.prefs.customService}
            onChangeText={(v) => bleCounter.setPrefs({ customService: v })}
            autoCapitalize="none"
            autoCorrect={false}
            error={custom && !isValidUuid(custom) ? 'UUID invalide (4 caractères hex ou format long)' : null}
          />
        </>
      ) : null}

      {/* -------- Apprentissage */}
      <Spacer />
      <H2>Mode apprentissage</H2>
      <Muted>Pour un appareil inconnu : lancez l’apprentissage, appuyez N fois lentement sur le bouton, puis validez. Zikru repère le signal qui correspond et l’enregistre pour cet appareil.</Muted>
      <Spacer h={8} />
      <Card>
        {s.learn.active ? (
          <>
            <Body>
              Appuyez {s.learn.presses} fois sur le bouton de l’appareil… ({s.learn.received} signal{s.learn.received > 1 ? 'x' : ''} reçu{s.learn.received > 1 ? 's' : ''})
            </Body>
            <Spacer h={8} />
            <Row>
              <Button title="Terminé" icon="checkmark" onPress={() => bleCounter.finishLearn()} />
              <Button title="Annuler" variant="ghost" onPress={() => bleCounter.cancelLearn()} />
            </Row>
          </>
        ) : (
          <>
            <Segmented label="Nombre d’appuis" options={[{ label: '3', value: 3 }, { label: '5', value: 5 }, { label: '10', value: 10 }]} value={s.learn.presses} onChange={(v) => bleCounter.setLearnPresses(v)} />
            <Spacer h={8} />
            <Button title="Démarrer l’apprentissage" icon="school-outline" disabled={!connected} onPress={() => bleCounter.startLearn(s.learn.presses)} />
            {!connected ? <Muted>Connectez d’abord l’appareil.</Muted> : null}
          </>
        )}
        {s.learn.result ? (
          <>
            <Spacer h={8} />
            {s.learn.result.ok ? (
              <Notice tone="success" title={L('Correspondance enregistrée (confiance {c})', { c: s.learn.result.confidence })} text={`${s.learn.result.detail} ${L('Caractéristique {u}.', { u: shortUuid(s.learn.result.mapping.characteristic) })}`} icon="checkmark-circle-outline" />
            ) : (
              <Notice tone="warning" title="Apprentissage non concluant" text={s.learn.result.reason} />
            )}
          </>
        ) : null}
      </Card>

      {/* -------- Clavier / HID */}
      <Spacer />
      <H2>Télécommande / anneau clavier (HID)</H2>
      {!web ? (
        <Card>
          <Muted>
            Associez d’abord l’anneau-télécommande ou le clavier dans Réglages › Bluetooth. Puis touchez la zone ci-dessous : tant qu’elle est active, chaque touche Entrée / Espace / flèche reçue ajoute +1.
          </Muted>
          <Toggle label="Compter les touches du clavier / de la télécommande" value={s.prefs.hidEnabled} onChange={(v) => bleCounter.setPrefs({ hidEnabled: v })} />
          <TextInput
            value={capture}
            onChangeText={(v) => {
              // caractère imprimable (ex. espace) reçu de la télécommande
              const ch = v.slice(-1);
              if (ch) bleCounter.nativeKey(ch === ' ' ? ' ' : ch);
              setCapture('');
            }}
            onKeyPress={(e) => {
              const k = e.nativeEvent.key;
              if (k && k.length > 1 && k !== 'Backspace') bleCounter.nativeKey(k);
            }}
            onSubmitEditing={() => bleCounter.nativeKey('Enter')}
            submitBehavior="submit"
            placeholder={L("Zone de capture : touchez ici, puis utilisez la télécommande")}
            placeholderTextColor={t.muted}
            autoCorrect={false}
            autoCapitalize="none"
            showSoftInputOnFocus={false}
            style={{ borderWidth: 1, borderColor: t.border, borderRadius: 12, padding: 12, color: t.text, marginTop: 8 }}
          />
          <Muted>Touches : {s.prefs.hidKeys.map((k) => L(keyLabel(k))).join(', ')}</Muted>
          {s.lastKey ? <Muted>Dernière touche reçue : {L(keyLabel(s.lastKey))}</Muted> : null}
          <Spacer h={8} />
          <Row wrap>
            <Button title={s.capturingKey ? 'Appuyez sur la télécommande…' : 'Apprendre une touche'} icon="keypad-outline" small variant="ghost" onPress={() => bleCounter.captureKey()} />
            <Button title="Touches par défaut" small variant="ghost" onPress={() => bleCounter.resetKeys()} />
          </Row>
          <Muted>iOS ne transmet pas les touches de volume aux apps : réglez la télécommande en mode Entrée/flèches si possible.</Muted>
        </Card>
      ) : s.hidSupported ? (
        <Card>
          <Muted>
            Beaucoup d’anneaux-télécommandes et de cliqueurs se connectent comme un clavier (via les réglages Bluetooth du système, pas ici). Le Bluetooth web ne peut pas les lire
            directement : Zikru écoute donc leurs touches quand l’app est au premier plan.
          </Muted>
          <Toggle label="Compter les touches du clavier / de la télécommande" value={s.prefs.hidEnabled} onChange={(v) => bleCounter.setPrefs({ hidEnabled: v })} />
          <Muted>Touches : {s.prefs.hidKeys.map((k) => L(keyLabel(k))).join(', ')}</Muted>
          {s.lastKey ? <Muted>Dernière touche reçue : {L(keyLabel(s.lastKey))}</Muted> : null}
          <Spacer h={8} />
          <Row wrap>
            <Button title={s.capturingKey ? 'Appuyez sur la télécommande…' : 'Apprendre une touche'} icon="keypad-outline" small variant="ghost" onPress={() => bleCounter.captureKey()} />
            <Button title="Touches par défaut" small variant="ghost" onPress={() => bleCounter.resetKeys()} />
          </Row>
          <Muted>Les touches de volume ne sont pas transmises aux pages web par tous les navigateurs mobiles.</Muted>
        </Card>
      ) : null}
      {/* -------- Retour */}
      <Spacer />
      <H2>Retour à chaque appui</H2>
      <Toggle label="Vibration" value={s.prefs.haptics} onChange={(v) => bleCounter.setPrefs({ haptics: v })} />
      <Toggle label="Son" value={s.prefs.sound} onChange={(v) => bleCounter.setPrefs({ sound: v })} />

      {/* -------- Appareils */}
      <Spacer />
      <H2>Compatibilité</H2>
      {PROFILES.filter((p) => p.id !== 'auto').map((p) => (
        <Card key={p.id} style={{ marginBottom: 8 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Body style={{ flex: 1 }}>{p.label}</Body>
            <Badge label={p.doc === 'documenté' ? 'Protocole documenté' : p.doc === 'partiel' ? 'Partiellement documenté' : 'Générique'} tone={p.doc === 'documenté' ? 'success' : p.doc === 'partiel' ? 'warning' : 'neutral'} />
          </Row>
          <Muted>{p.note}</Muted>
          {p.sources.map((u) => (
            <Muted key={u}>Source : {u}</Muted>
          ))}
        </Card>
      ))}
      <Muted>
        Web : Chrome / Edge sur ordinateur et Android. Safari et iOS ne prennent pas en charge le Bluetooth web. App native : Android 12+ (« Appareils à proximité ») et iOS via un build de développement ou EAS
        (pas Expo Go).
      </Muted>

      <Divider />
      <Button title="Diagnostic Bluetooth (journal, RSSI, services)" icon="pulse-outline" variant="ghost" onPress={() => router.push('/ble-diag')} />
      <Spacer h={8} />
      <View>
        <Eyebrow>Test sans appareil</Eyebrow>
        <Button title={`${L('Simuler un appui (+1)')} · ${tr.simulation}`} icon="finger-print-outline" variant="ghost" small onPress={() => bleCounter.simulate()} />
      </View>
    </Screen>
  );
}
