/**
 * Logique pure (sans React / React Native) du compteur Bluetooth de tasbih.
 * Testée par scripts/test-ble.mjs. Aucune UUID inventée : chaque profil cite sa source,
 * et les appareils dont le protocole n'est pas publié passent par le mode générique
 * ou le mode apprentissage.
 */

export type Bytes = Uint8Array;

// ---------------------------------------------------------------- UUID / octets
const BASE_SUFFIX = '-0000-1000-8000-00805f9b34fb';

/** Normalise une UUID (16 bits « ae30 », 0xae30 ou 128 bits) en forme longue minuscule. */
export function normUuid(u: string | number): string {
  if (typeof u === 'number') return u.toString(16).padStart(8, '0') + BASE_SUFFIX;
  const s = u.trim().toLowerCase().replace(/^0x/, '');
  if (/^[0-9a-f]{4}$/.test(s)) return '0000' + s + BASE_SUFFIX;
  if (/^[0-9a-f]{8}$/.test(s)) return s + BASE_SUFFIX;
  return s;
}
/** Forme courte lisible (« ae30 ») si l'UUID est dans la base Bluetooth SIG. */
export function shortUuid(u: string): string {
  const n = normUuid(u);
  return n.endsWith(BASE_SUFFIX) && n.startsWith('0000') ? n.slice(4, 8) : n;
}
export function sameUuid(a: string, b: string): boolean {
  return normUuid(a) === normUuid(b);
}
export function isValidUuid(u: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(normUuid(u));
}

export function toHex(b: Bytes): string {
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join(' ');
}
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
/** Décodage base64 (valeurs renvoyées par react-native-ble-plx), sans dépendance à Buffer/atob. */
export function b64ToBytes(s: string | null | undefined): Bytes {
  if (!s) return new Uint8Array(0);
  const clean = s.replace(/[^A-Za-z0-9+/]/g, '');
  const out: number[] = [];
  let buf = 0;
  let bits = 0;
  for (const ch of clean) {
    buf = (buf << 6) | B64.indexOf(ch);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push((buf >> bits) & 0xff);
    }
  }
  return new Uint8Array(out);
}
export function ascii(b: Bytes): string {
  return Array.from(b, (x) => (x >= 32 && x < 127 ? String.fromCharCode(x) : '\u0000')).join('');
}

// ---------------------------------------------------------------- UUID standard
export const STD = {
  battery: normUuid('180f'),
  batteryLevel: normUuid('2a19'),
  deviceInfo: normUuid('180a'),
  genericAccess: normUuid('1800'),
  genericAttribute: normUuid('1801'),
  hid: normUuid('1812'), // bloqué par Web Bluetooth (liste de blocage officielle)
};
/** Caractéristiques standard à ne jamais traiter comme « bouton » en mode générique. */
const IGNORED_CHARS = new Set(['2a19', '2a05', '2a00', '2a01', '2a04', '2a29', '2a24', '2a26', '2a27', '2a28', '2a37', '2a4d'].map(normUuid));
export function isIgnoredChar(uuid: string): boolean {
  return IGNORED_CHARS.has(normUuid(uuid));
}

// ---------------------------------------------------------------- Profils d'appareils
/** Résultat d'un décodeur : compteur absolu porté par la trame, ou simple impulsion (1 appui). */
export type Parsed = { kind: 'absolute'; value: number } | { kind: 'pulse' } | null;

export type DeviceProfile = {
  id: 'auto' | 'bstwsh' | 'iqibla' | 'generic';
  label: string;
  /** documenté = UUID + format publiés ; partiel = format publié mais pas toutes les UUID ; aucun = mode générique. */
  doc: 'documenté' | 'partiel' | 'aucun';
  namePrefixes: string[];
  /** Services à demander (Web Bluetooth : optionalServices). */
  services: string[];
  /** Caractéristique de notification connue, sinon découverte automatique / apprentissage. */
  notify?: { service: string; characteristic: string };
  parse: (b: Bytes) => Parsed;
  note: string;
  sources: string[];
};

