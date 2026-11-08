// Passe 6 — notification push « nouveau message » pour la discussion de groupe (famille / cercle).
// NON DÉPLOYÉE. À déployer seulement avec l'accord explicite de Mohamed, APRÈS les migrations passe 5 et passe 6.
//
// Déclenchement prévu : Database Webhook Supabase sur INSERT de public.group_messages → POST vers cette fonction
// (verify_jwt=false), en-tête « x-push-secret: <PUSH_WEBHOOK_SECRET> ».
// Secrets : PUSH_WEBHOOK_SECRET (obligatoire, valeur YOUR_PUSH_WEBHOOK_SECRET à remplacer),
//           EXPO_ACCESS_TOKEN (optionnel, si la sécurité push renforcée d'Expo est activée).
// SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont fournis par la plateforme ; la clé service ne quitte jamais le serveur.
//
// Ce qui part chez Apple / Google (via le service push d'Expo) : le NOM DU GROUPE et « Nouveau message ».
// Jamais le texte du message, jamais le nom de l'auteur. Les destinataires sont calculés par la base
// (public.group_push_recipients) avec les mêmes règles que la lecture du fil : membres seulement, blocages,
// règles enfant, sourdine.
import { createClient } from 'npm:@supabase/supabase-js@2';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const BODY: Record<string, string> = {
  fr: 'Nouveau message',
  en: 'New message',
  ar: 'رسالة جديدة',
  de: 'Neue Nachricht',
  'de-CH': 'Neue Nachricht',
};

type Recipient = { token: string; lang: string; group_name: string; scope_type: 'family' | 'circle'; scope_id: string };

function secretOk(req: Request): boolean {
  const want = (Deno.env.get('PUSH_WEBHOOK_SECRET') || '').trim();
  if (!want || want.startsWith('YOUR_')) return false;
  const got = req.headers.get('x-push-secret') || '';
  if (got.length !== want.length) return false;
  let d = 0;
  for (let i = 0; i < want.length; i++) d |= want.charCodeAt(i) ^ got.charCodeAt(i);
  return d === 0;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  if (!secretOk(req)) return json({ error: 'unauthorized' }, 401);
  let payload: { type?: string; table?: string; record?: { id?: string; deleted_at?: string | null } };
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'bad_json' }, 400);
  }
  const id = payload?.record?.id;
  if (payload?.type !== 'INSERT' || payload?.table !== 'group_messages' || !id) return json({ skipped: true });

  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return json({ error: 'config' }, 500);
  const db = createClient(url, key, { auth: { persistSession: false } });

  const { data, error } = await db.rpc('group_push_recipients', { p_message: id });
  if (error) return json({ error: 'recipients' }, 500);
  const list = (data ?? []) as Recipient[];
  if (!list.length) return json({ sent: 0 });

  const messages = list.map((r) => ({
    to: r.token,
    title: r.group_name || 'Zikru',
    body: BODY[r.lang] ?? BODY.fr,
    sound: 'default',
    // Regroupement par discussion (iOS) ; ouverture directe du fil au toucher.
    threadId: `${r.scope_type}:${r.scope_id}`,
    data: { url: `/discussion?scope=${r.scope_type}&id=${r.scope_id}` },
  }));

  const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
  const expoToken = (Deno.env.get('EXPO_ACCESS_TOKEN') || '').trim();
  if (expoToken && !expoToken.startsWith('YOUR_')) headers.Authorization = `Bearer ${expoToken}`;

  let sent = 0;
  const dead: string[] = [];
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    const res = await fetch('https://exp.host/--/api/v2/push/send', { method: 'POST', headers, body: JSON.stringify(chunk) });
    if (!res.ok) continue;
    const out = (await res.json()) as { data?: { status: string; details?: { error?: string } }[] };
    (out.data ?? []).forEach((t, j) => {
      if (t.status === 'ok') sent++;
      else if (t.details?.error === 'DeviceNotRegistered') dead.push(chunk[j].to);
    });
  }
  // Jetons refusés par Apple / Google : désactivés (purgés ensuite après 90 jours).
  for (const t of dead) await db.rpc('disable_push_token', { p_token: t });
  return json({ sent, disabled: dead.length });
});
