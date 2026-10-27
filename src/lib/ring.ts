/**
 * RingService — architecture prête pour un anneau BLE (compteur de dhikr).
 * Aucune connexion matérielle réelle n'existe pour l'instant : seule l'implémentation
 * MockRingService est fournie, toujours affichée avec le badge « Simulation ».
 * Pour le vrai matériel : implémenter cette interface (ex. react-native-ble-plx, build natif).
 */
export type RingEvent = { type: 'tap' } | { type: 'battery'; level: number } | { type: 'status'; connected: boolean };
export interface RingService {
  readonly isMock: boolean;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  battery(): Promise<number | null>;
  subscribe(cb: (e: RingEvent) => void): () => void;
}

export class MockRingService implements RingService {
  readonly isMock = true;
  private connected = false;
  private level = 82;
  private subs = new Set<(e: RingEvent) => void>();
  private emit(e: RingEvent) {
    this.subs.forEach((s) => s(e));
  }
  async connect() {
    await new Promise((r) => setTimeout(r, 600));
    this.connected = true;
    this.emit({ type: 'status', connected: true });
  }
  async disconnect() {
    this.connected = false;
    this.emit({ type: 'status', connected: false });
  }
  async battery() {
    return this.connected ? this.level : null;
  }
  /** Simule un appui sur l'anneau (bouton dans l'écran Anneau). */
  simulateTap() {
    if (this.connected) this.emit({ type: 'tap' });
  }
  subscribe(cb: (e: RingEvent) => void) {
    this.subs.add(cb);
    return () => {
      this.subs.delete(cb);
    };
  }
  get isConnected() {
    return this.connected;
  }
}
export const ring = new MockRingService();