/**
 * BSTWSH / anneaux « BW… » (app Android com.awesome.bstwsh).
 * Source : rétro-ingénierie publique de N. Enggaliano (2025) — service 0xAE30, notification 0xAE02,
 * écriture 0xAE03, batterie standard 0x180F/0x2A19, trame d'appui `AA 03 00 <compteur>`.
 * L'octet 2 vaut toujours 00 dans les captures publiées ; on le lit comme octet de poids fort (hypothèse).
 */
export function parseBstwsh(b: Bytes): Parsed {
  if (b.length >= 4 && b[0] === 0xaa && b[1] === 0x03) return { kind: 'absolute', value: (b[2] << 8) | b[3] };
  return null;
}

/**
 * iQibla Zikr Ring : trames texte ASCII publiées (même source), ex. « Q07,0012,59759507,0,0 »
 * pour un compteur à 12. Le 2e champ est le compteur (déduit des 3 trames publiées 12/13/14).
 * Les UUID de service/notification ne sont PAS publiées (seule l'écriture 0xD004 l'est) :
 * découverte automatique sur natif, mode apprentissage sinon.
 */
export function parseIqibla(b: Bytes): Parsed {
  const m = /^Q\d{1,3},(\d{1,6}),/.exec(ascii(b));
  return m ? { kind: 'absolute', value: parseInt(m[1], 10) } : null;
}

/** Décodeur générique : formats connus d'abord, sinon chaque notification = 1 appui. */
export function parseGeneric(b: Bytes): Parsed {
  return parseBstwsh(b) ?? parseIqibla(b) ?? { kind: 'pulse' };
}

export const NUS_SERVICE = '6e400001-b5a3-f393-e0a9-e50e24dcca9e'; // Nordic UART Service (spécification Nordic publique)
/** Services fréquents sur les accessoires BLE bon marché, demandés en mode générique (Web Bluetooth exige une liste). */
export const GENERIC_SERVICES = [NUS_SERVICE, normUuid('fff0'), normUuid('ffe0'), normUuid('ff00'), normUuid('ae30'), normUuid('fee7')];

export const PROFILES: DeviceProfile[] = [
  {
    id: 'auto',
    label: 'Détection automatique',
    doc: 'aucun',
    namePrefixes: [],
    services: [],
    parse: parseGeneric,
    note: 'Reconnaît le profil d’après le nom et les services de l’appareil, sinon passe en mode générique.',
    sources: [],
  },
  {
    id: 'bstwsh',
    label: 'Anneau tasbih BSTWSH (« BW… »)',
    doc: 'documenté',
    namePrefixes: ['BW'],
    services: [normUuid('ae30'), STD.battery],
    notify: { service: normUuid('ae30'), characteristic: normUuid('ae02') },
    parse: parseBstwsh,
    note: 'Compteur absolu transmis à chaque appui ; batterie via le service standard 0x180F.',
    sources: ['https://nikkoenggaliano.my.id/read.php?id=51'],
  },
  {
    id: 'iqibla',
    label: 'iQibla Zikr Ring (E01, Noor N01…)',
    doc: 'partiel',
    namePrefixes: [],
    services: [],
    parse: parseIqibla,
    note:
      'Format des trames publié, mais pas les UUID de service : utilisez la détection automatique (natif) ou le mode apprentissage. ' +
      'Le manuel iQibla indique que l’anneau ne synchronise ses comptes avec l’app qu’après remise à zéro : le comptage en direct peut ne pas fonctionner selon le firmware.',
    sources: ['https://nikkoenggaliano.my.id/read.php?id=51', 'https://manuals.plus/iqibla/e01-zikr-ring-manual'],
  },
  {
    id: 'generic',
    label: 'Compteur BLE générique',
    doc: 'aucun',
    namePrefixes: [],
    services: GENERIC_SERVICES,
    parse: parseGeneric,
    note: 'S’abonne aux caractéristiques « notify » et compte les changements. Utilisez le mode apprentissage si plusieurs caractéristiques bougent.',
    sources: [],
  },
];
export function profileById(id: string): DeviceProfile {
  return PROFILES.find((p) => p.id === id) ?? PROFILES[0];
}

