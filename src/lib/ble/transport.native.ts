/**
 * Transport natif (Android / iOS) via react-native-ble-plx.
 * Nécessite un build de développement ou EAS (le module natif n'existe pas dans Expo Go).
 */
import { PermissionsAndroid, Platform } from 'react-native';
import { b64ToBytes, normUuid, parseAdvertising, type Bytes, type GattChar } from './core';
import { diag, errMsg } from './diag';
import { bleMsg } from './messages';
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
        diag.log('restore', `iOS a restauré ${restoredIds.length} appareil(s)`);
        restoreSubs.forEach((f) => f(restoredIds ?? []));
      },
    });
    return manager;
  } catch (e) {
    loadError = e instanceof Error ? e.message : String(e);
    diag.log('init', `module ble-plx indisponible : ${loadError}`, 'error');
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
  // Android 12+ : « Appareils à proximité » (neverForLocation) ; avant : localisation précise obligatoire pour scanner.
  const perms = api >= 31 ? [P.BLUETOOTH_SCAN, P.BLUETOOTH_CONNECT] : [P.ACCESS_FINE_LOCATION];
  if (!prompt) {
    const ok = await Promise.all(perms.map((p) => PermissionsAndroid.check(p)));
    return ok.every(Boolean);
  }
  const res = await PermissionsAndroid.requestMultiple(perms);
  const ok = perms.every((p) => res[p] === PermissionsAndroid.RESULTS.GRANTED);
  if (!ok) diag.log('perm', `Android API ${api} : ${perms.map((p) => `${p.split('.').pop()}=${res[p]}`).join(', ')}`, 'warn');
  return ok;
}

/** Attend un état CoreBluetooth / Android stable (Unknown/Resetting → état définitif). */
function settledState(m: import('react-native-ble-plx').BleManager, first: string, ms: number): Promise<string> {
  if (first !== 'Unknown' && first !== 'Resetting') return Promise.resolve(first);
  return new Promise<string>((resolve) => {
    let done = false;
    const finish = (x: string) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      sub.remove();
      resolve(x);
    };
    const timer = setTimeout(() => finish(first), ms);
    const sub = m.onStateChange((x) => {
      if (x !== 'Unknown' && x !== 'Resetting') finish(x);
    }, true);
  });
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(Object.assign(new Error(`${label} : délai dépassé (${ms} ms)`), { errorCode: 3 })), ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e: unknown) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

type PlxDevice = import('react-native-ble-plx').Device;
/** Résultat de scan enrichi : nom, services (annoncés + service data), apparence et données fabricant (liste autorisée). */
function toScanResult(d: PlxDevice): ScanResult {
  const raw = d.rawScanRecord ? b64ToBytes(d.rawScanRecord) : new Uint8Array(0);
  const adv = raw.length ? parseAdvertising(raw) : null;
  const mfr = d.manufacturerData ? b64ToBytes(d.manufacturerData) : null;
  const services = [...new Set([...(d.serviceUUIDs ?? []), ...Object.keys(d.serviceData ?? {}), ...(adv?.services16 ?? [])].map(normUuid))];
  return {
    id: d.id,
    name: d.name ?? d.localName ?? null,
    rssi: d.rssi ?? null,
    services,
    appearance: adv?.appearance ?? null,
    manufacturerId: mfr && mfr.length >= 2 ? mfr[0] | (mfr[1] << 8) : (adv?.manufacturer?.id ?? null),
    manufacturerData: mfr && mfr.length >= 2 ? mfr.subarray(2) : (adv?.manufacturer?.data ?? null),
  };
}

const ANDROID_MTU = 185;
const DISCOVERY_MS = 15000;

