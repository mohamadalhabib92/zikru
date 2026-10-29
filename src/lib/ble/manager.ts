/**
 * Gestionnaire du compteur Bluetooth : connexion, profil, décodage des appuis, batterie,
 * reconnexion automatique, mode apprentissage et mode clavier (HID).
 * Même code pour web et natif : seule la couche `transport` change (transport.ts / transport.native.ts).
 */
import { useSyncExternalStore } from 'react';
import { AppState, Platform, type AppStateStatus } from 'react-native';
import { loadJSON, saveJSON } from '../storage';
import { diag, errMsg } from './diag';
import { bleMsg, friendlyBleError } from './messages';
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
  autoConnectAllowed,
  classifyDevice,
  COUNTER_NAME_PREFIXES,
  COUNTER_SERVICES,
  isDeviceVisible,
  connectRetryDelay,
  keeperDelay,
  keeperPlan,
  matchKnown,
  normUuid,
  profileById,
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
/** auto : reconnexion automatique de cet appareil (par défaut activée). services : vus au scan (repli si l'identifiant change). */
export type KnownDevice = { id: string; name: string | null; lastSeen: string; auto?: boolean; services?: string[] };
/** État de la reconnexion automatique aux appareils mémorisés (puce d'état). */
export type AutoState = 'inactif' | 'recherche' | 'bt-off' | 'action' | 'indisponible' | 'connecté';
type Persisted = { prefs: Prefs; lastDevice: { id: string; name: string | null } | null; mappings: Record<string, Mapping>; lastValues?: Record<string, number>; devices?: KnownDevice[]; ignoredIds?: string[] };

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
  auto: AutoState;
  /** Nom de l'appareil recherché (puce « Recherche du compteur… »). */
  autoTarget: string | null;
  /**
   * Appareil du même nom/service qu'un appareil mémorisé mais avec un autre identifiant (audit H8) :
   * jamais adopté en silence, l'utilisateur confirme « C'est le mien » ou « Ce n'est pas le mien ».
   */
  similar: { oldId: string; id: string; name: string | null; rssi: number | null; by: 'nom' | 'service' } | null;
  /** Liste autorisée : appareils ni compteurs ni écouteurs masqués pendant le dernier scan. */
  hiddenCount: number;
  /** « Afficher tous les appareils » (écran Diagnostic seulement, non mémorisé : revient à la liste stricte au redémarrage). */
  showAllDevices: boolean;
};

const DEFAULT_PREFS: Prefs = { profileId: 'auto', customService: '', hidEnabled: Platform.OS === 'web', hidKeys: DEFAULT_HID_KEYS, sound: true, haptics: true, autoReconnect: true };
const KEY = 'ble-counter';

/** cursor : valeur absolue de l'appareil après ces appuis (compteur « absolu ») — enregistrée AVEC le compte. */
export type BleCursor = { id: string; value: number };
type ClickListener = (n: number, source: ClickSourceBle, cursor?: BleCursor) => void;
/**
 * Mémoire des valeurs absolues déjà comptées, tenue par le magasin du tasbih (même écriture atomique que le compte) :
 * après un arrêt brutal, la reconnexion ne recompte jamais des appuis déjà enregistrés.
 */
