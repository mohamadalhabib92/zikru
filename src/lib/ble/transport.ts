/**
 * Transport Web Bluetooth (Chrome, Edge, Opera, Chrome Android ; pas Safari ni iOS).
 * Spécification : https://webbluetoothcg.github.io/web-bluetooth/
 * Rappels : les services doivent être listés dans optionalServices ; le service HID 0x1812
 * est sur la liste de blocage (les anneaux-télécommandes passent par le mode clavier).
 */
import { normUuid, type Bytes, type GattChar } from './core';
import { diag, errMsg } from './diag';
import { bleMsg } from './messages';
import type { Availability, BleLink, BleTransport, ScanResult } from './types';

// Types minimaux (lib.dom n'inclut pas Web Bluetooth)
type BtChar = EventTarget & { uuid: string; properties: { notify: boolean; indicate: boolean; read: boolean; write: boolean; writeWithoutResponse: boolean }; value?: DataView; startNotifications(): Promise<BtChar>; stopNotifications(): Promise<BtChar>; readValue(): Promise<DataView>; writeValue(v: BufferSource): Promise<void> };
type BtService = { uuid: string; getCharacteristics(): Promise<BtChar[]>; getCharacteristic(u: string): Promise<BtChar> };
type BtServer = { connected: boolean; connect(): Promise<BtServer>; disconnect(): void; getPrimaryServices(): Promise<BtService[]>; getPrimaryService(u: string): Promise<BtService> };
type BtDevice = EventTarget & { id: string; name?: string; gatt?: BtServer; watchAdvertisements?(o?: { signal?: AbortSignal }): Promise<void> };
type Bt = EventTarget & {
  getAvailability?(): Promise<boolean>;
  requestDevice(o: { filters?: { namePrefix?: string; services?: string[] }[]; optionalServices?: string[]; acceptAllDevices?: boolean }): Promise<BtDevice>;
  getDevices?(): Promise<BtDevice[]>;
};

function bt(): Bt | null {
  if (typeof navigator === 'undefined') return null;
  return ((navigator as unknown as { bluetooth?: Bt }).bluetooth ?? null) as Bt | null;
}
const known = new Map<string, BtDevice>();
const toBytes = (v: DataView | undefined | null): Bytes => (v ? new Uint8Array(v.buffer.slice(v.byteOffset, v.byteOffset + v.byteLength)) : new Uint8Array(0));

function isIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.userAgent.includes('Mac') && 'ontouchend' in (globalThis as object));
}

async function findDevice(id: string): Promise<BtDevice | null> {
  if (known.has(id)) return known.get(id)!;
  const b = bt();
  if (b?.getDevices) {
    try {
      const list = await b.getDevices();
      for (const d of list) known.set(d.id, d);
      return known.get(id) ?? null;
    } catch {
      return null;
    }
  }
  return null;
}

