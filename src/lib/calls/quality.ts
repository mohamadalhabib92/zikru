/**
 * Cibles mesurables d’un appel de groupe. Pas de LiveKit ici : les nombres sont testés seuls.
 * Le chiffrement de bout en bout n’est pas activé : le média reste chiffré en transit, pas encore de bout en bout.
 */

export const E2EE_ENABLED = false;

/** Opus voix (preset « speech » du SDK : 24 kbit/s). Mono pour que le DTX s’applique. */
export const AUDIO = {
  codec: 'opus' as const,
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  channelCount: 1,
  /** Discontinuous transmission : presque rien quand personne ne parle. */
  dtx: true,
  /** Redundant audio : un second paquet pour les réseaux qui perdent des données. */
  red: true,
  maxBitrate: 24_000,
} as const;

/** Plafonds d’image. Le 720p est réservé au tête-à-tête ou à l’orateur ; la grille reste en 360p. */
export const VIDEO = {
  speaker: { width: 1280, height: 720, maxBitrate: 1_200_000, maxFramerate: 30 },
  grid: { width: 640, height: 360, maxBitrate: 450_000, maxFramerate: 24 },
  low: { width: 320, height: 180, maxBitrate: 160_000, maxFramerate: 15 },
  /** Couches envoyées en plus de la couche haute, de la plus basse à la plus haute. */
  simulcastBelow720: [
    { width: 320, height: 180, maxBitrate: 160_000, maxFramerate: 15 },
    { width: 640, height: 360, maxBitrate: 450_000, maxFramerate: 20 },
  ],
  primaryCodec: 'vp8' as const,
  backupCodec: 'h264' as const,
  /** VP9 et AV1 (SVC) ne sont pas le défaut : compatibilité inégale, surtout avec le chiffrement de bout en bout. */
  svcCodecsConsidered: ['vp9', 'av1'] as const,
} as const;

export type DataMode = 'standard' | 'low-data';

export type CaptureProfile = {
  width: number;
  height: number;
  maxBitrate: number;
  maxFramerate: number;
  simulcast: boolean;
};

/** 1 ou 2 personnes : 720p. À partir de 3 : 360p. Économie de données : 180p, une seule couche. */
export function captureProfile(mode: DataMode, participants: number): CaptureProfile {
  if (mode === 'low-data') return { ...VIDEO.low, simulcast: false };
  if (participants <= 2) return { ...VIDEO.speaker, simulcast: true };
  return { ...VIDEO.grid, simulcast: true };
}

/**
 * Reprise après coupure ou changement de réseau (Wi-Fi ↔ 4G).
 * Premier essai tout de suite, puis 0,2 s, 0,5 s, 1 s, 2 s, 4 s. Au-delà, on abandonne.
 */
export const RECONNECT_DELAYS_MS = [0, 200, 500, 1_000, 2_000, 4_000] as const;

export function reconnectDelaysMs(): number[] {
  return [...RECONNECT_DELAYS_MS];
}

/** Débit montant utile, hors frais de paquet, d’après les plafonds ci-dessus. */
export function uplinkBitsPerSecond(mode: DataMode, participants: number): number {
  const video = captureProfile(mode, participants);
  const layers = video.simulcast
    ? VIDEO.simulcastBelow720.filter((l) => l.height < video.height).reduce((s, l) => s + l.maxBitrate, 0)
    : 0;
  return AUDIO.maxBitrate + video.maxBitrate + layers;
}
