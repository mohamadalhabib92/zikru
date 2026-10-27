/**
 * Transport natif (Android / iOS) via react-native-ble-plx.
 * Nécessite un build de développement ou EAS (le module natif n'existe pas dans Expo Go).
 */
import { PermissionsAndroid, Platform } from 'react-native';
import { b64ToBytes, normUuid, type Bytes, type GattChar } from './core';
import type { Availability, BleLink, BleTransport, ScanResult } from './types';

type Plx = typeof import('react-native-ble-plx');
let plx: Plx | null = null;
let manager: import('react-native-ble-plx').BleManager | null = null;
let loadError: string | null = null;
/** Identifiant de restauration CoreBluetooth (iOS) : nécessite le mode d'arrière-plan bluetooth-central (app.json). */
export const RESTORE_ID = 'zikru-ble-central';
let restoredIds: string[] | null = null;
const restoreSubs = new Set<(ids: string[]) => void>();

/**
 * Création paresseuse : jamais à l'import du module (aucun travail Bluetooth au démarrage tant
 * qu'aucun appareil n'est mémorisé ou que l'écran Bluetooth n'est pas ouvert).
 */
function getManager() {
  if (manager) return manager;
  if (loadError) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    plx = require('react-native-ble-plx') as Plx;
    manager = new plx.BleManager({
      restoreStateIdentifier: RESTORE_ID,
      restoreStateFunction: (st) => {
        restoredIds = (st?.connectedPeripherals ?? []).map((d) => d.id);
        restoreSubs.forEach((f) => f(restoredIds ?? []));
      },
    });
    return manager;
  } catch (e) {
    loadError = e instanceof Error ? e.message : String(e);
    return null;
  }
}

function bytesToB64(b: Bytes): string {
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let out = '';
  for (let i = 0; i < b.length; i += 3) {
    const n = (b[i] << 16) | ((b[i + 1] ?? 0) << 8) | (b[i + 2] ?? 0);
    out += A[(n >> 18) & 63] + A[(n >> 12) & 63] + (i + 1 < b.length ? A[(n >> 6) & 63] : '=') + (i + 2 < b.length ? A[n & 63] : '=');
  }
  return out;
}

async function androidPermissions(prompt: boolean): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const api = typeof Platform.Version === 'number' ? Platform.Version : parseInt(String(Platform.Version), 10);
  const P = PermissionsAndroid.PERMISSIONS;
  const perms = api >= 31 ? [P.BLUETOOTH_SCAN, P.BLUETOOTH_CONNECT] : [P.ACCESS_FINE_LOCATION];
  if (!prompt) {
    const ok = await Promise.all(perms.map((p) => PermissionsAndroid.check(p)));
    return ok.every(Boolean);
  }
  const res = await PermissionsAndroid.requestMultiple(perms);
  return perms.every((p) => res[p] === PermissionsAndroid.RESULTS.GRANTED);
}