export const transport: BleTransport = {
  platform: 'web',
  mode: 'chooser',
  async availability(): Promise<Availability> {
    const b = bt();
    if (!b) {
      if (typeof window !== 'undefined' && !window.isSecureContext) return { ok: false, kind: 'unsupported', reason: 'Le Bluetooth web exige une page sécurisée (https).' };
      return {
        ok: false,
        kind: 'unsupported',
        reason: isIos()
          ? 'Safari et tous les navigateurs iOS/iPadOS ne prennent pas en charge le Bluetooth web. Utilisez l’app Zikru installée (build natif), ou un anneau-télécommande en mode clavier.'
          : 'Ce navigateur ne prend pas en charge le Bluetooth web (Safari, Firefox). Utilisez Chrome ou Edge sur ordinateur ou Android, ou l’app native.',
      };
    }
    try {
      if (b.getAvailability && !(await b.getAvailability())) return { ok: false, kind: 'disabled', reason: bleMsg('off') };
    } catch {
      /* certains navigateurs n'implémentent pas getAvailability */
    }
    return { ok: true };
  },
  async choose({ services, namePrefixes, acceptAll }) {
    const b = bt();
    if (!b) throw new Error('Bluetooth web indisponible');
    const filters = namePrefixes.map((namePrefix) => ({ namePrefix }));
    diag.log('choose', `sélecteur ${acceptAll || filters.length === 0 ? 'tous appareils' : `préfixes ${namePrefixes.join(', ')}`} · services ${services.join(', ') || '—'}`);
    const d = await b.requestDevice(acceptAll || filters.length === 0 ? { acceptAllDevices: true, optionalServices: services } : { filters, optionalServices: services });
    known.set(d.id, d);
    diag.seen({ id: d.id, name: d.name ?? null, rssi: null });
    return d.id;
  },
  async canReconnect(id) {
    return !!(await findDevice(id));
  },
  silentReconnectSupported() {
    return typeof bt()?.getDevices === 'function';
  },
  onStateChange(cb) {
    const b = bt();
    if (!b?.addEventListener) return () => {};
    const h = (e: Event) => cb(!!(e as Event & { value?: boolean }).value);
    b.addEventListener('availabilitychanged', h);
    return () => b.removeEventListener('availabilitychanged', h);
  },
  /** Chrome : getDevices() + watchAdvertisements() sur les appareils déjà autorisés. */
  async findKnown(match, ms) {
    const b = bt();
    if (!b?.getDevices) return null;
    let list: BtDevice[] = [];
    try {
      list = await b.getDevices();
    } catch {
      return null;
    }
    list.forEach((d) => known.set(d.id, d));
    const cands = list.filter((d) => typeof d.watchAdvertisements === 'function' && match({ id: d.id, name: d.name ?? null, rssi: null }));
    if (!cands.length) return null;
    return new Promise<ScanResult | null>((resolve) => {
      const ac = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const offs: (() => void)[] = [];
      let done = false;
      const finish = (r: ScanResult | null) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        offs.forEach((f) => f());
        ac?.abort();
        resolve(r);
      };
      const timer = setTimeout(() => finish(null), ms);
      for (const d of cands) {
        const h = (e: Event) => finish({ id: d.id, name: d.name ?? null, rssi: (e as Event & { rssi?: number }).rssi ?? null });
        d.addEventListener('advertisementreceived', h);
        offs.push(() => d.removeEventListener('advertisementreceived', h));
        d.watchAdvertisements!(ac ? { signal: ac.signal } : undefined).catch(() => {});
      }
    });
  },
  async cancel(id) {
    const d = known.get(id);
    if (d?.gatt?.connected) d.gatt.disconnect();
  },
  async connect(id, opts) {
    const d = await findDevice(id);
    if (!d?.gatt) throw new Error('Appareil non autorisé dans ce navigateur : choisissez-le à nouveau.');
    const gatt = d.gatt;
    const ms = opts?.timeoutMs ?? 12000;
    let timer: ReturnType<typeof setTimeout> | null = null;
    diag.log('connect', `${d.name ?? id} · délai ${ms} ms`);
    const t0 = Date.now();
    const server = await Promise.race([
      gatt.connect(),
      new Promise<never>((_, rej) => {
        timer = setTimeout(() => {
          try {
            gatt.disconnect();
          } catch {
            /* ignoré */
          }
          rej(Object.assign(new Error('Appareil hors de portée (délai dépassé)'), { errorCode: 3 }));
        }, ms);
      }),
    ])
      .catch((e: unknown) => {
        diag.error('connect', e);
        throw e;
      })
      .finally(() => timer && clearTimeout(timer));
    const chars: GattChar[] = [];
    const handles = new Map<string, BtChar>();
    let services: BtService[] = [];
    for (let i = 0; i < 2; i++) {
      try {
        services = await server.getPrimaryServices();
        break;
      } catch (e) {
        // Chrome : « GATT Server is disconnected » juste après connect() ; une nouvelle tentative suffit souvent.
        diag.log('discover', `getPrimaryServices : ${errMsg(e)}`, i ? 'error' : 'warn');
        if (i === 0 && !server.connected) await gatt.connect().catch(() => {});
        services = [];
      }
    }
    for (const s of services) {
      let cs: BtChar[] = [];
      try {
        cs = await s.getCharacteristics();
      } catch (e) {
        diag.log('discover', `${normUuid(s.uuid)} : ${errMsg(e)}`, 'warn');
        continue;
      }
      for (const c of cs) {
        const key = normUuid(s.uuid) + '|' + normUuid(c.uuid);
        handles.set(key, c);
        chars.push({ service: normUuid(s.uuid), uuid: normUuid(c.uuid), notify: c.properties.notify || c.properties.indicate, read: c.properties.read });
      }
    }
    diag.log('connect', `connecté à ${d.name ?? id} en ${Date.now() - t0} ms`);
    diag.setGatt({ id: d.id, name: d.name ?? null, chars });
    const get = (s: string, c: string) => handles.get(normUuid(s) + '|' + normUuid(c));
    const link: BleLink = {
      id: d.id,
      name: d.name ?? null,
      chars,
      async subscribe(s, c, cb) {
        const ch = get(s, c);
        if (!ch) throw new Error('Caractéristique introuvable');
        const h = (e: Event) => cb(toBytes((e.target as BtChar).value));
        ch.addEventListener('characteristicvaluechanged', h);
        try {
          await ch.startNotifications();
        } catch (e) {
          ch.removeEventListener('characteristicvaluechanged', h);
          diag.log('notify', `${c} : ${errMsg(e)}`, 'error');
          throw e;
        }
        diag.log('notify', `abonné ${s} / ${c}`);
        return () => {
          ch.removeEventListener('characteristicvaluechanged', h);
          if (server.connected) void ch.stopNotifications().catch(() => {});
        };
      },
      async read(s, c) {
        const ch = get(s, c);
        if (!ch || !ch.properties.read) return null;
        try {
          return toBytes(await ch.readValue());
        } catch {
          return null;
        }
      },
      async write(s, c, data) {
        const ch = get(s, c);
        if (ch) await ch.writeValue(data as unknown as BufferSource);
      },
      onDisconnect(cb) {
        const h = () => {
          diag.log('disconnect', 'déconnecté');
          cb();
        };
        d.addEventListener('gattserverdisconnected', h);
        return () => d.removeEventListener('gattserverdisconnected', h);
      },
      async disconnect() {
        if (server.connected) server.disconnect();
      },
    };
    return link;
  },
};