export type GattChar = { service: string; uuid: string; notify: boolean; read: boolean };

/** Choix du profil réel une fois l'appareil connecté (mode « auto »). */
export function detectProfile(name: string | null | undefined, chars: GattChar[]): DeviceProfile {
  const n = (name ?? '').trim();
  for (const p of PROFILES) {
    if (p.id === 'auto' || p.id === 'generic') continue;
    if (p.namePrefixes.some((x) => n.toUpperCase().startsWith(x.toUpperCase()))) return p;
    if (p.notify && chars.some((c) => sameUuid(c.service, p.notify!.service) && sameUuid(c.uuid, p.notify!.characteristic))) return p;
  }
  if (/iqibla|zikr/i.test(n)) return profileById('iqibla');
  return profileById('generic');
}

/** Tous les services à autoriser dans Web Bluetooth (optionalServices) pour un profil donné. */
export function servicesToRequest(profile: DeviceProfile, extra: string[] = []): string[] {
  const all = profile.id === 'auto' ? PROFILES.flatMap((p) => p.services).concat(GENERIC_SERVICES) : profile.services.concat(profile.id === 'generic' ? [] : GENERIC_SERVICES);
  const set = new Set([...all, STD.battery, STD.deviceInfo, ...extra].map(normUuid).filter((u) => isValidUuid(u) && u !== STD.hid));
  return [...set];
}

// ---------------------------------------------------------------- Correspondance apprise
export type Mapping = {
  service: string;
  characteristic: string;
  mode: 'absolute' | 'pulse';
  /** absolu : position de l'octet compteur (ou -1 = décodeur du profil). */
  byteIndex?: number;
  /** absolu : champ compteur détecté automatiquement (entier 1–4 octets LE/BE, ou nombre en ASCII). */
  field?: CounterField;
  /** true = détecté automatiquement, pas encore confirmé par l'apprentissage. */
  auto?: boolean;
  /** impulsion : ne compter que les trames égales à cette signature (appui) — ignore les relâchements. */
  pressSignature?: string;
  /** impulsion sans signature : nombre de notifications par appui. */
  notifsPerClick?: number;
  learnedAt?: string;
};

/** Caractéristiques candidates au comptage (notify, non standard). */
export function candidateChars(chars: GattChar[]): GattChar[] {
  return chars.filter((c) => c.notify && !isIgnoredChar(c.uuid));
}

/** Correspondance par défaut sans apprentissage, ou null s'il faut apprendre (ambigu). */
export function defaultMapping(profile: DeviceProfile, chars: GattChar[]): Mapping | null {
  if (profile.notify) {
    const ok = chars.some((c) => sameUuid(c.service, profile.notify!.service) && sameUuid(c.uuid, profile.notify!.characteristic));
    if (ok) return { service: normUuid(profile.notify.service), characteristic: normUuid(profile.notify.characteristic), mode: 'absolute', byteIndex: -1 };
  }
  const cands = candidateChars(chars);
  if (cands.length === 1) return { service: normUuid(cands[0].service), characteristic: normUuid(cands[0].uuid), mode: 'pulse', byteIndex: -1 };
  return null;
}

// ---------------------------------------------------------------- Décodage des appuis
export const MAX_JUMP = 10;
export const BASELINE_GRACE_MS = 1500;

/**
 * Transforme les notifications d'une caractéristique en nombre d'appuis à ajouter.
 * - absolu : différence avec la valeur précédente (robuste aux notifications perdues),
 *   remise à zéro de l'appareil gérée, sauts aberrants plafonnés à 1 ;
 * - impulsion : 1 par trame (filtrée par signature ou divisée par notifsPerClick).
 */