export const transport: BleTransport = {
  platform: 'native',
  mode: 'scan',
  async rawState() {
    const m = getManager();
    if (!m) return 'NoModule';
    return String(await m.state());
  },
  async availability(opts): Promise<Availability> {
    const m = getManager();
    if (!m) return { ok: false, kind: 'expo-go', reason: bleMsg('expoGo') };
    const prompt = opts?.prompt !== false;
    if (!(await androidPermissions(prompt))) return { ok: false, kind: 'denied', reason: bleMsg('deniedAndroid') };
    // iOS : à la première utilisation, l'état reste « Unknown » tant que l'alerte d'autorisation est affichée.
    // Attendre la réponse de l'utilisateur (jusqu'à 30 s) au lieu de conclure « Bluetooth désactivé ».
    const first = String(await m.state());
    const st = await settledState(m, first, prompt ? 30000 : 2500);
    if (st !== first || st !== 'PoweredOn') diag.log('state', `état ${first} → ${st}`, st === 'PoweredOn' ? 'info' : 'warn');
    if (st === 'PoweredOn') return { ok: true };
    if (st === 'Unauthorized') return { ok: false, kind: 'denied', reason: Platform.OS === 'android' ? bleMsg('deniedAndroid') : bleMsg('deniedIos') };
    if (st === 'Unsupported') return { ok: false, kind: 'unsupported', reason: bleMsg('unsupported') };
    if (st === 'Unknown' || st === 'Resetting') return { ok: false, kind: 'disabled', reason: bleMsg('notReady') };
    return { ok: false, kind: 'disabled', reason: bleMsg('off') };
  },
  async scan(onResult, onError, opts) {
    const m = getManager();
    if (!m) throw new Error(loadError ?? 'BLE indisponible');
    const filter = opts?.services?.length ? opts.services : null;
    diag.log('scan', filter ? `début (filtre : ${filter.join(', ')})` : 'début (sans filtre de service)');
    // Par défaut aucun filtre : la ZKR-R1 et la plupart des compteurs n'annoncent pas leur service principal.
    // Recherche lancée par l'utilisateur : scan rapide (Android LowLatency, ~15 s max) pour une 1re détection immédiate.
    await m.startDeviceScan(filter, { allowDuplicates: false, scanMode: plx?.ScanMode.LowLatency }, (err, d) => {
      if (err) {
        diag.error('scan', err);
        return onError(new Error(err.errorCode === 601 ? bleMsg('locationOff') : bleMsg('scanFailed', { m: errMsg(err) })));
      }
      if (d) {
        const r = toScanResult(d);
        diag.seen(r);
        onResult(r);
      }
    });
    return () => {
      diag.log('scan', 'arrêt');
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
    const sub = m.onStateChange((st) => {
      diag.log('state', `adaptateur : ${st}`);
      cb(st === 'PoweredOn');
    }, false);
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
        // Recherche automatique en tâche de fond : mode équilibré (Android) pour ménager la batterie.
        m.startDeviceScan(null, { allowDuplicates: false, scanMode: plx?.ScanMode.Balanced }, (err, d) => {
          if (err) {
            diag.error('findKnown', err);
            return finish(null);
          }
          if (!d) return;
          const r = toScanResult(d);
          diag.seen(r);
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
    // Android : connecter juste après l'arrêt du scan provoque souvent l'erreur GATT 133 → courte pause.
    if (Platform.OS === 'android' && !opts.wait) await new Promise((r) => setTimeout(r, 150));
    const t0 = Date.now();
    // Déjà connecté (restauré par iOS, ou lien Android resté ouvert) : on reprend l'appareil tel quel,
    // au lieu d'un connectToDevice qui échouerait (« already connected ») sur Android.
    let dev = (await m.isDeviceConnected(id).catch(() => false)) ? ((await m.devices([id]).catch(() => []))[0] ?? null) : null;
    if (dev) diag.log('connect', `${id} déjà connecté : reprise`);
    if (!dev) {
      const android = Platform.OS === 'android';
      // iOS : connexion par identifiant mémorisé (CoreBluetooth retrouve le périphérique sans scan).
      // Android : MTU demandé dès la connexion (trames > 20 octets).
      const o = opts.wait ? (android ? { autoConnect: true } : {}) : { timeout: opts.timeoutMs ?? 12000, ...(android ? { requestMTU: ANDROID_MTU } : {}) };
      diag.log('connect', `${id} · ${opts.wait ? 'en attente (sans délai)' : `délai ${opts.timeoutMs ?? 12000} ms`}`);
      try {
        dev = await m.connectToDevice(id, o);
      } catch (e) {
        diag.error('connect', e);
        throw e;
      }
      if (android && opts.wait) dev = await dev.requestMTU(ANDROID_MTU).catch(() => dev!);
    }
    const d = dev;
    try {
      await withTimeout(d.discoverAllServicesAndCharacteristics(), DISCOVERY_MS, 'Découverte des services');
    } catch (e) {
      diag.error('discover', e);
      // Lien à moitié ouvert : on le ferme pour ne pas bloquer la tentative suivante (iOS comme Android).
      await m.cancelDeviceConnection(id).catch(() => {});
      throw Object.assign(new Error(errMsg(e)), { errorCode: (e as { errorCode?: number }).errorCode ?? 300 });
    }
    const chars: GattChar[] = [];
    for (const s of await d.services()) {
      for (const c of await s.characteristics()) {
        chars.push({ service: normUuid(s.uuid), uuid: normUuid(c.uuid), notify: c.isNotifiable || c.isIndicatable, read: c.isReadable });
      }
    }
    const mtu = typeof d.mtu === 'number' ? d.mtu : null;
    diag.log('connect', `connecté à ${d.name ?? d.localName ?? id} en ${Date.now() - t0} ms${mtu ? ` · MTU ${mtu}` : ''}`);
    diag.setGatt({ id: d.id, name: d.name ?? d.localName ?? null, chars, mtu });
    const link: BleLink = {
      id: d.id,
      name: d.name ?? d.localName ?? null,
      chars,
      mtu,
      async subscribe(s, c, cb) {
        const sub = m.monitorCharacteristicForDevice(id, s, c, (err, ch) => {
          if (err) {
            // 2 = annulé (déconnexion / désabonnement normal) ; le reste est signalé.
            if (err.errorCode !== 2 && err.errorCode !== 201) diag.log('notify', `${c} : ${errMsg(err)}`, 'error');
            return;
          }
          if (ch?.value) cb(b64ToBytes(ch.value));
        });
        diag.log('notify', `abonné ${s} / ${c}`);
        return () => sub.remove();
      },
      async read(s, c) {
        try {
          const ch = await m.readCharacteristicForDevice(id, s, c);
          return b64ToBytes(ch.value);
        } catch (e) {
          diag.log('read', `${c} : ${errMsg(e)}`, 'warn');
          return null;
        }
      },
      async write(s, c, data) {
        await m.writeCharacteristicWithResponseForDevice(id, s, c, bytesToB64(data));
      },
      onDisconnect(cb) {
        const sub = m.onDeviceDisconnected(id, (err) => {
          diag.log('disconnect', err ? `déconnecté : ${errMsg(err)}` : 'déconnecté', err ? 'warn' : 'info');
          cb();
        });
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
