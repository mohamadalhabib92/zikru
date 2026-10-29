import type { Bytes, GattChar } from './core';

export type Availability = { ok: true } | { ok: false; reason: string; kind: 'unsupported' | 'disabled' | 'denied' | 'expo-go' };
export type ScanResult = {
  id: string;
  name: string | null;
  rssi: number | null;
  services?: string[];
  likely?: boolean;
  reason?: string | null;
  /** Apparence GAP annoncée (Android : lue dans l'annonce brute ; iOS ne l'expose pas). */
  appearance?: number | null;
  manufacturerId?: number | null;
  manufacturerData?: Bytes | null;
  /** Liste autorisée : compteur de dhikr, écouteurs, ou autre (masqué par défaut). */
  kind?: 'counter' | 'audio' | 'other';
};

/** Liaison active avec un appareil (identique sur web et natif). */
export interface BleLink {
  id: string;
  name: string | null;
  chars: GattChar[];
  /** MTU négocié (Android ; iOS le négocie seul). */
  mtu?: number | null;
  subscribe(service: string, characteristic: string, cb: (b: Bytes) => void): Promise<() => void>;
  read(service: string, characteristic: string): Promise<Bytes | null>;
  write?(service: string, characteristic: string, data: Bytes): Promise<void>;
  onDisconnect(cb: () => void): () => void;
  disconnect(): Promise<void>;
}

export type ConnectOpts = {
  services: string[];
  /** Délai max (ms) d'une tentative directe. */
  timeoutMs?: number;
  /**
   * Connexion « en attente » sans délai : iOS garde la demande CoreBluetooth active (y compris en
   * arrière-plan, mode bluetooth-central) et connecte dès que l'appareil réapparaît ; Android : autoConnect.
   */
  wait?: boolean;
};

/** Abstraction commune : Web Bluetooth (sélecteur du navigateur) ou react-native-ble-plx (scan). */
export interface BleTransport {
  platform: 'web' | 'native';
  /** web = le navigateur affiche son propre sélecteur ; native = scan dans l'app. */
  mode: 'chooser' | 'scan';
  /** prompt=false : ne déclenche aucune demande d'autorisation (reconnexion silencieuse). */
  availability(opts?: { prompt?: boolean }): Promise<Availability>;
  /** Web : ouvre le sélecteur du navigateur, puis connecte. */
  choose?(opts: { services: string[]; namePrefixes: string[]; filterServices?: string[]; acceptAll: boolean }): Promise<string>;
  /** Natif : scan BLE ; renvoie une fonction d'arrêt. */
  scan?(onResult: (r: ScanResult) => void, onError: (e: Error) => void, opts?: { services?: string[] }): Promise<() => void>;
  /** État brut de l'adaptateur (diagnostic) : PoweredOn, Unauthorized, Unknown… */
  rawState?(): Promise<string>;
  connect(id: string, opts: ConnectOpts): Promise<BleLink>;
  /** Annule une connexion en cours / en attente. */
  cancel?(id: string): Promise<void>;
  /** Peut-on se reconnecter sans geste utilisateur (web : appareil déjà autorisé) ? */
  canReconnect(id: string): Promise<boolean>;
  /** Le transport sait-il reconnecter sans geste utilisateur ? (web : navigator.bluetooth.getDevices) */
  silentReconnectSupported(): boolean;
  /** Bluetooth activé / désactivé (natif : état CoreBluetooth / Android ; web : availabilitychanged). */
  onStateChange?(cb: (on: boolean) => void): () => void;
  /** Recherche courte d'un appareil mémorisé (natif : scan ; web : watchAdvertisements). */
  findKnown?(match: (r: ScanResult) => boolean, ms: number): Promise<ScanResult | null>;
  /** iOS : appareils restaurés par CoreBluetooth (restauration d'état) au relancement en arrière-plan. */
  onRestore?(cb: (ids: string[]) => void): () => void;
}
