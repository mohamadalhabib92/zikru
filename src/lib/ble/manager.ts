/**
 * Gestionnaire du compteur Bluetooth : connexion, profil, décodage des appuis, batterie,
 * reconnexion automatique, mode apprentissage et mode clavier (HID).
 * Même code pour web et natif : seule la couche `transport` change (transport.ts / transport.native.ts).
 */
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import { loadJSON, saveJSON } from '../storage';
import {
  analyzeLearn,
  candidateChars,
  ClickDecoder,
  DEFAULT_HID_KEYS,
  defaultMapping,
  detectCounterField,
  detectProfile,
  likelyCounter,
  isCounterKey,
  isValidUuid,
  normUuid,
  profileById,
  reconnectDelay,
  sameUuid,
  servicesToRequest,
  STD,
  toHex,
  type Bytes,
  type DeviceProfile,
  type LearnResult,
  type LearnSample,
  type Mapping,
} from './core';
import { transport } from './transport';
import type { Availability, BleLink, ScanResult } from './types';

export type Status = 'déconnecté' | 'connexion' | 'connecté' | 'reconnexion' | 'erreur';
export type ClickSourceBle = 'bluetooth' | 'clavier' | 'simulation';
export type Prefs = { profileId: DeviceProfile['id']; customService: string; hidEnabled: boolean; hidKeys: string[]; sound: boolean; haptics: boolean; autoReconnect: boolean };
export type KnownDevice = { id: string; name: string | null; lastSeen: string };
type Persisted = { prefs: Prefs; lastDevice: { id: string; name: string | null } | null; mappings: Record<string, Mapping>; lastValues?: Record<string, number>; devices?: KnownDevice[] };

export type BleState = {
  availability: Availability | null;
  status: Status;
  device: { id: string; name: string | null } | null;
  battery: number | null;
  profile: DeviceProfile | null;
  mapping: Mapping | null;
  notifyCount: number;
  lastHex: string | null;
  lastAt: number | null;
  clicksThisConnection: number;
  error: string | null;
  attempt: number;
  scanning: boolean;
  scanResults: ScanResult[];
  learn: { active: boolean; presses: number; received: number; result: LearnResult | null };
  lastKey: string | null;
  capturingKey: boolean;
  prefs: Prefs;
  lastDevice: { id: string; name: string | null } | null;
  hidSupported: boolean;
  /** Appareils déjà connectés (profil mémorisé, reconnexion automatique). */
  devices: KnownDevice[];
  /** Dernière synchronisation : appuis faits hors connexion rattrapés à la reconnexion. */
  lastSync: { added: number; at: number } | null;
  /** Correspondance absente ou détectée automatiquement : proposer l'apprentissage « 3 appuis ». */
  needsConfirm: boolean;
};

const DEFAULT_PREFS: Prefs = { profileId: 'auto', customService: '', hidEnabled: Platform.OS === 'web', hidKeys: DEFAULT_HID_KEYS, sound: true, haptics: true, autoReconnect: true };
const KEY = 'ble-counter';

type ClickListener = (n: number, source: ClickSourceBle) => void;

class BleCounterManager {
  private s: BleState = {
    availability: null,
    status: 'déconnecté',
    device: null,
    battery: null,
    profile: null,
    mapping: null,
    notifyCount: 0,
    lastHex: null,
    lastAt: null,
    clicksThisConnection: 0,
    error: null,
    attempt: 0,
    scanning: false,
    scanResults: [],
    learn: { active: false, presses: 3, received: 0, result: null },
    lastKey: null,
    capturingKey: false,
    prefs: DEFAULT_PREFS,
    lastDevice: null,
    hidSupported: true,
    devices: [],
    lastSync: null,
    needsConfirm: false,
  };
  private lastValues: Record<string, number> = {};
  private autoFrames = new Map<string, Bytes[]>();
  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  private mappings: Record<string, Mapping> = {};
  private subs = new Set<() => void>();
  private clickSubs = new Set<ClickListener>();
  private link: BleLink | null = null;
  private unsub: (() => void)[] = [];
  private decoder: ClickDecoder | null = null;
  private learnSamples: LearnSample[] = [];
  private manualDisconnect = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private stopScan: (() => void) | null = null;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;
  private loaded = false;