export class ClickDecoder {
  private last: number | null = null;
  private pulses = 0;
  /** true si le dernier appel à feed() a rattrapé des appuis faits hors connexion. */
  lastWasSync = false;
  constructor(
    private mapping: Mapping,
    private parse: (b: Bytes) => Parsed,
    private subscribedAt = 0,
    /** Dernier total connu de l'appareil (mémorisé localement) : sert à la synchronisation à la reconnexion. */
    private stored: number | null = null,
  ) {}
  get lastValue(): number | null {
    return this.last;
  }
  /** Valeur absolue lue dans la trame selon la correspondance. */
  absoluteValue(b: Bytes): number | null {
    if (this.mapping.field) return readField(b, this.mapping.field);
    if (this.mapping.byteIndex != null && this.mapping.byteIndex >= 0) return b.length > this.mapping.byteIndex ? b[this.mapping.byteIndex] : null;
    const p = this.parse(b);
    return p && p.kind === 'absolute' ? p.value : null;
  }
  private maxValue(): number {
    if (this.mapping.field && 'len' in this.mapping.field) return 2 ** (8 * this.mapping.field.len) - 1;
    if (this.mapping.byteIndex != null && this.mapping.byteIndex >= 0) return 255;
    return Number.MAX_SAFE_INTEGER;
  }
  feed(b: Bytes, now = Date.now()): number {
    this.lastWasSync = false;
    if (this.mapping.mode === 'absolute') {
      const v = this.absoluteValue(b);
      if (v == null) return 0;
      const prev = this.last;
      this.last = v;
      if (prev == null) {
        // Première valeur de la connexion : synchronisation avec le total mémorisé (sans double comptage).
        if (this.stored != null) {
          const d = syncDelta(this.stored, v);
          this.stored = null;
          this.lastWasSync = d > 0;
          return d;
        }
        return now - this.subscribedAt < BASELINE_GRACE_MS ? 0 : v === 0 ? 0 : 1;
      }
      const d = v - prev;
      if (d === 0) return 0;
      if (d > 0) return d <= MAX_JUMP ? d : 1;
      // compteur revenu en arrière : débordement du champ, ou remise à zéro de l'appareil
      const max = this.maxValue();
      if (max < Number.MAX_SAFE_INTEGER && prev >= max - 5 && v <= 5) return v + max + 1 - prev;
      return v === 0 ? 0 : Math.min(v, MAX_JUMP);
    }
    if (this.mapping.pressSignature) return toHex(b) === this.mapping.pressSignature ? 1 : 0;
    const per = Math.max(1, this.mapping.notifsPerClick ?? 1);
    this.pulses++;
    if (this.pulses >= per) {
      this.pulses = 0;
      return 1;
    }
    return 0;
  }
}

/** Plafond de rattrapage (appuis hors connexion) : au-delà, on considère la valeur aberrante. */
export const SYNC_MAX = 100000;
/**
 * Appuis faits hors connexion : total actuel de l'appareil − dernier total mémorisé.
 * Si l'appareil a été remis à zéro entre-temps (valeur plus petite), seuls les appuis
 * depuis la remise à zéro sont ajoutés. Jamais de double comptage : delta 0 si identique.
 */
export function syncDelta(stored: number, current: number): number {
  const d = current >= stored ? current - stored : current;
  return d > SYNC_MAX ? 0 : d;
}

// ---------------------------------------------------------------- Détection automatique du champ compteur
export type CounterField = { offset: number; len: 1 | 2 | 3 | 4; endian: 'le' | 'be' } | { ascii: number };

/** Lit un champ compteur dans une trame. ascii = index du n-ième groupe de chiffres. */
export function readField(b: Bytes, f: CounterField): number | null {
  if ('ascii' in f) {
    const runs = ascii(b).match(/\d+/g);
    return runs && runs.length > f.ascii && runs[f.ascii].length <= 9 ? parseInt(runs[f.ascii], 10) : null;
  }
  if (b.length < f.offset + f.len) return null;
  let v = 0;
  for (let i = 0; i < f.len; i++) {
    const byte = f.endian === 'le' ? b[f.offset + f.len - 1 - i] : b[f.offset + i];
    v = v * 256 + byte;
  }
  return v;
}

