-- Passe 6 (01.11.2026) — File de modération (rôle plateforme) + jetons de notification push. Migration ADDITIVE.
-- NON APPLIQUÉE au projet Supabase en ligne : à appliquer seulement après accord explicite de Mohamed,
-- et APRÈS la migration de la passe 5 (20261101100000_passe5_discussion_groupe.sql), dont elle dépend.
--
-- Contenu :
--   1. Modération plateforme : lecture de la file des signalements et changement de statut par RPC, réservés aux
--      comptes ayant le rôle serveur « moderator » ou « admin » (private.app_roles, passe 1). L'identité de la
--      personne qui signale n'est JAMAIS renvoyée. Chaque décision est journalisée (private.moderation_actions).
--   2. Suppression d'un message de groupe signalé par la modération plateforme (même effet que « supprimer pour
--      tous », copie gardée dans le journal côté équipe).
--   3. public.device_push_tokens : jetons Expo des appareils (un par appareil), écrits seulement par RPC,
--      lisibles par leur propriétaire ; liste des destinataires d'un message de groupe pour l'Edge Function
--      « push-group-message » (rôle service uniquement). Mêmes règles que la lecture du fil : membres seulement,
--      blocages dans les deux sens, règles enfant, sourdine respectée.
--   4. Conservation : jetons non revus depuis 90 jours supprimés par private.purge_push_tokens() (à planifier).
-- Le texte des messages n'est PAS mis dans les notifications (titre du groupe + « Nouveau message » seulement).

-- ===================================================================== 1. Modération plateforme
create or replace function private.is_platform_mod() returns boolean
language sql stable security definer set search_path = '' as $$
  select private.has_role('moderator') or private.has_role('admin');
$$;
revoke all on function private.is_platform_mod() from public, anon;
grant execute on function private.is_platform_mod() to authenticated;

-- Journal : nouveaux types d'action (élargissement de la contrainte, aucune ligne modifiée).
alter table private.moderation_actions drop constraint if exists moderation_actions_action_check;
alter table private.moderation_actions add constraint moderation_actions_action_check
  check (action in ('delete_group_message', 'report_status', 'platform_delete_group_message'));
alter table private.moderation_actions add column if not exists report_id uuid;
alter table private.moderation_actions add column if not exists note text check (note is null or char_length(note) <= 1000);