  // ------------------------------------------------ store
  get state() {
    return this.s;
  }
  private set(p: Partial<BleState>) {
    this.s = { ...this.s, ...p };
    this.subs.forEach((f) => f());
  }
  subscribe = (f: () => void) => {
    this.subs.add(f);
    return () => {
      this.subs.delete(f);
    };
  };
  onClicks(f: ClickListener) {
    this.clickSubs.add(f);
    return () => {
      this.clickSubs.delete(f);
    };
  }
  private emitClicks(n: number, source: ClickSourceBle) {
    if (n <= 0) return;
    if (source === 'bluetooth') this.set({ clicksThisConnection: this.s.clicksThisConnection + n });
    this.clickSubs.forEach((f) => f(n, source));
  }
  private persist() {
    void saveJSON<Persisted>(KEY, { prefs: this.s.prefs, lastDevice: this.s.lastDevice, mappings: this.mappings, lastValues: this.lastValues, devices: this.s.devices });
  }

  async init() {
    if (this.loaded) return;
    this.loaded = true;
    const p = await loadJSON<Persisted | null>(KEY, null);
    if (p) {
      this.mappings = p.mappings ?? {};
      this.lastValues = p.lastValues ?? {};
      this.set({ prefs: { ...DEFAULT_PREFS, ...p.prefs }, lastDevice: p.lastDevice ?? null, devices: p.devices ?? (p.lastDevice ? [{ ...p.lastDevice, lastSeen: '' }] : []) });
    }
    this.applyHid();
    const availability = await transport.availability().catch((e: unknown) => ({ ok: false as const, kind: 'unsupported' as const, reason: String(e) }));
    this.set({ availability });
    // Reconnexion silencieuse au lancement (natif, ou web si le navigateur a mémorisé l'autorisation)
    const last = this.s.lastDevice;
    if (availability.ok && last && this.s.prefs.autoReconnect && (await transport.canReconnect(last.id).catch(() => false))) {
      void this.connectTo(last.id, true);
    }
  }
  async refreshAvailability() {
    const availability = await transport.availability();
    this.set({ availability });
    return availability;
  }

  setPrefs(p: Partial<Prefs>) {
    this.set({ prefs: { ...this.s.prefs, ...p } });
    this.persist();
    if ('hidEnabled' in p || 'hidKeys' in p) this.applyHid();
  }

  // ------------------------------------------------ découverte
  private requestedServices(): string[] {
    const cs = this.s.prefs.customService.trim();
    return servicesToRequest(profileById(this.s.prefs.profileId), cs && isValidUuid(cs) ? [cs] : []);
  }
  /** Web : sélecteur du navigateur (doit être appelé depuis un geste utilisateur). */
  async choose(acceptAll = true) {
    this.set({ error: null });
    try {
      const prof = profileById(this.s.prefs.profileId);
      const id = await transport.choose!({ services: this.requestedServices(), namePrefixes: prof.namePrefixes, acceptAll: acceptAll || prof.namePrefixes.length === 0 });
      await this.connectTo(id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/cancel|chosen|NotFoundError/i.test(msg)) return this.set({ status: this.link ? 'connecté' : 'déconnecté' });
      this.set({ status: 'erreur', error: msg });
    }
  }
  async startScan() {
    if (!transport.scan) return;
    const av = await this.refreshAvailability();
    if (!av.ok) return;
    this.stopScanning();
    this.set({ scanning: true, scanResults: [], error: null });
    const seen = new Map<string, ScanResult>();
    try {
      this.stopScan = await transport.scan(
        (r) => {
          const prev = seen.get(r.id);
          const name = r.name ?? prev?.name ?? null;
          const services = [...new Set([...(prev?.services ?? []), ...(r.services ?? [])])];
          const lk = likelyCounter(name, services);
          const known = this.s.devices.some((d) => d.id === r.id);
          seen.set(r.id, { ...prev, ...r, name, services, likely: lk.likely || known, reason: known ? 'déjà associé' : lk.reason });
          const list = [...seen.values()].sort((a, b) => Number(!!b.likely) - Number(!!a.likely) || Number(!!b.name) - Number(!!a.name) || (b.rssi ?? -999) - (a.rssi ?? -999));
          this.set({ scanResults: list.slice(0, 60) });
        },
        (e) => this.set({ error: e.message, scanning: false }),
      );
      setTimeout(() => this.stopScanning(), 15000);
    } catch (e) {
      this.set({ scanning: false, error: e instanceof Error ? e.message : String(e) });
    }
  }
  stopScanning() {
    this.stopScan?.();
    this.stopScan = null;
    if (this.s.scanning) this.set({ scanning: false });
  }