export type CursorStore = { get: (id: string) => number | undefined; set: (c: BleCursor) => void; drop: (id: string) => void };

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
    auto: 'inactif',
    autoTarget: null,
    similar: null,
    hiddenCount: 0,
    showAllDevices: false,
  };
  private lastValues: Record<string, number> = {};
  /** Identifiants refusés (« ce n'est pas mon compteur ») : jamais proposés ni connectés automatiquement. */
  private ignoredIds: string[] = [];
  /** iOS : appareils restaurés par CoreBluetooth, essayés en premier. */
  private restored = new Set<string>();
  /** La dernière tentative a échoué parce qu'elle était devenue obsolète (annulée), pas pour une erreur radio. */
  private lastFailStale = false;
  /** Tous les appareils vus au dernier scan (la liste affichée en est le sous-ensemble autorisé). */
  private scanSeen = new Map<string, ScanResult>();
  private autoFrames = new Map<string, Bytes[]>();
  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  private mappings: Record<string, Mapping> = {};
  private subs = new Set<() => void>();
  private clickSubs = new Set<ClickListener>();
  private cursors: CursorStore | null = null;
  private link: BleLink | null = null;
  private unsub: (() => void)[] = [];
  private decoder: ClickDecoder | null = null;
  private learnSamples: LearnSample[] = [];
  private manualDisconnect = false;
  // reconnexion automatique (« gardien »)
  private keeperOn = false;
  private keeperTimer: ReturnType<typeof setTimeout> | null = null;
  private keeperAttempt = 0;
  private ensuring = false;
  private keeperOffs: (() => void)[] = [];
  /** Appareils déconnectés à la main : pas de reconnexion automatique pendant cette session. */
  private paused = new Set<string>();
  /** Jeton de connexion : ignore le résultat d'une tentative devenue obsolète. */
  private connectSeq = 0;
  /** Incrémenté à chaque action manuelle : interrompt un cycle automatique en cours. */
  private manualEpoch = 0;
  /** Connexion « en attente » (iOS/Android) vers cet appareil, active en arrière-plan. */
  private pendingId: string | null = null;
  private appState: AppStateStatus = (AppState.currentState as AppStateStatus | null) ?? 'active';
  private pendingSeq = 0;
  private stopScan: (() => void) | null = null;
  private scanTimer: ReturnType<typeof setTimeout> | null = null;
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
  /** Branche la mémoire durable des curseurs (fournie par le magasin du tasbih). */
  setCursorStore(c: CursorStore | null) {
    this.cursors = c;
  }
  /** Dernière valeur comptée pour un appareil : celle du magasin durable d'abord, sinon l'ancienne mémoire locale. */
  private storedValue(id: string): number | null {
    return this.cursors?.get(id) ?? this.lastValues[id] ?? null;
  }
  private currentCursor(): BleCursor | undefined {
    const id = this.s.device?.id;
    const v = this.decoder?.lastValue;
    return id && v != null && this.s.mapping?.mode === 'absolute' ? { id, value: v } : undefined;
  }
  private emitClicks(n: number, source: ClickSourceBle, cursor?: BleCursor) {
    if (n <= 0) return;
    if (source === 'bluetooth') this.set({ clicksThisConnection: this.s.clicksThisConnection + n });
    this.clickSubs.forEach((f) => f(n, source, cursor));
  }
  private persist() {
    void saveJSON<Persisted>(KEY, { prefs: this.s.prefs, lastDevice: this.s.lastDevice, mappings: this.mappings, lastValues: this.lastValues, devices: this.s.devices, ignoredIds: this.ignoredIds });
  }

  async init() {
    if (this.loaded) return;
    this.loaded = true;
    const p = await loadJSON<Persisted | null>(KEY, null);
    if (p) {
      this.mappings = p.mappings ?? {};
      this.lastValues = p.lastValues ?? {};
      this.ignoredIds = p.ignoredIds ?? [];
      // Migration : l'ancien réglage global « Reconnexion automatique » devient un réglage par appareil.
      const legacyOff = p.prefs?.autoReconnect === false;
      const devices = (p.devices ?? (p.lastDevice ? [{ ...p.lastDevice, lastSeen: '' }] : [])).map((d) => ({ ...d, auto: d.auto ?? !legacyOff }));
      this.set({ prefs: { ...DEFAULT_PREFS, ...p.prefs, autoReconnect: true }, lastDevice: p.lastDevice ?? null, devices });
    }
    this.applyHid();
    // Aucun travail Bluetooth natif tant qu'aucun appareil n'est mémorisé (démarrage sûr, aucune demande d'autorisation).
    if (this.autoDevices().length > 0) this.startKeeper();
    else if (Platform.OS === 'web') this.set({ availability: await transport.availability({ prompt: false }).catch(() => null) });
  }
  async refreshAvailability() {
    const availability = await transport.availability().catch((e: unknown) => ({ ok: false as const, kind: 'unsupported' as const, reason: String(e) }));
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
  async choose(acceptAll = this.s.showAllDevices) {
    this.set({ error: null });
    try {
      const prof = profileById(this.s.prefs.profileId);
      // Liste autorisée : le sélecteur du navigateur ne montre que les compteurs (préfixes de nom ou service connu),
      // sauf « Afficher tous les appareils » activé dans le Diagnostic.
      const namePrefixes = prof.namePrefixes.length ? prof.namePrefixes : COUNTER_NAME_PREFIXES;
      const services = [...new Set([...this.requestedServices(), ...COUNTER_SERVICES])];
      const id = await transport.choose!({ services, namePrefixes, filterServices: COUNTER_SERVICES, acceptAll });
      await this.connectTo(id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/cancel|chosen|NotFoundError/i.test(msg)) return this.set({ status: this.link ? 'connecté' : 'déconnecté' });
      diag.error('choose', e);
      this.set({ status: 'erreur', error: friendlyBleError(e) });
    }
  }
  /** Liste affichée = appareils autorisés (compteurs, écouteurs, déjà associés), ou tous en mode diagnostic. */
  private publishScan() {
    const all = [...this.scanSeen.values()];
    const vis = all.filter((r) => isDeviceVisible(r.kind ?? 'other', { known: this.s.devices.some((d) => d.id === r.id), showAll: this.s.showAllDevices }));
    const rank = (r: ScanResult) => (r.likely ? 0 : r.kind === 'audio' ? 1 : 2);
    vis.sort((a, b) => rank(a) - rank(b) || Number(!!b.name) - Number(!!a.name) || (b.rssi ?? -999) - (a.rssi ?? -999));
    this.set({ scanResults: vis.slice(0, 60), hiddenCount: all.length - vis.length });
  }
  /** Diagnostic : afficher aussi les appareils hors liste autorisée (dépannage). Non mémorisé. */
  setShowAllDevices(v: boolean) {
    diag.log('scan', v ? 'affichage de tous les appareils (diagnostic)' : 'liste autorisée stricte rétablie');
    this.set({ showAllDevices: v });
    this.publishScan();
  }
  /** opts.services : filtre de service (diagnostic) ; par défaut aucun filtre. */
  async startScan(opts: { services?: string[]; ms?: number } = {}) {
    if (!transport.scan) return;
    const av = await this.refreshAvailability();
    if (!av.ok) {
      diag.log('scan', `impossible : ${av.reason}`, 'warn');
      return;
    }
    this.stopScanning();
    this.set({ scanning: true, scanResults: [], hiddenCount: 0, error: null });
    const seen = new Map<string, ScanResult>();
    this.scanSeen = seen;
    try {
      this.stopScan = await transport.scan(
        (r) => {
          const prev = seen.get(r.id);
          const name = r.name ?? prev?.name ?? null;
          const services = [...new Set([...(prev?.services ?? []), ...(r.services ?? [])])];
          const appearance = r.appearance ?? prev?.appearance ?? null;
          const manufacturerId = r.manufacturerId ?? prev?.manufacturerId ?? null;
          const manufacturerData = r.manufacturerData ?? prev?.manufacturerData ?? null;
          const c0 = classifyDevice({ name, services, appearance, manufacturerId, manufacturerData });
          const cl = c0.kind === 'other' && prev?.kind && prev.kind !== 'other' ? { kind: prev.kind, reason: prev.reason ?? null } : c0;
          const lk = likelyCounter(name, services);
          const known = this.s.devices.some((d) => d.id === r.id);
          const likely = cl.kind === 'counter' || known;
          seen.set(r.id, { ...prev, ...r, name, services, appearance, manufacturerId, manufacturerData, kind: cl.kind, likely, reason: known ? 'déjà associé' : (cl.reason ?? lk.reason) });
          this.publishScan();
        },
        (e) => {
          this.stopScanning();
          this.set({ error: e.message, scanning: false });
        },
        opts.services?.length ? { services: opts.services } : undefined,
      );
      // Un seul minuteur actif : un ancien minuteur ne doit pas couper un nouveau scan.
      this.scanTimer = setTimeout(() => this.stopScanning(), opts.ms ?? 15000);
    } catch (e) {
      diag.error('scan', e);
      this.set({ scanning: false, error: bleMsg('scanFailed', { m: friendlyBleError(e) }) });
    }
  }
  stopScanning() {
    if (this.scanTimer) clearTimeout(this.scanTimer);
    this.scanTimer = null;
    this.stopScan?.();
    this.stopScan = null;
    if (this.s.scanning) this.set({ scanning: false });
  }

  // ------------------------------------------------ connexion
  async connectTo(id: string, silent = false, opts: { timeoutMs?: number; wait?: boolean } = {}, retry = 0): Promise<boolean> {
    // Liste autorisée : jamais de connexion de comptage à des écouteurs (gérés par le système) ;
    // en connexion automatique (silent), seulement un appareil déjà associé par l'utilisateur.
    const seenKind = this.scanSeen.get(id)?.kind;
    const isKnown = this.s.devices.some((d) => d.id === id);
    if (seenKind === 'audio' && !isKnown) {
      if (!silent) this.set({ error: 'Ce sont des écouteurs : ils se connectent dans les réglages Bluetooth du téléphone, pas comme compteur.' });
      return false;
    }
    if (silent && !isKnown) {
      diag.log('auto', `connexion automatique refusée : ${id} n’est pas un appareil associé`, 'warn');
      return false;
    }
    if (!silent && retry === 0) {
      this.manualEpoch++;
      this.paused.delete(id);
      this.clearKeeperTimer();
      this.cancelPending();
    }
    this.stopScanning();
    await this.teardown();
    this.manualDisconnect = false;
    this.lastFailStale = false;
    const seq = ++this.connectSeq;
    this.set({ status: silent ? 'reconnexion' : 'connexion', error: null });
    if (opts.wait) {
      this.pendingId = id;
      this.pendingSeq = seq;
    }
    try {
      const link = await transport.connect(id, { services: this.requestedServices(), timeoutMs: opts.timeoutMs, wait: opts.wait });
      if (seq !== this.connectSeq) {
        // tentative obsolète (action manuelle ou autre appareil entre-temps)
        this.lastFailStale = true;
        await link.disconnect().catch(() => {});
        return false;
      }
      this.link = link;
      this.unsub.push(link.onDisconnect(() => this.handleDisconnect(link)));
      const chosen = profileById(this.s.prefs.profileId);
      const profile = chosen.id === 'auto' ? detectProfile(link.name, link.chars) : chosen;
      const mapping = this.mappings[link.id] ?? defaultMapping(profile, link.chars);
      const prev = this.s.devices.find((d) => d.id === link.id);
      const name = link.name ?? prev?.name ?? null;
      const device = { id: link.id, name };
      const services = this.s.scanResults.find((r) => r.id === link.id)?.services ?? prev?.services;
      const known: KnownDevice = { ...device, lastSeen: new Date().toISOString(), auto: prev?.auto ?? true, ...(services?.length ? { services } : {}) };
      const devices = [known, ...this.s.devices.filter((d) => d.id !== link.id)].slice(0, 8);
      const needsConfirm = !this.mappings[link.id]?.learnedAt && (!mapping || profile.id === 'generic' || profile.id === 'auto');
      this.autoFrames.clear();
      this.keeperAttempt = 0;
      this.restored.delete(link.id);
      if (this.s.similar?.id === link.id) this.set({ similar: null });
      this.set({ status: 'connecté', device, lastDevice: device, devices, profile, mapping, attempt: 0, clicksThisConnection: 0, notifyCount: 0, lastHex: null, needsConfirm, auto: 'connecté', autoTarget: null });
      this.persist();
      this.decoder = mapping ? this.makeDecoder(mapping, profile, link.id) : null;
      // Réabonnement immédiat à la caractéristique apprise (et aux autres candidates).
      await this.subscribeAll(link, profile);
      await this.readBattery(link);
      // Synchronisation : lit le total stocké dans l'appareil (si lisible) et n'ajoute que la différence.
      const mc = mapping && link.chars.find((c) => sameUuid(c.service, mapping.service) && sameUuid(c.uuid, mapping.characteristic));
      if (mapping?.mode === 'absolute' && mc?.read && this.link === link) {
        const v = await link.read(mc.service, mc.uuid);
        if (v && v.length && this.link === link) this.onNotify(mc.service, mc.uuid, v, profile);
      }
      this.startKeeper();
      return true;
    } catch (e) {
      if (seq !== this.connectSeq) {
        this.lastFailStale = true;
        return false;
      }
      const msg = e instanceof Error ? e.message : String(e);
      diag.log('connect', `${silent ? 'reconnexion silencieuse' : 'connexion'} échouée : ${errMsg(e)}`, silent ? 'warn' : 'error');
      await this.teardown();
      // Connexion manuelle : les erreurs passagères (GATT 133, délai, déconnexion pendant la découverte)
      // sont retentées aussitôt — la 1re tentative réussit du point de vue de l'utilisateur.
      const again = !silent && !opts.wait ? connectRetryDelay(e, retry) : null;
      if (again != null) {
        diag.log('connect', `erreur passagère : nouvelle tentative ${retry + 1} dans ${again} ms`, 'warn');
        await new Promise((r) => setTimeout(r, again));
        if (seq !== this.connectSeq) return false;
        return this.connectTo(id, false, opts, retry + 1);
      }
      if (silent) {
        this.set({ status: 'reconnexion' });
        return false;
      }
      const f = friendlyBleError(e);
      this.set({ status: 'erreur', error: f === msg ? bleMsg('connectFailed', { m: msg }) : f });
      this.scheduleKeeper();
      return false;
    } finally {
      if (opts.wait && this.pendingSeq === seq) this.pendingId = null;
    }
  }
  private makeDecoder(m: Mapping, profile: DeviceProfile, deviceId: string) {
    const stored = m.mode === 'absolute' ? this.storedValue(deviceId) : null;
    return new ClickDecoder(m, profile.parse ?? profileById('generic').parse, Date.now(), stored);
  }
  private rememberValue() {
    const id = this.s.device?.id;
    const v = this.decoder?.lastValue;
    if (!id || v == null) return;
    // curseur durable : écrit avec le compte (aucune fenêtre de 200 ms où un arrêt brutal ferait recompter)
    if (this.s.mapping?.mode === 'absolute') this.cursors?.set({ id, value: v });
    if (this.lastValues[id] === v) return;
    this.lastValues[id] = v;
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => this.persist(), 200);
  }
  private async subscribeAll(link: BleLink, profile: DeviceProfile) {
    // Une seule fois par caractéristique (une double inscription — restauration iOS + reconnexion — doublerait les appuis).
    const seen = new Set<string>();
    const targets = candidateChars(link.chars).filter((c) => {
      const k = normUuid(c.service) + '|' + normUuid(c.uuid);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    let failed = 0;
    for (const c of targets) {
      try {
        const off = await link.subscribe(c.service, c.uuid, (b) => this.onNotify(c.service, c.uuid, b, profile));
        this.unsub.push(off);
      } catch (e) {
        // caractéristique refusée (liste de blocage web, chiffrement/appairage…) : signalée dans le diagnostic
        failed++;
        diag.log('notify', `${c.service} / ${c.uuid} refusée : ${errMsg(e)}`, 'warn');
      }
    }
    if (targets.length === 0) this.set({ error: bleMsg('noNotify') });
    else if (failed === targets.length) this.set({ error: bleMsg('subFailed', { n: failed }) });
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
      this.decoder = new ClickDecoder(m, profile.parse, 0, devId && !m.field ? this.storedValue(devId) : null);
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
    const ev = this.decoder.lastEvent;
    if (ev) diag.log('decode', ev === 'attente' ? `valeur inattendue ${toHex(b)} : en attente de confirmation` : ev === 'confirmé' ? `valeur confirmée : +${n}` : ev === 'parasite' ? 'trame parasite ignorée' : 'double livraison ignorée', ev === 'confirmé' ? 'info' : 'warn');
    if (this.decoder.lastWasSync && n > 0) this.set({ lastSync: { added: n, at: Date.now() } });
    this.emitClicks(n, 'bluetooth', this.currentCursor());
    this.rememberValue();
  }
  private handleDisconnect(link: BleLink) {
    if (this.link !== link) return; // ancienne liaison
    const id = link.id;
    void this.teardown();
    this.set({ battery: null });
    if (this.manualDisconnect || !this.isAuto(id)) {
      this.set({ status: 'déconnecté' });
      this.refreshAutoIdle();
      return;
    }
    // Hors de portée / éteint : on continue de chercher (sans limite), y compris en arrière-plan.
    this.set({ status: 'reconnexion', auto: 'recherche', autoTarget: link.name ?? this.s.device?.name ?? null });
    this.keeperAttempt = 0;
    if (this.inBackground()) this.waitFor(id);
    else this.kick();
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
  /** Bouton « Reconnecter » (web : rouvre le sélecteur si l'autorisation a été perdue). */
  async reconnect(id?: string) {
    const target = id ?? this.s.device?.id ?? this.s.lastDevice?.id ?? this.autoDevices()[0]?.id;
    if (!target) return;
    this.set({ attempt: 0 });
    if (!(await transport.canReconnect(target).catch(() => false))) return this.choose();
    await this.connectTo(target);
  }
  async disconnect() {
    this.manualEpoch++;
    this.manualDisconnect = true;
    const id = this.s.device?.id;
    if (id) this.paused.add(id);
    this.clearKeeperTimer();
    this.cancelPending();
    this.connectSeq++;
    await this.teardown();
    this.set({ status: 'déconnecté', battery: null, attempt: 0, auto: 'inactif', autoTarget: null });
  }
  /** Oublie un appareil mémorisé (par défaut l'appareil courant). */
  forget(id?: string) {
    const target = id ?? this.s.device?.id ?? this.s.lastDevice?.id;
    if (!target) return;
    delete this.mappings[target];
    delete this.lastValues[target];
    this.cursors?.drop(target);
    if (this.pendingId === target) this.cancelPending();
    const isCurrent = this.s.device?.id === target;
    if (isCurrent) void this.disconnect();
    this.paused.delete(target);
    this.set({
      devices: this.s.devices.filter((d) => d.id !== target),
      ...(isCurrent ? { device: null, mapping: null, profile: null, needsConfirm: false } : {}),
      ...(this.s.lastDevice?.id === target ? { lastDevice: null } : {}),
    });
    this.persist();
    if (!isCurrent) this.refreshAutoIdle();
  }
  /** Interrupteur « Reconnexion automatique » d'un appareil. */
  setDeviceAuto(id: string, auto: boolean) {
    this.set({ devices: this.s.devices.map((d) => (d.id === id ? { ...d, auto } : d)) });
    this.persist();
    if (auto) {
      this.paused.delete(id);
      this.startKeeper();
      this.kick();
    } else {
      if (this.pendingId === id) this.cancelPending();
      this.refreshAutoIdle();
    }
  }

  // ------------------------------------------------ reconnexion automatique aux appareils mémorisés
  private isAuto(id: string) {
    return this.s.devices.some((d) => d.id === id && d.auto !== false);
  }
  /** Appareils à reconnecter, du plus récent au plus ancien (hors appareils mis en pause). */
  private autoDevices() {
    return this.s.devices.filter((d) => d.auto !== false && !this.paused.has(d.id));
  }
  private inBackground() {
    return Platform.OS !== 'web' && this.appState !== 'active';
  }
  private startKeeper() {
    if (this.keeperOn) return;
    this.keeperOn = true;
    const app = AppState.addEventListener('change', (st) => this.onAppState(st));
    this.keeperOffs.push(() => app.remove());
    if (transport.onStateChange) {
      this.keeperOffs.push(
        transport.onStateChange((on) => {
          if (on) {
            this.set({ availability: { ok: true } });
            this.keeperAttempt = 0;
            this.kick();
          } else if (!this.link) {
            this.clearKeeperTimer();
            this.set({ availability: { ok: false, kind: 'disabled', reason: 'Bluetooth désactivé' }, auto: this.autoDevices().length ? 'bt-off' : 'inactif' });
          }
        }),
      );
    }
    // iOS : relance en arrière-plan par CoreBluetooth (restauration d'état) → reprise immédiate.
    if (transport.onRestore)
      this.keeperOffs.push(
        transport.onRestore((ids) => {
          if (!ids.length) return;
          ids.forEach((i) => this.restored.add(i));
          // reprise de l'appareil déjà connecté par iOS (pas de nouvelle connexion) : annule une attente éventuelle
          if (!this.link) {
            this.cancelPending();
            this.keeperAttempt = 0;
            this.kick();
          }
        }),
      );
    this.kick();
  }
  private onAppState(st: AppStateStatus) {
    const prev = this.appState;
    this.appState = st;
    if (st === 'active' && prev !== 'active') {
      // retour au premier plan : nouvelle recherche immédiate
      if (this.link) return;
      this.cancelPending();
      this.keeperAttempt = 0;
      this.kick();
    } else if (st !== 'active') {
      if (this.persistTimer) {
        clearTimeout(this.persistTimer);
        this.persist();
      }
      if (Platform.OS !== 'web' && !this.link && !this.ensuring) {
        // les minuteries JS sont suspendues en arrière-plan : connexion en attente gérée par le système
        this.clearKeeperTimer();
        const top = this.autoDevices()[0];
        if (top) this.waitFor(top.id);
      }
    }
  }
  /** Relance une recherche immédiatement. */
  kick() {
    this.clearKeeperTimer();
    void this.ensure();
  }
  private clearKeeperTimer() {
    if (this.keeperTimer) clearTimeout(this.keeperTimer);
    this.keeperTimer = null;
  }
  private cancelPending() {
    const id = this.pendingId;
    if (!id) return;
    this.pendingId = null;
    this.connectSeq++;
    void transport.cancel?.(id);
  }
  /** Connexion « en attente » (sans délai) : aboutit dès que l'appareil revient à portée, même app en arrière-plan. */
  private waitFor(id: string) {
    if (this.pendingId || this.link || !this.keeperOn) return;
    this.set({ auto: 'recherche', autoTarget: this.s.devices.find((d) => d.id === id)?.name ?? null });
    void this.connectTo(id, true, { wait: true }).then((ok) => {
      // Attente interrompue par une vraie erreur (Bluetooth coupé, lien refusé…) et non annulée : on ne reste pas bloqué.
      if (ok || this.lastFailStale || !this.keeperOn || this.link || this.pendingId) return;
      diag.log('keeper', 'connexion en attente interrompue : nouvelle recherche planifiée', 'warn');
      this.clearKeeperTimer();
      this.keeperTimer = setTimeout(() => {
        this.keeperTimer = null;
        void this.ensure();
      }, keeperDelay(this.keeperAttempt++));
    });
  }
  private scheduleKeeper() {
    if (!this.keeperOn || this.link) return;
    const cands = this.autoDevices();
    if (!cands.length) return this.refreshAutoIdle();
    this.clearKeeperTimer();
    if (this.inBackground()) return this.waitFor(cands[0].id);
    const plan = keeperPlan(this.keeperAttempt, { ios: Platform.OS === 'ios', devices: cands.length });
    // iOS, un seul appareil : demande « en attente » CoreBluetooth au lieu de cycles minutés (zéro scan, connexion immédiate au retour).
    if (plan.wait) return this.waitFor(cands[0].id);
    const delay = plan.delay;
    this.keeperAttempt++;
    this.keeperTimer = setTimeout(() => {
      this.keeperTimer = null;
      void this.ensure();
    }, delay);
  }
  private refreshAutoIdle() {
    if (this.link) return;
    if (!this.autoDevices().length) this.set({ auto: 'inactif', autoTarget: null });
  }
  /** Un cycle : vérifie le Bluetooth, tente chaque appareil mémorisé par identifiant, puis une courte recherche par nom/service. */
  private async ensure() {
    if (!this.keeperOn || this.ensuring || this.link || this.pendingId || this.s.status === 'connexion' || this.s.scanning) {
      if (this.s.scanning) this.scheduleKeeper();
      return;
    }
    const cands = this.autoDevices();
    if (!cands.length) return this.refreshAutoIdle();
    const epoch = this.manualEpoch;
    const stale = () => epoch !== this.manualEpoch || !!this.link || !this.keeperOn;
    this.ensuring = true;
    try {
      const av = await transport.availability({ prompt: false }).catch((e: unknown) => ({ ok: false as const, kind: 'unsupported' as const, reason: String(e) }));
      this.set({ availability: av });
      if (!av.ok) {
        if (av.kind === 'disabled') {
          this.set({ auto: 'bt-off', autoTarget: cands[0].name });
          // reprise automatique via onStateChange ; vérification lente en secours
          this.clearKeeperTimer();
          if (!this.inBackground()) this.keeperTimer = setTimeout(() => void this.ensure(), 15000);
        } else {
          this.set({ auto: 'indisponible', autoTarget: null });
        }
        return;
      }
      // Web : sans getDevices(), seule une action de l'utilisateur peut reconnecter.
      const usable: KnownDevice[] = [];
      for (const c of cands) if (await transport.canReconnect(c.id).catch(() => false)) usable.push(c);
      if (!transport.silentReconnectSupported() || !usable.length) {
        this.set({ auto: Platform.OS === 'web' ? 'action' : 'indisponible', autoTarget: cands[0].name });
        return;
      }
      this.set({ auto: 'recherche', autoTarget: usable[0].name, status: 'reconnexion' });
      // appareils restaurés par iOS d'abord (déjà connectés : simple reprise)
      usable.sort((a, b) => Number(this.restored.has(b.id)) - Number(this.restored.has(a.id)));
      for (const c of usable) {
        if (stale()) return;
        if (await this.connectTo(c.id, true, { timeoutMs: 8000 })) return;
      }
      if (stale()) return;
      // Identifiant changé (réinitialisation, autre téléphone) : courte recherche par nom ou service mémorisé —
      // seulement à certains cycles (scan radio coûteux en batterie) et jamais en arrière-plan.
      const plan = keeperPlan(this.keeperAttempt, { scanBlocked: this.inBackground() || !!this.s.similar });
      if (transport.findKnown && plan.scan) {
        // Par identifiant : appareil associé par l'utilisateur. Par nom/service : seulement un compteur de la liste autorisée.
        const okHit = (r: ScanResult) => {
          const mk = matchKnown(r, cands, this.ignoredIds);
          return !!mk && (mk.by === 'id' || classifyDevice(r).kind === 'counter');
        };
        const hit = await transport.findKnown(okHit, 8000).catch(() => null);
        if (stale()) return;
        const m = hit && okHit(hit) ? matchKnown(hit, cands, this.ignoredIds) : null;
        if (hit && m) {
          if (autoConnectAllowed(m)) {
            if (await this.connectTo(hit.id, true, { timeoutMs: 10000 })) return;
          } else if (m.by !== 'id') {
            // Même nom/service mais autre identifiant : peut être l'exemplaire d'un tiers (H8) → l'utilisateur confirme.
            diag.log('keeper', `appareil semblable « ${hit.name ?? hit.id} » (${m.by}) : confirmation demandée`, 'warn');
            this.set({ similar: { oldId: m.device.id, id: hit.id, name: hit.name, rssi: hit.rssi, by: m.by } });
          }
        }
      }
      if (stale()) return;
      this.set({ status: 'reconnexion', auto: 'recherche' });
      this.scheduleKeeper();
    } finally {
      this.ensuring = false;
    }
  }
  /** « C'est mon compteur » : adopte l'appareil semblable (nouvel identifiant) puis s'y connecte. */
  async confirmSimilar() {
    const sim = this.s.similar;
    if (!sim) return;
    this.set({ similar: null });
    this.migrateDevice(sim.oldId, sim.id, sim.name);
    await this.connectTo(sim.id);
  }
  /** « Ce n'est pas le mien » : cet identifiant ne sera plus jamais proposé ni connecté automatiquement. */
  rejectSimilar() {
    const sim = this.s.similar;
    if (!sim) return;
    this.ignoredIds = [sim.id, ...this.ignoredIds.filter((i) => i !== sim.id)].slice(0, 20);
    this.set({ similar: null });
    this.persist();
    diag.log('keeper', `appareil ${sim.id} ignoré (pas le vôtre)`);
  }
  /**
   * Reporte la correspondance apprise d'un ancien identifiant vers le nouveau. Le dernier total n'est PAS reporté :
   * le nouvel appareil part de sa propre valeur (référence), sans « rattrapage » calculé sur le total d'un autre
   * appareil (sinon une bague tierce ou remise à zéro pourrait ajouter des centaines d'appuis fictifs).
   */
  private migrateDevice(oldId: string, newId: string, name: string | null) {
    if (oldId === newId) return;
    if (this.mappings[oldId] && !this.mappings[newId]) this.mappings[newId] = this.mappings[oldId];
    this.cursors?.drop(oldId);
    this.cursors?.drop(newId);
    delete this.lastValues[newId];
    this.ignoredIds = this.ignoredIds.filter((i) => i !== newId);
    delete this.mappings[oldId];
    delete this.lastValues[oldId];
    this.set({
      devices: this.s.devices.map((d) => (d.id === oldId ? { ...d, id: newId, name: name ?? d.name } : d)),
      ...(this.s.lastDevice?.id === oldId ? { lastDevice: { id: newId, name: name ?? this.s.lastDevice.name } } : {}),
    });
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
