/**
 * Appels de groupe (v1) — logique pure, sans React ni réseau (testée par scripts/test-calls.mjs).
 * Le serveur décide de tout (public.call_rights / call_join + Edge Function call-token) ; ce module ne fait
 * que traduire ses réponses en états d'écran. Libellé exact : « chiffré en transit, pas encore de bout en bout ».
 */
export type CallScope = 'family' | 'circle';

/** Réponse de public.call_rights (les champs autres que member / enabled n'existent que pour un membre). */
export type CallRights = {
  member: boolean;
  enabled: boolean;
  role?: string;
  can_join?: boolean;
  reason?: string | null;
  video?: boolean;
  video_needs_consent?: boolean;
  mixed_closed?: boolean;
  admin?: boolean;
  /** L’hôte a Premium et peut ouvrir la salle. Absent : ancien serveur, on ne bloque pas l’écran. */
  can_start?: boolean;
  max_participants?: number;
};

/** État de la carte « Appel » d'un groupe. */
export type CallAvailability =
  | { kind: 'hidden' } // pas membre, pas connecté
  | { kind: 'soon' } // fonction absente côté serveur, interrupteur coupé, ou app sans module d'appel (build actuel)
  | { kind: 'blocked'; reason: string } // suspendu·e, réglage parental
  | { kind: 'ready'; video: boolean; videoNeedsConsent: boolean; admin: boolean; max: number; mixedClosed: boolean; canStart: boolean };

export const LABEL_TRANSIT = 'chiffré en transit, pas encore de bout en bout';

export function availability(r: CallRights | null, opts: { missing?: boolean; nativeOk: boolean }): CallAvailability {
  if (opts.missing) return { kind: 'soon' };
  if (!r) return { kind: 'hidden' };
  if (!r.member) return r.enabled ? { kind: 'hidden' } : { kind: 'soon' };
  if (!r.enabled || !opts.nativeOk) return { kind: 'soon' };
  if (!r.can_join) return { kind: 'blocked', reason: r.reason || 'parental' };
  return { kind: 'ready', video: !!r.video, videoNeedsConsent: !!r.video_needs_consent, admin: !!r.admin, max: r.max_participants ?? 0, mixedClosed: !!r.mixed_closed, canStart: r.can_start === true };
}

/** Motifs serveur → texte français (clé de traduction ; l'écran applique L()). Jamais de détail sur autrui. */
const REASONS: Record<string, string> = {
  disabled: 'Bientôt disponible',
  not_configured: 'Bientôt disponible',
  soon: 'Bientôt disponible',
  not_member: 'Réservé aux membres du groupe.',
  forbidden: 'Réservé aux membres du groupe.',
  parental: 'Le réglage parental ne permet pas cet appel.',
  suspended: 'Votre compte est suspendu : les appels ne sont pas disponibles.',
  full: 'L’appel est complet.',
  pair: 'Vous ne pouvez pas rejoindre cet appel pour le moment.',
  premium_host: 'L’appel n’est pas encore ouvert par un hôte Premium.',
  premium_required: 'L’appel n’est pas encore ouvert par un hôte Premium.',
  rate: 'Trop de tentatives. Réessayez dans un moment.',
  offline: 'Connexion requise pour l’appel',
  native: 'Les appels arrivent avec une prochaine version de l’app.',
  livekit: 'Le service d’appel ne répond pas. Réessayez dans un moment.',
};
export function reasonText(reason: string | null | undefined): string {
  return REASONS[reason ?? ''] ?? 'Une erreur est survenue.';
}
/** Motifs qui signifient « fonction pas encore ouverte » (carte « Bientôt disponible »). */
export const isSoonReason = (r: string | null | undefined) => r === 'disabled' || r === 'not_configured' || r === 'soon' || r === 'native';

/** Métadonnées d'un participant (posées par le serveur dans le jeton). */
export function parseMeta(metadata: string | undefined | null): { admin: boolean } {
  try {
    const m = metadata ? (JSON.parse(metadata) as { admin?: unknown }) : {};
    return { admin: m.admin === true };
  } catch {
    return { admin: false };
  }
}

export type Person = { identity: string; name: string; admin: boolean; speaking: boolean; micOn: boolean; camOn: boolean; local: boolean };

/** Ordre d'affichage : moi d'abord, puis qui parle, puis par nom. */
export function orderPeople(list: Person[]): Person[] {
  return [...list].sort((a, b) => Number(b.local) - Number(a.local) || Number(b.speaking) - Number(a.speaking) || a.name.localeCompare(b.name));
}

/** Boutons d'hôte visibles ? (le serveur revérifie : fondateur intouchable, un parent ne retire pas un autre parent). */
export const canModerate = (meAdmin: boolean, target: Person) => meAdmin && !target.local && !target.admin;
/** Signaler / bloquer : toute autre personne. */
export const canReport = (target: Person) => !target.local;

export function fmtDuration(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