export const transport: BleTransport = {
  platform: 'native',
  mode: 'scan',
  async availability(opts): Promise<Availability> {
    const m = getManager();
    if (!m) return { ok: false, kind: 'expo-go', reason: 'Module Bluetooth absent : Expo Go ne l’inclut pas. Installez un build de développement ou EAS de Zikru.' };
    if (!(await androidPermissions(opts?.prompt !== false))) return { ok: false, kind: 'denied', reason: 'Autorisation Bluetooth refusée. Activez « Appareils à proximité » dans les réglages Android.' };
    let st: string = await m.state();
    if (st === 'Unknown' || st === 'Resetting') {
      // Juste après la création du gestionnaire, CoreBluetooth n'a pas encore d'état : courte attente.
      st = await new Promise<string>((resolve) => {
        const timer = setTimeout(() => {
          sub.remove();
          resolve(st);
        }, 2500);
        const sub = m.onStateChange((x) => {
          if (x === 'Unknown' || x === 'Resetting') return;
          clearTimeout(timer);
          sub.remove();
          resolve(x);
        }, true);
      });
    }
    if (st === 'PoweredOn') return { ok: true };
    if (st === 'Unauthorized') return { ok: false, kind: 'denied', reason: 'Accès Bluetooth refusé : autorisez Zikru dans Réglages > Confidentialité > Bluetooth.' };
    if (st === 'Unsupported') return { ok: false, kind: 'unsupported', reason: 'Cet appareil ne prend pas en charge le Bluetooth basse consommation.' };
    return { ok: false, kind: 'disabled', reason: 'Bluetooth désactivé : activez-le puis réessayez.' };
  },
  async scan(onResult, onError) {
    const m = getManager();
    if (!m) throw new Error(loadError ?? 'BLE indisponible');
    // Aucun filtre de service : tous les appareils BLE à proximité sont listés (les compteurs probables sont mis en avant par l'écran).
    await m.startDeviceScan(null, { allowDuplicates: false }, (err, d) => {
      if (err) return onError(new Error(err.message));
      if (d) onResult({ id: d.id, name: d.name ?? d.localName ?? null, rssi: d.rssi ?? null, services: (d.serviceUUIDs ?? []).map(normUuid) });
    });
    return () => {
      void m.stopDeviceScan();
    };
  },
  async canReconnect() {
    return !!getManager();
  },
  silentReconnectSupported() {
    return true;
  },
  onStateChange(cb) {
    const m = getManager();
    if (!m) return () => {};
    const sub = m.onStateChange((st) => cb(st === 'PoweredOn'), false);
    return () => sub.remove();
  },
  onRestore(cb) {
    restoreSubs.add(cb);
    if (restoredIds) cb(restoredIds);
    return () => {
      restoreSubs.delete(cb);
    };
  },
  async findKnown(match, ms) {
    const m = getManager();
    if (!m) return null;
    return new Promise<ScanResult | null>((resolve) => {
      let done = false;
      const finish = (r: ScanResult | null) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        void m.stopDeviceScan();
        resolve(r);
      };
      const timer = setTimeout(() => finish(null), ms);
      Promise.resolve(
        m.startDeviceScan(null, { allowDuplicates: false }, (err, d) => {
          if (err) return finish(null);
          if (!d) return;
          const r: ScanResult = { id: d.id, name: d.name ?? d.localName ?? null, rssi: d.rssi ?? null, services: (d.serviceUUIDs ?? []).map(normUuid) };
          if (match(r)) finish(r);
        }),
      ).catch(() => finish(null));
    });
  },
  async cancel(id) {
    const m = getManager();
    await m?.cancelDeviceConnection(id).catch(() => {});
  },
  async connect(id, opts) {
    const m = getManager();
    if (!m) throw new Error(loadError ?? 'BLE indisponible');
    await m.stopDeviceScan();
    // Déjà connecté (ex. restauré par iOS) : on reprend l'appareil tel quel.
    let dev = (await m.isDeviceConnected(id).catch(() => false)) && Platform.OS === 'ios' ? ((await m.devices([id]).catch(() => []))[0] ?? null) : null;
    if (!dev) {
      // iOS : connexion par identifiant mémorisé (CoreBluetooth retrouve le périphérique sans scan).
      const o = opts.wait ? (Platform.OS === 'android' ? { autoConnect: true } : {}) : { timeout: opts.timeoutMs ?? 12000 };
      dev = await m.connectToDevice(id, o);
    }
    await dev.discoverAllServicesAndCharacteristics();
    const chars: GattChar[] = [];
    for (const s of await dev.services()) {
      for (const c of await s.characteristics()) {
        chars.push({ service: normUuid(s.uuid), uuid: normUuid(c.uuid), notify: c.isNotifiable || c.isIndicatable, read: c.isReadable });
      }
    }
    const link: BleLink = {
      id: dev.id,
      name: dev.name ?? dev.localName ?? null,
      chars,
      async subscribe(s, c, cb) {
        const sub = m.monitorCharacteristicForDevice(id, s, c, (err, ch) => {
          if (!err && ch?.value) cb(b64ToBytes(ch.value));
        });
        return () => sub.remove();
      },
      async read(s, c) {
        try {
          const ch = await m.readCharacteristicForDevice(id, s, c);
          return b64ToBytes(ch.value);
        } catch {
          return null;
        }
      },
      async write(s, c, data) {
        await m.writeCharacteristicWithResponseForDevice(id, s, c, bytesToB64(data));
      },
      onDisconnect(cb) {
        const sub = m.onDeviceDisconnected(id, () => cb());
        return () => sub.remove();
      },
      async disconnect() {
        try {
          await m.cancelDeviceConnection(id);
        } catch {
          /* déjà déconnecté */
        }
      },
    };
    return link;
  },
};
