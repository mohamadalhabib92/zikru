import { useState } from 'react';
import { Platform, Text, TextInput, View } from 'react-native';
import { bleCounter, useBleCounter } from '@/lib/ble/manager';
import { fieldLabel, isValidUuid, keyLabel, PROFILES, shortUuid } from '@/lib/ble/core';
import { useData } from '@/lib/data';
import { useSettings } from '@/lib/settings';
import { Badge, Body, Button, Card, Chip, Divider, Eyebrow, Field, H1, H2, ListItem, Muted, Notice, Row, Screen, Segmented, Spacer, Toggle } from '@/ui/kit';
import { theme as t } from '@/ui/theme';

const STATUS_TONE = { connecté: 'success', connexion: 'info', reconnexion: 'warning', déconnecté: 'neutral', erreur: 'danger' } as const;
const STATUS_HELP = {
  connecté: 'Connecté : chaque appui compte.',
  connexion: 'Connexion en cours…',
  reconnexion: 'Reconnexion automatique en cours…',
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

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between' }}>
        <H1>{tr.ring}</H1>
        <Badge label={s.status === 'reconnexion' ? `reconnexion (${s.attempt})` : s.status} tone={STATUS_TONE[s.status]} />
      </Row>
      <Muted>Tasbih électronique, anneau de dhikr ou télécommande : chaque appui ajoute +1 au compteur de session ({tasbih.count}{tasbih.target ? ` / ${tasbih.target}` : ''}).</Muted>
      <Muted>{STATUS_HELP[s.status]}</Muted>
      <Spacer />
      {s.lastSync && Date.now() - s.lastSync.at < 10 * 60 * 1000 ? (
        <>
          <Notice tone="success" icon="sync-outline" title={`Synchronisé : +${s.lastSync.added}`} text="Appuis faits pendant que l’appareil était déconnecté, ajoutés une seule fois à la session et à l’historique." />
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
                ? `Champ repéré : ${s.mapping.field ? fieldLabel(s.mapping.field) : 'format connu'} sur ${shortUuid(s.mapping.characteristic)}. Confirmez en appuyant 3 fois : le profil sera mémorisé pour cet appareil.`
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
          <Notice tone={av.kind === 'unsupported' ? 'warning' : 'danger'} title={av.kind === 'expo-go' ? 'Build natif requis' : 'Bluetooth indisponible'} text={av.reason} icon="bluetooth-outline" />
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
              <Button title="Rechercher un compteur" icon="bluetooth-outline" loading={busy} disabled={!!av && !av.ok} onPress={() => void bleCounter.choose(true)} />
            ) : (
              <Button title={s.scanning ? 'Recherche…' : 'Rechercher'} icon="search-outline" loading={s.scanning} disabled={!!av && !av.ok && av.kind !== 'disabled' && av.kind !== 'denied'} onPress={() => void bleCounter.startScan()} />
            )}
            {s.lastDevice ? <Button title="Reconnecter" icon="refresh" variant="ghost" loading={busy} onPress={() => void bleCounter.reconnect()} /> : null}
            {s.status === 'reconnexion' ? <Button title="Arrêter" variant="ghost" small onPress={() => void bleCounter.disconnect()} /> : null}
          </Row>
        )}
      </Card>

      {/* -------- Résultats du scan (natif) */}
      {!web && (s.scanning || s.scanResults.length > 0) && !connected ? (
        <>
          <Spacer />
          <H2>Appareils à proximité</H2>
          <Muted>Tous les appareils Bluetooth LE à proximité sont listés ; les compteurs probables (nom tasbih, zikr, ring, iQibla, BW…, ou service connu) apparaissent en premier. Appuyez une fois sur le bouton de l’appareil pour le réveiller.</Muted>
          <Spacer h={8} />
          {s.scanResults.map((r) => (
            <ListItem
              key={r.id}
              title={`${r.likely ? '★ ' : ''}${r.name ?? 'Sans nom'}`}
              subtitle={`${r.likely ? `Compteur probable (${r.reason}) · ` : ''}${r.id}${r.rssi != null ? ` · ${r.rssi} dBm` : ''}`}
              icon={r.likely ? 'radio-button-on-outline' : 'bluetooth-outline'}
              onPress={() => void bleCounter.connectTo(r.id)}
            />
          ))}
        </>
      ) : null}

      {/* -------- Appareils mémorisés */}
      {s.devices.length > 0 ? (
        <>
          <Spacer />
          <H2>Appareils mémorisés</H2>
          <Muted>{web ? 'Reconnexion automatique si le navigateur a gardé l’autorisation (sinon, choisissez-le à nouveau).' : 'Reconnexion automatique à l’ouverture de l’app quand l’appareil est à portée.'}</Muted>
          <Spacer h={8} />
          {s.devices.map((d) => (
            <ListItem
              key={d.id}
              title={d.name ?? 'Appareil sans nom'}
              subtitle={`${s.device?.id === d.id && connected ? 'Connecté' : 'Hors connexion'}${d.lastSeen ? ` · vu le ${new Date(d.lastSeen).toLocaleDateString('fr-CH')}` : ''}`}
              icon="watch-outline"
              onPress={s.device?.id === d.id && connected ? undefined : () => void bleCounter.connectTo(d.id)}
            />
          ))}
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
              <Notice tone="success" title={`Correspondance enregistrée (confiance ${s.learn.result.confidence})`} text={`${s.learn.result.detail} Caractéristique ${shortUuid(s.learn.result.mapping.characteristic)}.`} icon="checkmark-circle-outline" />
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
            placeholder="Zone de capture : touchez ici, puis utilisez la télécommande"
            placeholderTextColor={t.muted}
            autoCorrect={false}
            autoCapitalize="none"
            showSoftInputOnFocus={false}
            style={{ borderWidth: 1, borderColor: t.border, borderRadius: 12, padding: 12, color: t.text, marginTop: 8 }}
          />
          <Muted>Touches : {s.prefs.hidKeys.map(keyLabel).join(', ')}</Muted>
          {s.lastKey ? <Muted>Dernière touche reçue : {keyLabel(s.lastKey)}</Muted> : null}
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
          <Muted>Touches : {s.prefs.hidKeys.map(keyLabel).join(', ')}</Muted>
          {s.lastKey ? <Muted>Dernière touche reçue : {keyLabel(s.lastKey)}</Muted> : null}
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
      <Toggle label="Reconnexion automatique" value={s.prefs.autoReconnect} onChange={(v) => bleCounter.setPrefs({ autoReconnect: v })} hint="Reconnecte l’appareil après une coupure et au lancement de l’app." />

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
      <View>
        <Eyebrow>Test sans appareil</Eyebrow>
        <Button title={`Simuler un appui (+1) · ${tr.simulation}`} icon="finger-print-outline" variant="ghost" small onPress={() => bleCounter.simulate()} />
      </View>
    </Screen>
  );
}
