-- Appels de groupe audio / vidéo (familles et cercles) via LiveKit — v1.
-- ADDITIVE : nouvelles fonctions, une table privée, une colonne de consentement ; rien n'est supprimé.
-- NON APPLIQUÉE au projet Supabase en ligne : à appliquer seulement après accord explicite de Mohamed.
--
-- Choix v1 validés par Mohamed (01.11.2026) :
--   · audio et vidéo ; notification simple (pas de CallKit / VoIP) ;
--   · mineurs : audio dans la famille ; vidéo et cercles seulement avec le consentement d'un parent.
-- Le serveur (Edge Function call-token) est seul à signer un jeton LiveKit, après public.call_join ci-dessous.
-- Aucun enregistrement : aucune fonction d'enregistrement (egress) n'est utilisée ni autorisée.
-- Média « chiffré en transit, pas encore de bout en bout » (DTLS-SRTP vers le serveur LiveKit).
--
-- Contenu :
--   1. Réglages app_config (interrupteur général calls.enabled = false par défaut).
--   2. parental_controls.allow_video_calls (consentement vidéo d'un parent, défaut non).
--   3. private.call_rights : droits de la personne connectée dans un groupe (appartenance, suspension, mineurs).
--   4. private.call_pair_ok : deux personnes peuvent-elles être dans le même appel ? (blocage, règles enfant)
--   5. private.call_join : contrôle avant jeton (droits + personnes déjà présentes + débit), journal 30 jours.
--   6. private.call_moderate : couper le micro / retirer quelqu'un (hôte), journal de modération.
--   7. private.call_push_recipients : « appel en cours » (rôle service seulement).

-- ===================================================================== 1. Réglages
insert into public.app_config (key, value, description) values
  ('calls.enabled',          'false', 'Appels de groupe : interrupteur général (false = « Bientôt disponible » dans l''app).'),
  ('calls.video',            'true',  'Appels de groupe : vidéo autorisée (false = audio seulement pour tout le monde).'),
  ('calls.max_participants', '12',    'Appels de groupe : personnes au plus dans un même appel.'),
  ('calls.token_ttl_s',      '600',   'Appels de groupe : validité d''un jeton d''entrée (secondes). Pas de plafond de durée d''appel en v1.'),
  ('calls.push',             'false', 'Appels de groupe : notification « appel en cours » aux membres (false = aucune).'),
  ('calls.ring_cooldown_s',  '600',   'Appels de groupe : délai minimal entre deux notifications pour un même groupe.'),
  ('rate.call_join',         '{"max": 30, "window_s": 3600}', 'Entrées dans un appel par heure et par personne.'),
  ('retention.call_joins_days', '30', 'Journal des entrées dans les appels supprimé après N jours.')
on conflict (key) do nothing;

-- ===================================================================== 2. Consentement parental vidéo
-- Les cercles restent soumis à parental_controls.allow_circles (déjà présent, défaut non).
alter table public.parental_controls add column if not exists allow_video_calls boolean not null default false;

-- ===================================================================== 3. Droits
create or replace function private.config_bool(p_key text, p_default boolean) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select case jsonb_typeof(value) when 'boolean' then (value #>> '{}')::boolean
                                                   when 'string' then (value #>> '{}') in ('true', 'on', '1') end
                   from public.app_config where key = p_key), p_default) $$;
create or replace function private.config_int(p_key text, p_default int) returns int
language sql stable security definer set search_path = '' as $$
  select coalesce((select case when jsonb_typeof(value) in ('number', 'string') and (value #>> '{}') ~ '^\d+$'
                               then (value #>> '{}')::int end
                   from public.app_config where key = p_key), p_default) $$;

-- Consentements parentaux d'un mineur (toutes ses familles) : circles = un parent autorise les cercles,
-- video_family = vidéo autorisée dans CETTE famille, video_circles = vidéo autorisée par un parent qui autorise aussi les cercles.
create or replace function private.minor_call_consent(uid uuid, fid uuid)
returns table (circles boolean, video_family boolean, video_circles boolean)
language sql stable security definer set search_path = '' as $$
  select coalesce(bool_or(pc.allow_circles), false),
         coalesce(bool_or(pc.allow_video_calls) filter (where m.family_id = fid), false),
         coalesce(bool_or(pc.allow_circles and pc.allow_video_calls), false)
  from public.family_members m join public.parental_controls pc on pc.child_member_id = m.id
  where m.user_id = uid and m.role = 'child' $$;

-- Droits d'appel de la personne connectée. Ne révèle rien hors du groupe (member = false).
create or replace function private.call_rights(p_scope text, p_scope_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare me uuid := (select auth.uid()); r text; minor boolean; c record; video boolean; reason text; n int;
        on_ boolean := private.config_bool('calls.enabled', false);
        vid boolean := private.config_bool('calls.video', true);
        cap int := greatest(private.config_int('calls.max_participants', 12), 2);
begin
  if me is null then return jsonb_build_object('member', false, 'enabled', on_); end if;
  minor := private.is_minor(me);
  if p_scope = 'circle' then
    r := private.circle_role(p_scope_id);
    if r is null then return jsonb_build_object('member', false, 'enabled', on_); end if;
    select count(*) into n from public.circle_members where circle_id = p_scope_id;
    if minor then
      select * into c from private.minor_call_consent(me, null);
      if not coalesce(c.circles, false) then reason := 'parental'; end if;
      video := coalesce(c.video_circles, false);
    else
      video := true;
    end if;
  elsif p_scope = 'family' then
    r := private.family_role(p_scope_id);
    if r is null then return jsonb_build_object('member', false, 'enabled', on_); end if;
    select count(*) into n from public.family_members where family_id = p_scope_id and user_id is not null;
    if minor and r <> 'child' then reason := 'parental'; end if;
    if r = 'child' and private.child_messaging_strict(p_scope_id, me) = 'none' then reason := 'parental'; end if;
    if minor or r = 'child' then
      select * into c from private.minor_call_consent(me, p_scope_id);
      video := coalesce(c.video_family, false);
    else
      video := true;
    end if;
  else
    return jsonb_build_object('member', false, 'enabled', on_);
  end if;
  if private.is_suspended(me) then reason := 'suspended'; end if;
  if not on_ then reason := 'disabled'; end if;
  return jsonb_build_object('member', true, 'enabled', on_, 'role', r,
    'can_join', reason is null, 'reason', reason,
    'video', vid and video and reason is null,
    'video_needs_consent', vid and not video and (minor or r = 'child'),
    'admin', case p_scope when 'circle' then r in ('founder', 'moderator') else r = 'parent' end and reason is null,
    'max_participants', least(cap, greatest(n, 2)));
end $$;
create or replace function public.call_rights(p_scope text, p_scope_id uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$ select private.call_rights(p_scope, p_scope_id) $$;

-- ===================================================================== 4. Paires autorisées
-- Deux personnes peuvent-elles s'entendre dans un même appel ? Blocage (dans les deux sens) ; dans une famille,
-- mêmes règles que la discussion (enfant « Parents » : seulement ses parents ; jamais un invité ; « Aucun » : personne).
create or replace function private.call_pair_ok(p_scope text, p_scope_id uuid, a uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select a = b or (not private.is_blocked(a, b) and case p_scope
    when 'family' then private.family_pair_ok(p_scope_id, a, b)
    when 'circle' then true
    else false end) $$;

-- ===================================================================== 5. Entrée dans un appel
create table private.call_joins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,   -- effacé avec le compte (delete_my_account)
  scope_type text not null check (scope_type in ('family', 'circle')),
  family_id uuid, circle_id uuid,
  video boolean not null default false,
  at timestamptz not null default now()
);
create index call_joins_family_idx on private.call_joins (family_id, at) where family_id is not null;
create index call_joins_circle_idx on private.call_joins (circle_id, at) where circle_id is not null;
create index call_joins_user_idx on private.call_joins (user_id);
create index call_joins_at_idx on private.call_joins (at);
alter table private.call_joins enable row level security;
revoke all on private.call_joins from public, anon, authenticated;

-- Appelée par l'Edge Function call-token AVEC le jeton de la personne (jamais la clé service) :
-- p_present = identités déjà connectées à la salle LiveKit (lues côté serveur). Si l'une d'elles ne peut pas
-- être dans le même appel (blocage, règle enfant / invité), l'entrée est refusée (motif générique « pair »).
-- Retourne { ok, reason } ou { ok, room, identity, name, video, admin, max_participants, token_ttl_s, ring }.
create or replace function private.call_join(p_scope text, p_scope_id uuid, p_video boolean, p_present uuid[]) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := (select auth.uid()); r jsonb := private.call_rights(p_scope, p_scope_id); p uuid; nm text; v boolean;
        fid uuid := case when p_scope = 'family' then p_scope_id end; cid uuid := case when p_scope = 'circle' then p_scope_id end;
        ring boolean := false; cool int := private.config_int('calls.ring_cooldown_s', 600);
begin
  if me is null then raise exception 'Connexion requise' using errcode = '42501'; end if;
  if not coalesce((r ->> 'member')::boolean, false) then return jsonb_build_object('ok', false, 'reason', 'not_member'); end if;
  if not coalesce((r ->> 'can_join')::boolean, false) then return jsonb_build_object('ok', false, 'reason', r ->> 'reason'); end if;
  if coalesce(cardinality(p_present), 0) >= (r ->> 'max_participants')::int then return jsonb_build_object('ok', false, 'reason', 'full'); end if;
  foreach p in array coalesce(p_present, '{}'::uuid[]) loop
    if p <> me and not private.call_pair_ok(p_scope, p_scope_id, me, p) then
      return jsonb_build_object('ok', false, 'reason', 'pair');
    end if;
  end loop;
  perform private.rate_hit('call_join', 30, 3600);
  v := coalesce(p_video, false) and coalesce((r ->> 'video')::boolean, false);
  nm := case p_scope when 'circle' then (select display_name from public.circle_members where circle_id = p_scope_id and user_id = me)
                     else (select display_name from public.family_members where family_id = p_scope_id and user_id = me) end;
  -- Notification « appel en cours » : seulement pour la première personne, et pas plus d'une fois par délai.
  if coalesce(cardinality(p_present), 0) = 0 and private.config_bool('calls.push', false) then
    ring := not exists (select 1 from private.call_joins j where j.at > now() - make_interval(secs => cool)
                        and ((fid is not null and j.family_id = fid) or (cid is not null and j.circle_id = cid)));
  end if;
  delete from private.call_joins where at < now() - make_interval(days => private.config_int('retention.call_joins_days', 30));
  insert into private.call_joins (user_id, scope_type, family_id, circle_id, video) values (me, p_scope, fid, cid, v);
  return jsonb_build_object('ok', true, 'room', p_scope || '_' || p_scope_id::text, 'identity', me::text,
    'name', coalesce(nm, ''), 'video', v, 'admin', (r ->> 'admin')::boolean,
    'max_participants', (r ->> 'max_participants')::int,
    'token_ttl_s', least(greatest(private.config_int('calls.token_ttl_s', 600), 60), 3600), 'ring', ring);
end $$;
create or replace function public.call_join(p_scope text, p_scope_id uuid, p_video boolean, p_present uuid[]) returns jsonb
language sql security invoker set search_path = '' as $$ select private.call_join(p_scope, p_scope_id, p_video, p_present) $$;

-- ===================================================================== 6. Modération pendant l'appel
alter table private.moderation_actions drop constraint if exists moderation_actions_action_check;
alter table private.moderation_actions add constraint moderation_actions_action_check
  check (action in ('delete_group_message', 'report_status', 'platform_delete_group_message', 'call_mute', 'call_remove'));

-- Hôte = fondateur / modérateur d'un cercle, parent d'une famille. Un modérateur ne vise pas le fondateur ;
-- un parent ne vise pas un autre parent. Journalisé ; l'Edge Function applique ensuite l'action chez LiveKit.
create or replace function private.call_moderate(p_scope text, p_scope_id uuid, p_action text, p_target uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare me uuid := (select auth.uid()); r jsonb := private.call_rights(p_scope, p_scope_id); tr text;
begin
  if me is null then raise exception 'Connexion requise' using errcode = '42501'; end if;
  if p_action not in ('call_mute', 'call_remove') then raise exception 'Action inconnue' using errcode = 'check_violation'; end if;
  if not coalesce((r ->> 'admin')::boolean, false) or p_target = me then
    raise exception 'Action non autorisée' using errcode = '42501'; end if;
  tr := case p_scope when 'circle' then (select role from public.circle_members where circle_id = p_scope_id and user_id = p_target)
                     else (select role from public.family_members where family_id = p_scope_id and user_id = p_target) end;
  -- Personne sortie du groupe mais encore connectée : retrait toujours possible.
  if (p_scope = 'circle' and tr = 'founder') or (p_scope = 'family' and tr = 'parent') then
    raise exception 'Action non autorisée' using errcode = '42501'; end if;
  insert into private.moderation_actions (actor_id, action, target_id, target_user_id, scope_type, family_id, circle_id, snapshot)
    values (me, p_action, p_scope_id, p_target, p_scope,
            case when p_scope = 'family' then p_scope_id end, case when p_scope = 'circle' then p_scope_id end,
            jsonb_build_object('target_role', tr));
  return true;
end $$;
create or replace function public.call_moderate(p_scope text, p_scope_id uuid, p_action text, p_target uuid) returns boolean
language sql security invoker set search_path = '' as $$ select private.call_moderate(p_scope, p_scope_id, p_action, p_target) $$;

-- ===================================================================== 7. Notification « appel en cours » (rôle service)
-- Mêmes règles que les notifications de la discussion : membres seulement, blocages, sourdine, règles enfant ;
-- mineurs dans un cercle seulement avec consentement. Le texte envoyé ne contient que le nom du groupe.
create or replace function private.call_push_recipients(p_scope text, p_scope_id uuid, p_caller uuid)
returns table (token text, lang text, group_name text)
language sql stable security definer set search_path = '' as $$
  with members as (
    select fm.user_id, fm.role from public.family_members fm where p_scope = 'family' and fm.family_id = p_scope_id and fm.user_id is not null
    union all
    select cm.user_id, cm.role from public.circle_members cm where p_scope = 'circle' and cm.circle_id = p_scope_id
  )
  select t.token, t.lang,
         coalesce((select f.name from public.families f where p_scope = 'family' and f.id = p_scope_id),
                  (select c.name from public.circles c where p_scope = 'circle' and c.id = p_scope_id), '')
  from members m join public.device_push_tokens t on t.user_id = m.user_id and t.enabled
  where m.user_id <> p_caller
    and not private.is_suspended(m.user_id)
    and private.call_pair_ok(p_scope, p_scope_id, m.user_id, p_caller)
    and not exists (select 1 from public.group_prefs gp where gp.user_id = m.user_id and gp.muted
                    and ((p_scope = 'family' and gp.family_id = p_scope_id) or (p_scope = 'circle' and gp.circle_id = p_scope_id)))
    and case p_scope
          when 'circle' then not private.is_minor(m.user_id) or coalesce((select c.circles from private.minor_call_consent(m.user_id, null) c), false)
          else m.role <> 'child' or private.child_messaging_strict(p_scope_id, m.user_id) <> 'none'
        end;
$$;
create or replace function public.call_push_recipients(p_scope text, p_scope_id uuid, p_caller uuid)
returns table (token text, lang text, group_name text)
language sql stable security definer set search_path = '' as $$ select * from private.call_push_recipients(p_scope, p_scope_id, p_caller) $$;

-- ===================================================================== Droits
revoke all on function private.config_bool(text, boolean), private.config_int(text, int), private.minor_call_consent(uuid, uuid),
  private.call_rights(text, uuid), private.call_pair_ok(text, uuid, uuid, uuid), private.call_join(text, uuid, boolean, uuid[]),
  private.call_moderate(text, uuid, text, uuid), private.call_push_recipients(text, uuid, uuid) from public, anon;
grant execute on function private.config_bool(text, boolean), private.config_int(text, int), private.minor_call_consent(uuid, uuid),
  private.call_rights(text, uuid), private.call_pair_ok(text, uuid, uuid, uuid), private.call_join(text, uuid, boolean, uuid[]),
  private.call_moderate(text, uuid, text, uuid) to authenticated;
revoke execute on function private.call_push_recipients(text, uuid, uuid) from authenticated;
grant execute on function private.call_push_recipients(text, uuid, uuid) to service_role;
revoke all on function public.call_rights(text, uuid), public.call_join(text, uuid, boolean, uuid[]),
  public.call_moderate(text, uuid, text, uuid) from public, anon;
grant execute on function public.call_rights(text, uuid), public.call_join(text, uuid, boolean, uuid[]),
  public.call_moderate(text, uuid, text, uuid) to authenticated;
revoke all on function public.call_push_recipients(text, uuid, uuid) from public, anon, authenticated;
grant execute on function public.call_push_recipients(text, uuid, uuid) to service_role;
