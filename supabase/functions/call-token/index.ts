// Appels de groupe (familles / cercles) — délivre un jeton LiveKit après contrôle en base. NON DÉPLOYÉE.
// À déployer seulement avec l'accord explicite de Mohamed, APRÈS la migration 20261102100000_appels.sql.
//
// verify_jwt = true (défaut) : seul un compte connecté peut appeler. La personne est identifiée par SON jeton
// Supabase ; toutes les règles (appartenance, blocages, suspension, mineurs, interrupteur calls.enabled,
// plafond de participants, débit) sont dans public.call_join / call_rights / call_moderate.
//
// Secrets (à définir dans Supabase → Edge Functions → Secrets, jamais dans le dépôt) :
//   LIVEKIT_URL         ex. wss://appels.exemple.ch  (serveur LiveKit auto-hébergé, pas un nuage payant)
//   LIVEKIT_API_KEY     YOUR_LIVEKIT_API_KEY
//   LIVEKIT_API_SECRET  YOUR_LIVEKIT_API_SECRET  (lu ici seulement, jamais dans l’application)
//   EXPO_ACCESS_TOKEN   (optionnel) pour la notification « appel en cours » si calls.push = true.
// Tant qu'un secret manque ou vaut YOUR_*, la fonction répond 503 not_configured et l'app affiche « Bientôt disponible ».
//
// Actions (POST JSON) :
//   { action: 'join',   scope, id, video }         → { token, url, room, identity, name, video, admin }
//   { action: 'status', scope, id }                → { active, count }
//   { action: 'mute' | 'remove', scope, id, target } (hôte seulement ; journalisé en base)
//   { action: 'end', scope, id }                    (hôte : termine l’appel pour tout le monde)
// Jamais d'enregistrement, jamais de partage d'écran, pas de données dans l'appel.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { audioTracksToMute, participantClaims, readConfig, roomService, signJwt, UUID_RE, type JoinOk } from './livekit.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const RING_BODY: Record<string, string> = { fr: 'Appel en cours', en: 'Call in progress', ar: 'مكالمة جارية', de: 'Laufender Anruf', 'de-CH': 'Laufender Anruf' };

type Body = { action?: string; scope?: string; id?: string; video?: boolean; target?: string };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  const auth = req.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401);
  let b: Body;
  try {
    b = await req.json();
  } catch {
    return json({ error: 'bad_json' }, 400);
  }
  const scope = b.scope === 'family' || b.scope === 'circle' ? b.scope : null;
  const id = typeof b.id === 'string' && UUID_RE.test(b.id) ? b.id : null;
  if (!scope || !id) return json({ error: 'bad_request' }, 400);

  const url = Deno.env.get('SUPABASE_URL');
  const anon = Deno.env.get('SUPABASE_ANON_KEY');
  if (!url || !anon) return json({ error: 'config' }, 500);
  // Client « au nom de la personne » : auth.uid() côté base = l'appelant ; aucune clé service ici.
  const db = createClient(url, anon, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data: u, error: ue } = await db.auth.getUser(auth.slice(7));
  if (ue || !u?.user) return json({ error: 'unauthorized' }, 401);

  const cfg = readConfig((k) => Deno.env.get(k));
  if (!cfg) return json({ error: 'not_configured' }, 503);
  const lk = roomService(cfg, fetch);
  const room = `${scope}_${id}`;

  try {
    if (b.action === 'status') {
      const { data: r, error } = await db.rpc('call_rights', { p_scope: scope, p_scope_id: id });
      if (error) return json({ error: 'rights' }, 500);
      if (!r?.member) return json({ error: 'forbidden' }, 403);
      if (!r.enabled) return json({ error: 'disabled' }, 503);
      const n = (await lk.participants(room)).length;
      return json({ active: n > 0, count: n });
    }

    if (b.action === 'join') {
      const present = (await lk.participants(room)).map((p) => p.identity).filter((s) => UUID_RE.test(s) && s !== u.user.id);
      const { data: j, error } = await db.rpc('call_join', { p_scope: scope, p_scope_id: id, p_video: !!b.video, p_present: present });
      if (error) {
        if (error.code === 'ZKR01') return json({ error: 'rate' }, 429); // private.rate_hit
        if (error.code === '42501') return json({ error: 'forbidden' }, 403);
        return json({ error: 'join' }, 500);
      }
      if (!j?.ok) return json({ error: j?.reason ?? 'join' }, j?.reason === 'disabled' ? 503 : 403);
      const ok = j as JoinOk;
      await lk.createRoom(ok.room, ok.max_participants);
      const token = await signJwt(cfg, participantClaims(ok), ok.token_ttl_s);
      if (ok.ring) await ring(scope, id, u.user.id).catch(() => undefined);
      return json({ token, url: cfg.url, room: ok.room, identity: ok.identity, name: ok.name, video: ok.video, admin: ok.admin });
    }

    if (b.action === 'mute' || b.action === 'remove') {
      const target = typeof b.target === 'string' && UUID_RE.test(b.target) ? b.target : null;
      if (!target) return json({ error: 'bad_request' }, 400);
      // Contrôle (hôte, pas soi-même, pas le fondateur / un autre parent) + journal de modération, en base.
      const { error } = await db.rpc('call_moderate', { p_scope: scope, p_scope_id: id, p_action: b.action === 'mute' ? 'call_mute' : 'call_remove', p_target: target });
      if (error) return json({ error: 'forbidden' }, 403);
      if (b.action === 'remove') {
        await lk.removeParticipant(room, target);
      } else {
        const p = (await lk.participants(room)).find((x) => x.identity === target);
        for (const sid of audioTracksToMute(p?.tracks ?? [])) await lk.muteTrack(room, target, sid);
      }
      return json({ ok: true });
    }

    if (b.action === 'end') {
      const { error } = await db.rpc('end_group_call', { p_scope: scope, p_scope_id: id });
      if (error) return json({ error: 'forbidden' }, 403);
      await lk.deleteRoom(room);
      return json({ ok: true });
    }
    return json({ error: 'bad_action' }, 400);
  } catch {
    return json({ error: 'livekit' }, 502);
  }
});

// Notification simple « appel en cours » (pas de CallKit / VoIP). Destinataires calculés par la base
// (membres, blocages, sourdine, suspension, règles enfant). Contenu : nom du groupe + « Appel en cours ».
async function ring(scope: string, id: string, caller: string) {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return;
  const svc = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await svc.rpc('call_push_recipients', { p_scope: scope, p_scope_id: id, p_caller: caller });
  if (error || !Array.isArray(data) || !data.length) return;
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
  const expoToken = (Deno.env.get('EXPO_ACCESS_TOKEN') || '').trim();
  if (expoToken && !expoToken.startsWith('YOUR_')) headers.Authorization = `Bearer ${expoToken}`;
  const msgs = (data as { token: string; lang: string; group_name: string }[]).map((r) => ({
    to: r.token,
    title: r.group_name || 'Zikru',
    body: RING_BODY[r.lang] ?? RING_BODY.fr,
    sound: 'default',
    data: { url: `/call?scope=${scope}&id=${id}` },
  }));
  for (let i = 0; i < msgs.length; i += 100) {
    await fetch('https://exp.host/--/api/v2/push/send', { method: 'POST', headers, body: JSON.stringify(msgs.slice(i, i + 100)) });
  }
}
