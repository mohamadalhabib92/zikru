// El Ghaly Bilal — coach comportemental islamique pour Zikru.
// Déployée avec verify_jwt=false : l'utilisateur est vérifié ici via auth.getUser (jeton de session).
// Secrets : AI_API_KEY (obligatoire), AI_PROVIDER = anthropic | openai (défaut anthropic), AI_MODEL (optionnel).
// Aucune clé service_role : le quota passe par la RPC bilal_consume() exécutée avec le jeton de l'utilisateur.
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const SYSTEM = `Tu es « El Ghaly Bilal », compagnon bienveillant de l'application Zikru (dhikr, prière, tariqa tijaniyya).
Rôle : coach comportemental islamique — régularité, habitudes, motivation, gestion des émotions, gratitude, patience, adab.
Règles :
- Réponds dans la langue de l'utilisateur (français par défaut), de façon chaleureuse, concise (≤ 180 mots), concrète (1 à 3 petites actions).
- Respecte la voie tijaniyya et les écoles malikite / shafi'ite ; ne dénigre aucune voie ni aucun musulman.
- Tu n'es pas un mufti : ne donne pas de fatwa ; pour toute question de fiqh, de licite/illicite ou d'autorisation de la tariqa, renvoie vers un imam, un savant ou le muqaddam.
- N'invente JAMAIS de hadith, de verset ni de référence. Ne cite que des textes très connus et sûrs, avec leur référence ; en cas de doute, n'en cite pas.
- Tu n'es pas médecin ni psychologue : en cas de détresse, d'idées suicidaires, de violence ou d'urgence, encourage à contacter immédiatement les secours (112 / 144 en Suisse, 143 La Main Tendue) et une personne de confiance.
- Pas de politique, pas de contenu sectaire, pas de prédictions.`;

const PERIOD: Record<string, string> = {
  dawn: "l'aube (après Fajr)",
  morning: 'la matinée',
  afternoon: "l'après-midi",
  evening: 'le soir (autour de Maghrib)',
  night: 'la nuit',
};

type Msg = { role: 'user' | 'assistant'; content: string };

/** Clé du modèle, serveur uniquement (secret Supabase). BILAL_AI_API_KEY (nom §15) ; AI_API_KEY reste accepté. */
function aiKey(): string | undefined {
  const k = (Deno.env.get('BILAL_AI_API_KEY') || Deno.env.get('AI_API_KEY') || '').trim();
  return k && !k.startsWith('YOUR_') ? k : undefined;
}

async function callModel(messages: Msg[], maxTokens: number): Promise<string> {
  const key = aiKey()!;
  const provider = (Deno.env.get('AI_PROVIDER') ?? 'anthropic').toLowerCase();
  if (provider === 'openai') {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: Deno.env.get('AI_MODEL') ?? 'gpt-4o-mini', max_tokens: maxTokens, messages: [{ role: 'system', content: SYSTEM }, ...messages] }),
    });
    if (!r.ok) throw new Error(`openai ${r.status} ${await r.text()}`);
    const j = await r.json();
    return j.choices?.[0]?.message?.content ?? '';
  }
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: Deno.env.get('AI_MODEL') ?? 'claude-sonnet-4-5', max_tokens: maxTokens, system: SYSTEM, messages }),
  });
  if (!r.ok) throw new Error(`anthropic ${r.status} ${await r.text()}`);
  const j = await r.json();
  return (j.content ?? []).filter((c: { type: string }) => c.type === 'text').map((c: { text: string }) => c.text).join('\n');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);

  const authHeader = req.headers.get('Authorization') ?? '';
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
  const token = authHeader.replace(/^Bearer\s+/i, '');
  const { data: u, error: ue } = await supabase.auth.getUser(token);
  if (ue || !u?.user) return json({ error: 'auth' }, 401);

  if (!aiKey()) return json({ error: 'not_configured' }, 503);

  let body: { mode?: string; messages?: Msg[]; period?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'bad_request' }, 400);
  }

  let messages: Msg[];
  let maxTokens = 600;
  if (body.mode === 'reflection') {
    const p = PERIOD[body.period ?? ''] ?? 'ce moment de la journée';
    messages = [{ role: 'user', content: `Écris une courte réflexion spirituelle (3 à 4 phrases, en français) pour ${p} : un rappel doux sur le dhikr, la gratitude ou la présence du cœur, et une petite action concrète. Pas de citation de hadith. Pas de titre.` }];
    maxTokens = 250;
  } else if (body.mode === 'chat' && Array.isArray(body.messages)) {
    messages = body.messages
      .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .slice(-12)
      .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));
    while (messages.length && messages[0].role !== 'user') messages.shift();
    if (!messages.length || messages[messages.length - 1].role !== 'user') return json({ error: 'bad_request' }, 400);
  } else return json({ error: 'bad_request' }, 400);

  const { data: left, error: qe } = await supabase.rpc('bilal_consume');
  if (qe) return json({ error: 'error' }, 500);
  if (typeof left === 'number' && left < 0) return json({ error: 'quota' }, 429);

  try {
    const text = (await callModel(messages, maxTokens)).trim();
    return json({ text, left });
  } catch (e) {
    console.error(String(e).slice(0, 500));
    // 402 (crédit épuisé), 429, 529 (surcharge), 5xx → « unavailable » : l'app affiche un message calme, le cœur n'est jamais bloqué.
    const st = Number(/\b(?:openai|anthropic) (\d{3})\b/.exec(String(e))?.[1]);
    const busy = st === 402 || st === 429 || st === 529 || st >= 500;
    return json({ error: busy ? 'unavailable' : 'upstream' }, busy ? 503 : 502);
  }
});