create or replace function private.moderation_queue_list(p_status text, p_limit int)
returns table (id uuid, created_at timestamptz, status text, reason text, target_type text, target_id uuid,
               target_user_id uuid, scope_type text, family_id uuid, circle_id uuid, reports_on_user int,
               details text, snapshot jsonb, resolution text, handled_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_platform_mod() then raise exception 'Action non autorisée' using errcode = '42501'; end if;
  if p_status not in ('open', 'reviewing', 'actioned', 'dismissed', 'pending') then
    raise exception 'Statut inconnu' using errcode = 'check_violation'; end if;
  return query
    select r.id, r.created_at, r.status, r.reason, r.target_type, r.target_id, r.target_user_id, r.scope_type,
           r.family_id, r.circle_id,
           (select count(*)::int from public.reports r2 where r.target_user_id is not null and r2.target_user_id = r.target_user_id),
           r.details, r.snapshot, r.resolution, r.handled_at
    from public.reports r
    where (p_status = 'pending' and r.status in ('open', 'reviewing')) or r.status = p_status
    order by case when r.reason = 'child_safety' then 0 when r.reason in ('self_harm', 'violence') then 1 else 2 end,
             r.created_at
    limit least(greatest(coalesce(p_limit, 50), 1), 200);
end $$;
create or replace function public.moderation_queue_list(p_status text default 'pending', p_limit int default 50)
returns table (id uuid, created_at timestamptz, status text, reason text, target_type text, target_id uuid,
               target_user_id uuid, scope_type text, family_id uuid, circle_id uuid, reports_on_user int,
               details text, snapshot jsonb, resolution text, handled_at timestamptz)
language sql stable security invoker set search_path = '' as $$ select * from private.moderation_queue_list(p_status, p_limit) $$;

create or replace function private.moderation_set_status(p_report uuid, p_status text, p_resolution text) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := (select auth.uid()); r public.reports;
begin
  if not private.is_platform_mod() then raise exception 'Action non autorisée' using errcode = '42501'; end if;
  if p_status not in ('open', 'reviewing', 'actioned', 'dismissed') then
    raise exception 'Statut inconnu' using errcode = 'check_violation'; end if;
  select * into r from public.reports where id = p_report;
  if not found then raise exception 'Signalement introuvable' using errcode = '42501'; end if;
  update public.reports set status = p_status,
      resolution = coalesce(nullif(left(trim(coalesce(p_resolution, '')), 1000), ''), resolution),
      handled_at = case when p_status in ('actioned', 'dismissed') then now() else handled_at end
    where id = p_report;
  insert into private.moderation_actions (actor_id, action, target_id, target_user_id, scope_type, family_id, circle_id, report_id, note, snapshot)
    values (me, 'report_status', r.target_id, r.target_user_id, r.scope_type, r.family_id, r.circle_id, r.id,
            nullif(left(trim(coalesce(p_resolution, '')), 1000), ''), jsonb_build_object('from', r.status, 'to', p_status));
end $$;
create or replace function public.moderation_set_status(p_report uuid, p_status text, p_resolution text default null) returns void
language sql security invoker set search_path = '' as $$ select private.moderation_set_status(p_report, p_status, p_resolution) $$;

-- ===================================================================== 2. Suppression par la modération plateforme
create or replace function private.platform_delete_group_message(p_report uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := (select auth.uid()); r public.reports; g public.group_messages;
begin
  if not private.is_platform_mod() then raise exception 'Action non autorisée' using errcode = '42501'; end if;
  select * into r from public.reports where id = p_report;
  if not found or r.target_type <> 'group_message' then raise exception 'Signalement introuvable' using errcode = '42501'; end if;
  select * into g from public.group_messages where id = r.target_id;
  if not found then raise exception 'Message introuvable' using errcode = '42501'; end if;
  if g.deleted_at is null then
    insert into private.moderation_actions (actor_id, action, target_id, target_user_id, scope_type, family_id, circle_id, report_id, snapshot)
      values (me, 'platform_delete_group_message', g.id, g.sender_id, g.scope_type, g.family_id, g.circle_id, r.id,
              jsonb_build_object('body', g.body, 'kind', g.kind, 'sender_name', g.sender_name, 'created_at', g.created_at));
    update public.group_messages set body = '', deleted_at = now(), deleted_by = me where id = g.id;
  end if;
end $$;
create or replace function public.platform_delete_group_message(p_report uuid) returns void
language sql security invoker set search_path = '' as $$ select private.platform_delete_group_message(p_report) $$;

revoke all on function private.moderation_queue_list(text, int), private.moderation_set_status(uuid, text, text),
  private.platform_delete_group_message(uuid) from public, anon;
grant execute on function private.moderation_queue_list(text, int), private.moderation_set_status(uuid, text, text),
  private.platform_delete_group_message(uuid) to authenticated;
revoke all on function public.moderation_queue_list(text, int), public.moderation_set_status(uuid, text, text),
  public.platform_delete_group_message(uuid) from public, anon;
grant execute on function public.moderation_queue_list(text, int), public.moderation_set_status(uuid, text, text),
  public.platform_delete_group_message(uuid) to authenticated;

-- ===================================================================== 3. Jetons de notification push
create table if not exists public.device_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  token text not null unique check (char_length(token) between 10 and 300),
  platform text not null check (platform in ('ios', 'android')),
  lang text not null default 'fr' check (char_length(lang) <= 8),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index if not exists device_push_tokens_user_idx on public.device_push_tokens (user_id);
create index if not exists device_push_tokens_seen_idx on public.device_push_tokens (last_seen_at);
alter table public.device_push_tokens enable row level security;
revoke all on public.device_push_tokens from public, anon, authenticated;
grant select (id, platform, lang, enabled, created_at, last_seen_at) on public.device_push_tokens to authenticated;
create policy device_push_tokens_select_own on public.device_push_tokens for select to authenticated
  using (user_id = (select auth.uid()));

-- Un jeton appartient à UN compte : s'il change de compte sur le même appareil, il est réattribué.
create or replace function private.register_push_token(p_token text, p_platform text, p_lang text) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := (select auth.uid());
begin
  if me is null then raise exception 'Connexion requise' using errcode = '42501'; end if;
  if p_platform not in ('ios', 'android') then raise exception 'Plateforme inconnue' using errcode = 'check_violation'; end if;
  if p_token !~ '^(Expo|Exponent)PushToken\[[A-Za-z0-9_-]{10,200}\]$' then
    raise exception 'Jeton invalide' using errcode = 'check_violation'; end if;
  perform private.rate_hit('push_token', 20, 86400);
  insert into public.device_push_tokens (user_id, token, platform, lang)
    values (me, p_token, p_platform, left(coalesce(nullif(p_lang, ''), 'fr'), 8))
  on conflict (token) do update set user_id = excluded.user_id, platform = excluded.platform, lang = excluded.lang,
    enabled = true, last_seen_at = now();
end $$;
create or replace function public.register_push_token(p_token text, p_platform text, p_lang text default 'fr') returns void
language sql security invoker set search_path = '' as $$ select private.register_push_token(p_token, p_platform, p_lang) $$;

create or replace function private.unregister_push_token(p_token text) returns void
language sql security definer set search_path = '' as $$
  delete from public.device_push_tokens where token = p_token and user_id = (select auth.uid());
$$;
create or replace function public.unregister_push_token(p_token text) returns void
language sql security invoker set search_path = '' as $$ select private.unregister_push_token(p_token) $$;

revoke all on function private.register_push_token(text, text, text), private.unregister_push_token(text) from public, anon;
grant execute on function private.register_push_token(text, text, text), private.unregister_push_token(text) to authenticated;
revoke all on function public.register_push_token(text, text, text), public.unregister_push_token(text) from public, anon;
grant execute on function public.register_push_token(text, text, text), public.unregister_push_token(text) to authenticated;

-- Destinataires d'un message de groupe (Edge Function, rôle service uniquement) : mêmes règles que gm_visible,
-- évaluées pour chaque destinataire ; l'auteur, les groupes en sourdine et les jetons désactivés sont exclus.
create or replace function private.group_push_recipients(p_message uuid)
returns table (token text, lang text, group_name text, scope_type text, scope_id uuid)
language sql stable security definer set search_path = '' as $$
  with g as (select * from public.group_messages where id = p_message and deleted_at is null),
  members as (
    select fm.user_id, fm.role, g.family_id as sid from g join public.family_members fm on g.scope_type = 'family' and fm.family_id = g.family_id
    union all
    select cm.user_id, cm.role, g.circle_id from g join public.circle_members cm on g.scope_type = 'circle' and cm.circle_id = g.circle_id
  )
  select t.token, t.lang,
         coalesce((select f.name from public.families f where f.id = g.family_id), (select c.name from public.circles c where c.id = g.circle_id), ''),
         g.scope_type, m.sid
  from g join members m on m.user_id <> g.sender_id
  join public.device_push_tokens t on t.user_id = m.user_id and t.enabled
  where not private.is_blocked(m.user_id, g.sender_id) and not private.is_blocked(g.sender_id, m.user_id)
    and not exists (select 1 from public.group_prefs p where p.user_id = m.user_id and p.muted
                    and ((g.scope_type = 'family' and p.family_id = g.family_id) or (g.scope_type = 'circle' and p.circle_id = g.circle_id)))
    and case g.scope_type
          when 'circle' then not private.is_minor(m.user_id)
          else (m.role <> 'child' or private.child_messaging_strict(g.family_id, m.user_id) <> 'none')
               and private.family_pair_ok(g.family_id, m.user_id, g.sender_id)
        end;
$$;
revoke all on function private.group_push_recipients(uuid) from public, anon, authenticated;
grant execute on function private.group_push_recipients(uuid) to service_role;

-- Jeton refusé par Expo (DeviceNotRegistered) : l'Edge Function le désactive.
create or replace function private.disable_push_token(p_token text) returns void
language sql security definer set search_path = '' as $$ update public.device_push_tokens set enabled = false where token = p_token $$;
revoke all on function private.disable_push_token(text) from public, anon, authenticated;
grant execute on function private.disable_push_token(text) to service_role;

-- Points d'entrée RPC pour l'Edge Function (supabase-js n'appelle que le schéma public) : rôle service uniquement.
create or replace function public.group_push_recipients(p_message uuid)
returns table (token text, lang text, group_name text, scope_type text, scope_id uuid)
language sql stable security definer set search_path = '' as $$ select * from private.group_push_recipients(p_message) $$;
create or replace function public.disable_push_token(p_token text) returns void
language sql security definer set search_path = '' as $$ select private.disable_push_token(p_token) $$;
revoke all on function public.group_push_recipients(uuid), public.disable_push_token(text) from public, anon, authenticated;
grant execute on function public.group_push_recipients(uuid), public.disable_push_token(text) to service_role;

-- ===================================================================== 4. Conservation
create or replace function private.purge_push_tokens() returns int
language sql security definer set search_path = '' as $$
  with d as (delete from public.device_push_tokens where last_seen_at < now() - interval '90 days' returning 1)
  select count(*)::int from d;
$$;
revoke all on function private.purge_push_tokens() from public, anon, authenticated;
