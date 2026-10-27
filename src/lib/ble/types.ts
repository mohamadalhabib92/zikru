import type { Bytes, GattChar } from './core';

export type Availability = { ok: true } | { ok: false; reason: string; kind: 'unsupported' | 'disabled' | 'denied' | 'expo-go' };
export type ScanResult = { id: string; name: string | null; rssi: number | null };

/** Liaison active avec un appareil (identique sur web et natif). */
export interface BleLink {
  id: string;
  name: string | null;
  chars: GattChar[];
  subscribe(service: string, characteristic: string, cb: (b: Bytes) => void): Promise<() => void>;
  read(service: string, characteristic: string): Promise<Bytes | null>;
  write?(service: string, characteristic: string, data: Bytes): Promise<void>;
  onDisconnect(cb: () => void): () => void;
  disconnect(): Promise<void>;
}

/** Abstraction commune : Web Bluetooth (sélecteur du navigateur) ou react-native-ble-plx (scan). */
export interface BleTransport {
  platform: 'web' | 'native';
  /** web = le navigateur affiche son propre sélecteur ; native = scan dans l'app. */
  mode: 'chooser' | 'scan';
  availability(): Promise<Availability>;
  /** Web : ouvre le sélecteur du navigateur, puis connecte. */
  choose?(opts: { services: string[]; namePrefixes: string[]; acceptAll: boolean }): Promise<string>;
  /** Natif : scan BLE ; renvoie une fonction d'arrêt. */
  scan?(onResult: (r: ScanResult) => void, onError: (e: Error) => void): Promise<() => void>;
  connect(id: string, opts: { services: string[] }): Promise<BleLink>;
  /** Peut-on se reconnecter sans geste utilisateur (web : appareil déjà autorisé) ? */
  canReconnect(id: string): Promise<boolean>;
}
