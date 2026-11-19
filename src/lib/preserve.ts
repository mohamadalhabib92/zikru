/**
 * Gardes de conservation locale (logique pure).
 * Ce n'est pas une sauvegarde chiffrée, ni une preuve qu'un appareil a été restauré.
 * Les fichiers de fixtures/preservation sont synthétiques.
 */
/** Version marketing de cette branche d’intégration. Strictement au-dessus de 1.0.29 pour que TestFlight ne soit pas un retour arrière. Ce n’est pas une preuve que les portes de sauvegarde sont passées. */
export const MARKETING_VERSION = '1.0.30';

export const LOCAL_EXPORT_FORMAT = 'zikru-local-export';

export type LocalExportEntry = { key: string; raw: string | null };

export type LocalExportV1 = {
  format: typeof LOCAL_EXPORT_FORMAT;
  formatVersion: 1;
  appMarketingVersion: string;
  /** Rappel fixe : un export synthétique ou partiel ne remplace pas une copie de l'appareil. */
  deviceBackup: false;
  entries: LocalExportEntry[];
};

export type ExportAssessment = {
  applicable: boolean;
  reason: string;
  keys: string[];
  futureFormat: boolean;
};

/** Superpose un objet stocké sur des valeurs par défaut sans retirer les clés inconnues du stocké. */
export function mergeKeepingStored<T extends Record<string, unknown>>(base: T, stored: unknown): T & Record<string, unknown> {
  if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return { ...base };
  return { ...base, ...(stored as Record<string, unknown>) };
}

export function buildLocalExport(entries: LocalExportEntry[], appMarketingVersion: string): LocalExportV1 {
  return {
    format: LOCAL_EXPORT_FORMAT,
    formatVersion: 1,
    appMarketingVersion,
    deviceBackup: false,
    entries: entries.map((e) => ({ key: e.key, raw: e.raw })),
  };
}

/** Décrit un document d'export. N'écrit rien. Un format futur n'est pas applicable : il faut le garder tel quel. */
export function assessLocalExport(data: unknown): ExportAssessment {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { applicable: false, reason: 'document illisible', keys: [], futureFormat: false };
  }
  const d = data as Partial<LocalExportV1>;
  if (d.format !== LOCAL_EXPORT_FORMAT) {
    return { applicable: false, reason: 'format inconnu', keys: [], futureFormat: false };
  }
  if (typeof d.formatVersion === 'number' && d.formatVersion > 1) {
    const keys = Array.isArray(d.entries) ? d.entries.flatMap((e) => (e && typeof e === 'object' && 'key' in e ? [String((e as LocalExportEntry).key)] : [])) : [];
    return { applicable: false, reason: 'format plus récent : ne pas réécrire', keys, futureFormat: true };
  }
  if (d.formatVersion !== 1 || !Array.isArray(d.entries)) {
    return { applicable: false, reason: 'version d’export inattendue', keys: [], futureFormat: false };
  }
  const keys = d.entries.filter((e) => e && typeof e.key === 'string').map((e) => e.key);
  return { applicable: true, reason: 'export v1 lisible', keys, futureFormat: false };
}

export type ProgramProgress = {
  counts: Record<string, number>;
  dirty: string[];
  extras: Record<string, unknown>;
};

/**
 * Lecture du cache local « community/program-progress/… » (forme vue sur la branche 1.0.29).
 * Les clés inconnues restent dans `extras`. La fonction ne réassigne pas un compteur
 * historique sur un autre objectif.
 */
export function readProgramProgress(raw: unknown): ProgramProgress {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { counts: {}, dirty: [], extras: {} };
  const o = raw as Record<string, unknown>;
  const extras: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) {
    if (k !== 'counts' && k !== 'dirty') extras[k] = v;
  }
  const counts: Record<string, number> = {};
  if (o.counts && typeof o.counts === 'object' && !Array.isArray(o.counts)) {
    for (const [k, v] of Object.entries(o.counts as Record<string, unknown>)) {
      if (typeof v === 'number' && Number.isFinite(v) && v >= 0) counts[k] = v;
    }
  }
  const dirty = Array.isArray(o.dirty) ? o.dirty.filter((x): x is string => typeof x === 'string') : [];
  return { counts, dirty, extras };
}

/** Recompose le cache sans perdre `extras`. */
export function writeProgramProgress(p: ProgramProgress): Record<string, unknown> {
  return { ...p.extras, counts: p.counts, dirty: p.dirty };
}

/**
 * Met à jour les compteurs d’un cache déjà lu sans effacer les clés inconnues
 * (forme 1.0.29 : clientNote, attemptIds, …).
 */
export function saveProgramProgress(raw: unknown, counts: Record<string, number>, dirty: string[]): Record<string, unknown> {
  const prev = readProgramProgress(raw);
  return writeProgramProgress({ counts, dirty, extras: prev.extras });
}

/** Génération du document tasbih stocké. `newer` ne doit pas être réécrit en v2. */
export function tasbihGeneration(raw: unknown): 'empty' | 'legacy' | 'v2' | 'newer' | 'unreadable' {
  if (raw == null) return 'empty';
  if (typeof raw !== 'object') return 'unreadable';
  const v = (raw as { v?: unknown }).v;
  if (v === 2) return 'v2';
  if (typeof v === 'number' && v > 2) return 'newer';
  if (typeof v === 'string') return 'newer';
  return 'legacy';
}
