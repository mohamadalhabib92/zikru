// Noyau pur de l'Edge Function call-token : signature des jetons LiveKit (JWT HS256, WebCrypto) et appels à
// l'API serveur LiveKit (Twirp RoomService). Aucune dépendance Deno : testé sous Node (scripts/test-calls.mjs).
//
// Règles v1 :
//   · jamais d'enregistrement : roomRecord = false, aucun appel Egress ;
//   · pas de données ni de discussion dans l'appel : canPublishData = false ;
//   · sources publiables : micro, + caméra seulement si la base l'autorise (call_join.video) ; jamais de partage d'écran ;
//   · jamais roomAdmin pour un client : couper un micro / retirer passe par cette fonction (contrôle + journal en base).

export type LiveKitConfig = { url: string; apiKey: string; apiSecret: string };

/** Secrets absents ou encore aux valeurs d'exemple YOUR_* → null (la fonction répond 503 « not_configured »). */
export function readConfig(get: (k: string) => string | undefined): LiveKitConfig | null {
  const url = (get('LIVEKIT_URL') || '').trim();
  const apiKey = (get('LIVEKIT_API_KEY') || '').trim();
  const apiSecret = (get('LIVEKIT_API_SECRET') || '').trim();
  if (!url || !apiKey || !apiSecret) return null;
  if ([url, apiKey, apiSecret].some((v) => v.startsWith('YOUR_'))) return null;
  if (!/^wss?:\/\/|^https?:\/\//.test(url)) return null;
  return { url, apiKey, apiSecret };
}

/** URL HTTP(S) de l'API serveur à partir de l'URL WebSocket fournie aux clients. */
export function httpUrl(url: string): string {
  return url.replace(/^ws:/, 'http:').replace(/^wss:/, 'https:').replace(/\/+$/, '');
}

const enc = new TextEncoder();
function b64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
const b64json = (o: unknown) => b64url(enc.encode(JSON.stringify(o)));

export type VideoGrant = {
  room?: string;
  roomJoin?: boolean;
  roomCreate?: boolean;
  roomList?: boolean;
  roomAdmin?: boolean;
  roomRecord?: boolean;
  canPublish?: boolean;
  canSubscribe?: boolean;
  canPublishData?: boolean;
  canPublishSources?: ('microphone' | 'camera')[];
  canUpdateOwnMetadata?: boolean;
};

export async function signJwt(cfg: LiveKitConfig, claims: Record<string, unknown>, ttlS: number, nowS = Math.floor(Date.now() / 1000)): Promise<string> {
  const head = b64json({ alg: 'HS256', typ: 'JWT' });
  const body = b64json({ ...claims, iss: cfg.apiKey, nbf: nowS - 5, exp: nowS + ttlS });
  const key = await crypto.subtle.importKey('raw', enc.encode(cfg.apiSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(`${head}.${body}`)));
  return `${head}.${body}.${b64url(sig)}`;
}

/** Réponse de public.call_join quand l'entrée est acceptée. */
export type JoinOk = {
  ok: true;
  room: string;
  identity: string;
  name: string;
  video: boolean;
  admin: boolean;
  max_participants: number;
  token_ttl_s: number;
  ring: boolean;
};

/** Droits du jeton d'un participant. Fonction pure : c'est elle que les tests vérifient. */
export function participantGrant(j: JoinOk): VideoGrant {
  return {
    room: j.room,
    roomJoin: true,
    canSubscribe: true,
    canPublish: true,
    canPublishData: false,
    canPublishSources: j.video ? ['microphone', 'camera'] : ['microphone'],
    canUpdateOwnMetadata: false,
    roomAdmin: false,
    roomRecord: false,
  };
}

export function participantClaims(j: JoinOk): Record<string, unknown> {
  return {
    sub: j.identity,
    name: j.name.slice(0, 60),
    // Lu par les autres participants pour afficher « hôte » ; n'ouvre aucun droit côté LiveKit.
    metadata: JSON.stringify({ admin: !!j.admin }),
    video: participantGrant(j),
  };
}

export const ROOM_RE = /^(family|circle)_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

type Fetch = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

/** Client minimal de l'API serveur LiveKit (Twirp JSON). Chaque appel signe un jeton serveur de 60 s limité à la salle. */
export function roomService(cfg: LiveKitConfig, fetchFn: Fetch) {
  const call = async (method: string, grant: VideoGrant, body: Record<string, unknown>) => {
    const token = await signJwt(cfg, { video: grant }, 60);
    const res = await fetchFn(`${httpUrl(cfg.url)}/twirp/livekit.RoomService/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    if (res.status === 404) return null; // salle inexistante = personne
    if (!res.ok) throw new Error(`livekit_${method}_${res.status}`);
    return (await res.json()) as Record<string, unknown>;
  };
  return {
    /** Identités (uuid) déjà présentes. */
    async participants(room: string): Promise<{ identity: string; tracks: { sid: string; type: string; source: string; muted: boolean }[] }[]> {
      const out = await call('ListParticipants', { room, roomAdmin: true }, { room });
      const list = ((out?.participants as unknown[]) ?? []) as { identity?: string; tracks?: { sid?: string; type?: string | number; source?: string | number; muted?: boolean }[] }[];
      return list
        .filter((p) => typeof p.identity === 'string')
        .map((p) => ({
          identity: p.identity as string,
          tracks: (p.tracks ?? []).map((t) => ({ sid: String(t.sid ?? ''), type: String(t.type ?? ''), source: String(t.source ?? ''), muted: !!t.muted })),
        }));
    },
    createRoom(room: string, maxParticipants: number) {
      // emptyTimeout : la salle se ferme 2 min après le départ de la dernière personne.
      return call('CreateRoom', { roomCreate: true }, { name: room, max_participants: maxParticipants, empty_timeout: 120, departure_timeout: 20 });
    },
    removeParticipant(room: string, identity: string) {
      return call('RemoveParticipant', { room, roomAdmin: true }, { room, identity });
    },
    muteTrack(room: string, identity: string, trackSid: string) {
      return call('MutePublishedTrack', { room, roomAdmin: true }, { room, identity, track_sid: trackSid, muted: true });
    },
  };
}

/** Pistes à couper pour « couper le micro » : les pistes audio non coupées (source micro ou inconnue). */
export function audioTracksToMute(tracks: { sid: string; type: string; source: string; muted: boolean }[]): string[] {
  return tracks.filter((t) => !t.muted && t.sid && (t.type === 'AUDIO' || t.type === '0' || /microphone/i.test(t.source))).map((t) => t.sid);
}