/** Les valeurs augmentent-elles de 1 à chaque trame (une trame par appui) ? */
function stepsByOne(vals: (number | null)[]): boolean {
  if (vals.length < 2 || vals.some((v) => v == null)) return false;
  for (let k = 1; k < vals.length; k++) if ((vals[k] as number) - (vals[k - 1] as number) !== 1) return false;
  return true;
}

/**
 * Cherche dans une suite de trames (une par appui) le champ qui s'incrémente de 1 :
 * nombre ASCII d'abord (format texte), puis entier binaire de 1 à 4 octets, little puis big endian.
 * Ignore les champs constants ; préfère le champ le plus large qui contient la séquence.
 */
export function detectCounterField(frames: Bytes[]): CounterField | null {
  if (frames.length < 2) return null;
  const nAscii = Math.min(...frames.map((f) => (ascii(f).match(/\d+/g) ?? []).length));
  const printable = frames.every((f) => f.length > 0 && Array.from(f).every((x) => (x >= 32 && x < 127) || x === 10 || x === 13 || x === 0));
  if (printable) for (let i = 0; i < nAscii; i++) if (stepsByOne(frames.map((f) => readField(f, { ascii: i })))) return { ascii: i };
  const len = Math.min(...frames.map((f) => f.length));
  const zeroAt = (i: number) => i >= 0 && i < len && frames.every((f) => f[i] === 0);
  // 1) octet de poids faible qui s'incrémente de 1 ; on l'élargit aux octets voisins nuls (compteur 16/24/32 bits)
  for (let o = len - 1; o >= 0; o--) {
    if (!stepsByOne(frames.map((f) => f[o]))) continue;
    let be = 1;
    while (be < 4 && zeroAt(o - be)) be++;
    let le = 1;
    while (le < 4 && zeroAt(o + le)) le++;
    if (be >= le && be > 1) return { offset: o - be + 1, len: be as 1 | 2 | 3 | 4, endian: 'be' };
    if (le > 1) return { offset: o, len: le as 1 | 2 | 3 | 4, endian: 'le' };
    return { offset: o, len: 1, endian: 'le' };
  }
  // 2) la séquence franchit une frontière d'octet (ex. 255 → 256) : champ multi-octets
  for (const L of [2, 3, 4] as const) {
    for (const endian of ['le', 'be'] as const) {
      for (let o = 0; o + L <= len; o++) {
        const f: CounterField = { offset: o, len: L, endian };
        const vals = frames.map((x) => readField(x, f));
        if (stepsByOne(vals) && (vals[0] as number) < 2 ** 24) return f;
      }
    }
  }
  return null;
}
export function fieldLabel(f: CounterField | undefined): string {
  if (!f) return '';
  return 'ascii' in f ? `nombre texte n° ${f.ascii + 1}` : `${f.len} octet${f.len > 1 ? 's' : ''} à la position ${f.offset}${f.len > 1 ? (f.endian === 'le' ? ' (little-endian)' : ' (big-endian)') : ''}`;
}

// ---------------------------------------------------------------- Reconnaissance au scan
/** Motifs de nom fréquents des compteurs de dhikr, anneaux et tasbih électroniques (indice, pas une garantie). */
export const COUNTER_NAME_RE = /tasbi|tasbe|tesbi|tesbe|zikr|dhikr|thikr|zekr|subha|misbaha|masbaha|iqibla|qibla|bstwsh|ring|counter|compteur|clicker|tally|noor|jood|^bw/i;
/** Services de profils connus (documentés) et services génériques fréquents sur ces accessoires. */
export function likelyCounter(name: string | null | undefined, services: string[] = []): { likely: boolean; reason: string | null } {
  const n = (name ?? '').trim();
  if (n && COUNTER_NAME_RE.test(n)) return { likely: true, reason: 'nom' };
  const svc = services.map(normUuid);
  if (svc.some((u) => u === normUuid('ae30'))) return { likely: true, reason: 'service BSTWSH (0xAE30)' };
  if (svc.some((u) => u === STD.hid)) return { likely: true, reason: 'télécommande / clavier (HID)' };
  return { likely: false, reason: null };
}

