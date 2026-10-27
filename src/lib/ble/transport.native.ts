/**
 * Transport natif (Android / iOS) via react-native-ble-plx.
 * Nécessite un build de développement ou EAS (le module natif n'existe pas dans Expo Go).
 */
import { PermissionsAndroid, Platform } from 'react-native';
import { b64ToBytes, normUuid, type Bytes, type GattChar } from './core';
import type { Availability, BleLink, BleTransport } from './types';

type Plx = typeof import('react-native-ble-plx');
let plx: Plx | null = null;
let manager: import('react-native-ble-plx').BleManager | null = null;
let loadError: string | null = null;

function getManager() {
  if (manager) return manager;
  if (loadError) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    plx = require('react-native-ble-plx') as Plx;
    manager = new plx.BleManager();
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

async function requestAndroidPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const api = typeof Platform.Version === 'number' ? Platform.Version : parseInt(String(Platform.Version), 10);
  const P = PermissionsAndroid.PERMISSIONS;
  const perms = api >= 31 ? [P.BLUETOOTH_SCAN, P.BLUETOOTH_CONNECT] : [P.ACCESS_FINE_LOCATION];
  const res = await PermissionsAndroid.requestMultiple(perms);
  return perms.every((p) => res[p] === PermissionsAndroid.RESULTS.GRANTED);
}

export const transport: BleTransport = {
  platform: 'native',
  mode: 'scan',
  async availability(): Promise<Availability> {
    const m = getManager();
    if (!m) return { ok: false, kind: 'expo-go', reason: 'Module Bluetooth absent : Expo Go ne l’inclut pas. Installez un build de développement ou EAS de Zikru.' };
    if (!(await requestAndroidPermissions())) return { ok: false, kind: 'denied', reason: 'Autorisation Bluetooth refusée. Activez « Appareils à proximité » dans les réglages Android.' };
    const st = await m.state();
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
  async connect(id) {
    const m = getManager();
    if (!m) throw new Error(loadError ?? 'BLE indisponible');
    await m.stopDeviceScan();
    const dev = await m.connectToDevice(id, { timeout: 12000 });
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