  // ------------------------------------------------ connexion
  async connectTo(id: string, silent = false) {
    this.stopScanning();
    this.clearReconnect();
    await this.teardown();
    this.manualDisconnect = false;
    this.set({ status: silent ? 'reconnexion' : 'connexion', error: null });
    try {
      const link = await transport.connect(id, { services: this.requestedServices() });
      this.link = link;
      this.unsub.push(link.onDisconnect(() => this.handleDisconnect()));
      const chosen = profileById(this.s.prefs.profileId);
      const profile = chosen.id === 'auto' ? detectProfile(link.name, link.chars) : chosen;
      const mapping = this.mappings[link.id] ?? defaultMapping(profile, link.chars);
      const device = { id: link.id, name: link.name };
      const devices = [{ ...device, lastSeen: new Date().toISOString() }, ...this.s.devices.filter((d) => d.id !== link.id)].slice(0, 8);
      const needsConfirm = !this.mappings[link.id]?.learnedAt && (!mapping || profile.id === 'generic' || profile.id === 'auto');
      this.autoFrames.clear();
      this.set({ status: 'connecté', device, lastDevice: device, devices, profile, mapping, attempt: 0, clicksThisConnection: 0, notifyCount: 0, lastHex: null, needsConfirm });
      this.persist();
      this.decoder = mapping ? this.makeDecoder(mapping, profile, link.id) : null;
      await this.subscribeAll(link, profile);
      await this.readBattery(link);
      // Synchronisation : lit le total stocké dans l'appareil (si lisible) et n'ajoute que la différence.
      const mc = mapping && link.chars.find((c) => sameUuid(c.service, mapping.service) && sameUuid(c.uuid, mapping.characteristic));
      if (mapping?.mode === 'absolute' && mc?.read) {
        const v = await link.read(mc.service, mc.uuid);
        if (v && v.length) this.onNotify(mc.service, mc.uuid, v, profile);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await this.teardown();
      if (silent && this.s.prefs.autoReconnect && !this.manualDisconnect) return this.scheduleReconnect(id);
      this.set({ status: 'erreur', error: `Connexion impossible : ${msg}` });
    }
  }
  private makeDecoder(m: Mapping, profile: DeviceProfile, deviceId: string) {
    const stored = m.mode === 'absolute' ? (this.lastValues[deviceId] ?? null) : null;
    return new ClickDecoder(m, profile.parse ?? profileById('generic').parse, Date.now(), stored);
  }
  private rememberValue() {
    const id = this.s.device?.id;
    const v = this.decoder?.lastValue;
    if (!id || v == null || this.lastValues[id] === v) return;
    this.lastValues[id] = v;
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => this.persist(), 800);
  }
  private async subscribeAll(link: BleLink, profile: DeviceProfile) {
    const targets = candidateChars(link.chars);
    for (const c of targets) {
      try {
        const off = await link.subscribe(c.service, c.uuid, (b) => this.onNotify(c.service, c.uuid, b, profile));
        this.unsub.push(off);
      } catch {
        /* caractéristique refusée (liste de blocage web, chiffrement…) : ignorée */
      }
    }
    if (targets.length === 0) this.set({ error: 'Aucune caractéristique de notification accessible. Sur le web, ajoutez l’UUID du service ci-dessous ; si c’est un anneau-télécommande, utilisez le mode clavier.' });
  }
  private async readBattery(link: BleLink) {
    const c = link.chars.find((x) => sameUuid(x.service, STD.battery) && sameUuid(x.uuid, STD.batteryLevel));
    if (!c) return this.set({ battery: null });
    const b = await link.read(c.service, c.uuid);
    if (b && b.length) this.set({ battery: b[0] });
    if (c.notify) {
      try {
        this.unsub.push(await link.subscribe(c.service, c.uuid, (v) => v.length && this.set({ battery: v[0] })));
      } catch {
        /* lecture seule */
      }
    }
  }
  private onNotify(service: string, characteristic: string, b: Bytes, profile: DeviceProfile) {
    this.set({ notifyCount: this.s.notifyCount + 1, lastHex: `${characteristic.slice(4, 8)} · ${toHex(b)}`, lastAt: Date.now() });
    if (this.s.learn.active) {
      this.learnSamples.push({ service, characteristic, bytes: b });
      this.set({ learn: { ...this.s.learn, received: this.learnSamples.length } });
      // Confirmation automatique dès que N trames d'un compteur absolu ont été reçues.
      const r = analyzeLearn(this.learnSamples, this.s.learn.presses, profile.parse);
      if (r.ok && r.mapping.mode === 'absolute' && r.confidence === 'haute') this.finishLearn();
      return;
    }
    let m = this.s.mapping;
    if (!m) {
      // Aucune correspondance : on cherche automatiquement un champ compteur (profil connu, entier 1–4 octets ou nombre ASCII).
      const p = profile.parse(b);
      if (p && p.kind === 'absolute') {
        m = { service: normUuid(service), characteristic: normUuid(characteristic), mode: 'absolute', byteIndex: -1, auto: true };
      } else {
        const key = normUuid(service) + '|' + normUuid(characteristic);
        const frames = [...(this.autoFrames.get(key) ?? []), b].slice(-4);
        this.autoFrames.set(key, frames);
        const field = frames.length >= 3 ? detectCounterField(frames) : null;
        if (!field) return;
        m = { service: normUuid(service), characteristic: normUuid(characteristic), mode: 'absolute', field, auto: true };
        // les appuis ayant servi à la détection sont comptés (sauf la première trame, qui sert de référence)
        this.emitClicks(frames.length - 1, 'bluetooth');
      }
      const devId = this.s.device?.id;
      this.decoder = new ClickDecoder(m, profile.parse, 0, devId && !m.field ? (this.lastValues[devId] ?? null) : null);
      if (devId) this.mappings[devId] = m;
      this.set({ mapping: m, needsConfirm: true });
      this.persist();
      if (m.field) {
        this.decoder.feed(b);
        this.rememberValue();
        return;
      }
    }
    if (!sameUuid(m.characteristic, characteristic) || !sameUuid(m.service, service) || !this.decoder) return;
    const n = this.decoder.feed(b);
    if (this.decoder.lastWasSync && n > 0) this.set({ lastSync: { added: n, at: Date.now() } });
    this.emitClicks(n, 'bluetooth');
    this.rememberValue();
  }
  private handleDisconnect() {
    const id = this.s.device?.id;
    void this.teardown();
    if (!this.manualDisconnect && this.s.prefs.autoReconnect && id) return this.scheduleReconnect(id);
    this.set({ status: 'déconnecté', battery: null });
  }
  private scheduleReconnect(id: string) {
    const delay = reconnectDelay(this.s.attempt);
    if (delay == null) return this.set({ status: 'erreur', error: 'Appareil hors de portée : reconnexion abandonnée. Appuyez sur « Reconnecter ».', attempt: 0 });
    this.set({ status: 'reconnexion', attempt: this.s.attempt + 1 });
    this.reconnectTimer = setTimeout(() => void this.connectTo(id, true), delay);
  }
  private clearReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }
  private async teardown() {
    this.unsub.splice(0).forEach((f) => {
      try {
        f();
      } catch {
        /* ignoré */
      }
    });
    const l = this.link;
    this.link = null;
    this.decoder = null;
    if (l) await l.disconnect().catch(() => {});
  }
  async reconnect() {
    const id = this.s.device?.id ?? this.s.lastDevice?.id;
    if (!id) return;
    this.set({ attempt: 0 });
    if (!(await transport.canReconnect(id))) return this.choose(true);
    await this.connectTo(id);
  }
  async disconnect() {
    this.manualDisconnect = true;
    this.clearReconnect();
    await this.teardown();
    this.set({ status: 'déconnecté', battery: null, attempt: 0 });
  }
  forget() {
    const id = this.s.device?.id ?? this.s.lastDevice?.id;
    if (id) {
      delete this.mappings[id];
      delete this.lastValues[id];
    }
    void this.disconnect();
    this.set({ device: null, lastDevice: null, mapping: null, profile: null, devices: this.s.devices.filter((d) => d.id !== id), needsConfirm: false });
    this.persist();
  }
  /** Fait vibrer l'anneau BSTWSH (commande documentée AA 05 01 / AA 05 00). */
  async vibrate() {
    const l = this.link;
    if (!l?.write || this.s.profile?.id !== 'bstwsh') return;
    const svc = normUuid('ae30');
    const ch = normUuid('ae03');
    await l.write(svc, ch, new Uint8Array([0xaa, 0x05, 0x01])).catch(() => {});
    setTimeout(() => void l.write?.(svc, ch, new Uint8Array([0xaa, 0x05, 0x00])).catch(() => {}), 400);
  }

  // ------------------------------------------------ apprentissage
  setLearnPresses(presses: number) {
    this.set({ learn: { ...this.s.learn, presses } });
  }
  startLearn(presses: number) {
    this.learnSamples = [];
    this.set({ learn: { active: true, presses, received: 0, result: null } });
  }
  finishLearn(): LearnResult {
    const presses = this.s.learn.presses;
    const res = analyzeLearn(this.learnSamples, presses, this.s.profile?.parse);
    this.set({ learn: { active: false, presses, received: this.learnSamples.length, result: res } });
    if (res.ok && this.s.device) {
      this.mappings[this.s.device.id] = res.mapping;
      this.decoder = new ClickDecoder(res.mapping, this.s.profile?.parse ?? profileById('generic').parse, 0);
      this.set({ mapping: res.mapping, needsConfirm: false });
      this.persist();
    }
    return res;
  }
  cancelLearn() {
    this.set({ learn: { ...this.s.learn, active: false, result: null } });
  }

  // ------------------------------------------------ clavier HID
  private applyHid() {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    if (this.keyHandler) window.removeEventListener('keydown', this.keyHandler, true);
    this.keyHandler = null;
    if (!this.s.prefs.hidEnabled && !this.s.capturingKey) return;
    this.keyHandler = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const editable = !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
      if (this.s.capturingKey && !editable && !e.repeat) {
        e.preventDefault();
        const keys = this.s.prefs.hidKeys.includes(e.key) ? this.s.prefs.hidKeys : [...this.s.prefs.hidKeys, e.key];
        this.set({ capturingKey: false, lastKey: e.key });
        this.setPrefs({ hidKeys: keys, hidEnabled: true });
        return;
      }
      if (!this.s.prefs.hidEnabled) return;
      if (!isCounterKey({ key: e.key, repeat: e.repeat, ctrlKey: e.ctrlKey, metaKey: e.metaKey, altKey: e.altKey, targetIsEditable: editable }, this.s.prefs.hidKeys)) return;
      // Espace/Entrée sur un bouton focalisé déclencheraient aussi un clic : on bloque.
      e.preventDefault();
      e.stopPropagation();
      this.set({ lastKey: e.key });
      this.emitClicks(1, 'clavier');
    };
    window.addEventListener('keydown', this.keyHandler, true);
  }
  /** Natif : touche reçue d'un clavier / anneau-télécommande HID (champ de capture de l'écran Bluetooth). */
  nativeKey(key: string) {
    if (this.s.capturingKey) {
      const keys = this.s.prefs.hidKeys.includes(key) ? this.s.prefs.hidKeys : [...this.s.prefs.hidKeys, key];
      this.set({ capturingKey: false, lastKey: key });
      this.setPrefs({ hidKeys: keys, hidEnabled: true });
      return;
    }
    if (!this.s.prefs.hidEnabled || !this.s.prefs.hidKeys.includes(key)) return;
    this.set({ lastKey: key });
    this.emitClicks(1, 'clavier');
  }
  captureKey() {
    this.set({ capturingKey: true });
    this.applyHid();
  }
  resetKeys() {
    this.setPrefs({ hidKeys: DEFAULT_HID_KEYS });
  }

  // ------------------------------------------------ test sans appareil
  simulate() {
    this.emitClicks(1, 'simulation');
  }
}

export const bleCounter = new BleCounterManager();
export const bleTransportPlatform = transport.platform;
export function useBleCounter(): BleState {
  return useSyncExternalStore(bleCounter.subscribe, () => bleCounter.state, () => bleCounter.state);
}