// ---------------------------------------------------------------- Mode apprentissage
export type LearnSample = { service: string; characteristic: string; bytes: Bytes };
export type LearnResult = { ok: true; mapping: Mapping; confidence: 'haute' | 'moyenne'; detail: string } | { ok: false; reason: string };

/**
 * Analyse les trames reçues pendant que l'utilisateur appuyait `presses` fois.
 * Choisit la caractéristique dont le nombre de trames vaut N (1/appui) ou 2N (appui + relâchement).
 */
export function analyzeLearn(samples: LearnSample[], presses: number, parse: (b: Bytes) => Parsed = parseGeneric): LearnResult {
  if (presses < 2) return { ok: false, reason: 'Appuyez au moins 2 fois.' };
  const groups = new Map<string, LearnSample[]>();
  for (const s of samples) {
    if (isIgnoredChar(s.characteristic)) continue;
    const k = normUuid(s.service) + '|' + normUuid(s.characteristic);
    groups.set(k, [...(groups.get(k) ?? []), s]);
  }
  if (groups.size === 0) return { ok: false, reason: 'Aucun signal reçu : l’appareil n’envoie rien par notification BLE (essayez le mode clavier).' };
  type Cand = { key: string; frames: Bytes[]; score: number };
  const cands: Cand[] = [];
  for (const [key, list] of groups) {
    const frames = list.map((l) => l.bytes);
    const c = frames.length;
    const decoded = frames.map(parse).filter((p): p is { kind: 'absolute'; value: number } => !!p && p.kind === 'absolute');
    let score = 0;
    if (decoded.length === c && c > 0) {
      const span = decoded[c - 1].value - decoded[0].value;
      if (span === presses - 1 || span === presses) score = 100;
    }
    if (!score && c === presses) score = detectCounterField(frames) ? 90 : 80;
    if (!score && c === presses * 2) score = 70;
    if (!score && Math.abs(c - presses) <= 1) score = 40;
    if (score) cands.push({ key, frames, score });
  }
  cands.sort((a, b) => b.score - a.score);
  const best = cands[0];
  if (!best) {
    const counts = [...groups.entries()].map(([k, v]) => `${shortUuid(k.split('|')[1])}: ${v.length}`).join(', ');
    return { ok: false, reason: `Aucune caractéristique ne correspond à ${presses} appuis (${counts}). Réessayez en appuyant lentement.` };
  }
  const [service, characteristic] = best.key.split('|');
  const tie = cands.length > 1 && cands[1].score === best.score;
  const confidence = best.score >= 80 && !tie ? 'haute' : 'moyenne';
  const base = { service, characteristic, learnedAt: new Date().toISOString() };
  if (best.score === 100) return { ok: true, confidence, mapping: { ...base, mode: 'absolute', byteIndex: -1 }, detail: 'Compteur absolu reconnu (format connu).' };
  if (best.score === 90) {
    const field = detectCounterField(best.frames)!;
    return { ok: true, confidence, mapping: { ...base, mode: 'absolute', field }, detail: `Compteur absolu détecté (${fieldLabel(field)}).` };
  }
  if (best.score === 70) {
    const hex = best.frames.map(toHex);
    const even = hex.filter((_, i) => i % 2 === 0);
    const odd = hex.filter((_, i) => i % 2 === 1);
    const alt = even.every((h) => h === even[0]) && odd.every((h) => h === odd[0]) && even[0] !== odd[0];
    return alt
      ? { ok: true, confidence, mapping: { ...base, mode: 'pulse', pressSignature: even[0] }, detail: 'Appui + relâchement détectés : seul l’appui est compté.' }
      : { ok: true, confidence: 'moyenne', mapping: { ...base, mode: 'pulse', notifsPerClick: 2 }, detail: '2 signaux par appui.' };
  }
  return { ok: true, confidence, mapping: { ...base, mode: 'pulse', notifsPerClick: 1 }, detail: '1 signal par appui.' };
}

// ---------------------------------------------------------------- Clavier HID (anneaux télécommande)
/** Touches envoyées par les anneaux-télécommandes / cliqueurs Bluetooth appairés comme clavier. */
export const DEFAULT_HID_KEYS = ['Enter', ' ', 'ArrowRight', 'ArrowDown', 'ArrowUp', 'ArrowLeft', 'PageDown', 'PageUp', 'AudioVolumeUp', 'AudioVolumeDown', 'VolumeUp', 'VolumeDown', 'MediaPlayPause', 'MediaTrackNext'];
export function keyLabel(k: string): string {
  const m: Record<string, string> = { ' ': 'Espace', Enter: 'Entrée', ArrowRight: 'Flèche droite', ArrowLeft: 'Flèche gauche', ArrowUp: 'Flèche haut', ArrowDown: 'Flèche bas', PageDown: 'Page suivante', PageUp: 'Page précédente', AudioVolumeUp: 'Volume +', AudioVolumeDown: 'Volume −', VolumeUp: 'Volume +', VolumeDown: 'Volume −', MediaPlayPause: 'Lecture/Pause', MediaTrackNext: 'Piste suivante' };
  return m[k] ?? k;
}
export type KeyLike = { key: string; repeat?: boolean; ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean; targetIsEditable?: boolean };
export function isCounterKey(e: KeyLike, keys: string[]): boolean {
  if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || e.targetIsEditable) return false;
  return keys.includes(e.key);
}

// ---------------------------------------------------------------- Reconnexion
export const RECONNECT_DELAYS_MS = [1000, 2000, 4000, 8000, 15000, 30000];
export function reconnectDelay(attempt: number): number | null {
  return attempt < RECONNECT_DELAYS_MS.length ? RECONNECT_DELAYS_MS[attempt] : null;
}

// ---------------------------------------------------------------- Reconnexion automatique (appareils mémorisés)
/** Délais entre deux cycles de recherche : croissants puis plafonnés à 60 s, sans jamais abandonner. */
export const KEEPER_DELAYS_MS = [2000, 5000, 10000, 20000, 30000, 60000];
export function keeperDelay(attempt: number): number {
  return KEEPER_DELAYS_MS[Math.max(0, Math.min(attempt, KEEPER_DELAYS_MS.length - 1))];
}
/** Services trop génériques pour identifier un appareil (GAP, GATT, infos appareil, batterie, HID). */
const IDENTITY_NEUTRAL_SERVICES = ['1800', '1801', '180a', '180f', '1812'].map((s) => normUuid(s));
export type KnownLike = { id: string; name: string | null; services?: string[] };
/**
 * Associe un appareil vu en scan à un appareil mémorisé : d'abord par identifiant, sinon par nom exact
 * (l'identifiant peut changer après une réinitialisation), sinon — appareil sans nom uniquement — par service spécifique.
 */
export function matchKnown(r: { id: string; name: string | null; services?: string[] }, known: KnownLike[]): { device: KnownLike; by: 'id' | 'nom' | 'service' } | null {
  const byId = known.find((k) => k.id === r.id);
  if (byId) return { device: byId, by: 'id' };
  const name = r.name?.trim();
  if (name) {
    const byName = known.find((k) => k.name && k.name.trim() === name);
    if (byName) return { device: byName, by: 'nom' };
  }
  const rs = (r.services ?? []).map((s) => normUuid(s)).filter((s) => !IDENTITY_NEUTRAL_SERVICES.includes(s));
  if (rs.length) {
    const bySvc = known.find((k) => !k.name && (k.services ?? []).some((s) => rs.includes(normUuid(s))));
    if (bySvc) return { device: bySvc, by: 'service' };
  }
  return null;
}
