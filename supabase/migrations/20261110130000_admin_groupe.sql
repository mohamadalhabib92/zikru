-- Droits d’administration d’un groupe de zikr.
-- NON APPLIQUÉE au projet Supabase hébergé. Ne pas lancer ce fichier sur la production.
-- N’efface et ne réécrit aucune donnée existante : politiques et fonctions seulement,
-- plus une colonne position nullable (les objectifs déjà là restent position = null)
-- et une table de demandes d’entrée.
--
-- Déjà en place avant ce fichier (conservé) :
--   * le créateur d’une famille est parent, le créateur d’un cercle est fondateur ;
--   * pas d’adhésion publique (insert direct retiré ; entrée par invitation) ;
--   * suppression de la famille : parents ; suppression du cercle : fondateur ;
--   * retrait d’un autre membre de la famille : parents ; on peut toujours quitter soi-même ;
--   * invitation famille : parents seulement.
-- Ajusté ici :
--   * composer le zikr (objectifs, programme, session) : parent ou fondateur, plus l’adulte ni le modérateur ;
--   * retirer un autre membre d’un cercle : fondateur seulement ;
--   * invitation d’un cercle : fondateur seulement (plus le modérateur) ;
--   * demande d’entrée, acceptée par l’administrateur, sans Premium ;
--   * delete_group : l’administrateur supprime ce groupe seulement (cascade de CE groupe).

-- Parent d’une famille, ou fondateur d’un cercle. Pas l’adulte, pas le modérateur, pas le membre.
create or replace function private.is_group_admin(st text, fid uuid, cid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select case st
    when 'family' then private.is_family_parent(fid)
    when 'circle' then coalesce(private.circle_role(cid) = 'founder', false)
    else false end $$;

-- Objectifs : lecture inchangée (tous les membres). Écriture : administrateur seulement.
drop policy if exists shared_goals_insert on public.shared_goals;
drop policy if exists shared_goals_update on public.shared_goals;
drop policy if exists shared_goals_delete on public.shared_goals;
create policy shared_goals_insert on public.shared_goals for insert to authenticated
  with check (created_by = (select auth.uid()) and private.is_group_admin(scope_type, family_id, circle_id));
create policy shared_goals_update on public.shared_goals for update to authenticated
  using (private.is_group_admin(scope_type, family_id, circle_id))
  with check (private.is_group_admin(scope_type, family_id, circle_id));
create policy shared_goals_delete on public.shared_goals for delete to authenticated
  using (private.is_group_admin(scope_type, family_id, circle_id));

-- Ordre choisi par l’administrateur. null = ordre d’origine (created_at), aucune réécriture des lignes existantes.
alter table public.shared_goals add column if not exists position int;
alter table public.shared_goals drop constraint if exists shared_goals_position_check;
alter table public.shared_goals add constraint shared_goals_position_check check (position is null or position between 1 and 10000);

-- Programme : même administrateur. Les compteurs d’étapes ne sont pas touchés par un simple changement de nombre ou d’ordre.
create or replace function private.program_admin_check(st text, fid uuid, cid uuid) returns void
language plpgsql stable security definer set search_path = '' as $$
declare me uuid := (select auth.uid());
begin
  if me is null then raise exception 'Connexion requise' using errcode = '42501'; end if;
  if private.is_minor(me) then raise exception 'Un compte enfant ne peut pas créer de programme de groupe.' using errcode = '42501'; end if;
  if private.is_suspended(me) then raise exception 'Compte suspendu par la modération.' using errcode = '42501'; end if;
  if not private.is_group_admin(st, fid, cid) then raise exception 'Action non autorisée pour votre rôle.' using errcode = '42501'; end if;
end $$;

create or replace function public.set_program_step_target(p_step uuid, p_target int) returns void
language plpgsql security definer set search_path = '' as $$
declare s public.group_program_steps; g public.group_programs;
begin
  if p_target is null or p_target < 1 or p_target > 100000 then
    raise exception 'Nombre invalide' using errcode = '22023'; end if;
  select * into s from public.group_program_steps where id = p_step;
  if not found then raise exception 'Étape introuvable' using errcode = 'P0002'; end if;
  select * into g from public.group_programs where id = s.program_id;
  perform private.program_admin_check(g.scope_type, g.family_id, g.circle_id);
  update public.group_program_steps set target = p_target where id = p_step;
  -- Les lignes group_program_progress restent. On ne les recopie pas sur une autre étape.
end $$;

-- L’unicité (programme, position) est différée le temps d’échanger deux étapes, sans toucher aux compteurs.
alter table public.group_program_steps drop constraint if exists group_program_steps_program_id_position_key;
alter table public.group_program_steps add constraint group_program_steps_program_id_position_key
  unique (program_id, position) deferrable initially deferred;

create or replace function public.move_program_step(p_step uuid, p_direction int) returns void
language plpgsql security definer set search_path = '' as $$
declare s public.group_program_steps; g public.group_programs; other uuid; op int;
begin
  if p_direction not in (-1, 1) then raise exception 'Direction invalide' using errcode = '22023'; end if;
  select * into s from public.group_program_steps where id = p_step for update;
  if not found then raise exception 'Étape introuvable' using errcode = 'P0002'; end if;
  select * into g from public.group_programs where id = s.program_id;
  perform private.program_admin_check(g.scope_type, g.family_id, g.circle_id);
  select id, position into other, op from public.group_program_steps
    where program_id = s.program_id and position = s.position + p_direction
    for update;
  if other is null then return; end if;
  update public.group_program_steps set position = case id when s.id then op when other then s.position end
    where id in (s.id, other);
end $$;

-- Session : la composer (titre, formule, nombre) est réservée à l’administrateur. Compter reste ouvert aux membres.
drop policy if exists zikr_sessions_insert on public.zikr_sessions;
create policy zikr_sessions_insert on public.zikr_sessions for insert to authenticated
  with check (started_by = (select auth.uid()) and status = 'live' and private.is_group_admin(scope_type, family_id, circle_id));

-- Cercle : un modérateur ne retire plus un membre. Chacun peut encore partir. Le fondateur retire les autres, pas son propre rôle par cette clause.
drop policy if exists circle_members_delete on public.circle_members;
create policy circle_members_delete on public.circle_members for delete to authenticated
  using (user_id = (select auth.uid()) or (private.circle_role(circle_id) = 'founder' and role <> 'founder'));

-- Invitation : l’administrateur seulement (parent ou fondateur). Rejoindre avec le code reste gratuit.
create or replace function private.create_invitation(p_scope text, p_scope_id uuid, p_role text, p_max_uses int, p_days int)
returns table (id uuid, code text, expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare me uuid := (select auth.uid()); c text; e timestamptz; nid uuid;
begin
  if me is null then raise exception 'Connexion requise' using errcode = '42501'; end if;
  if p_scope = 'family' then
    if not private.is_family_parent(p_scope_id) then raise exception 'Réservé aux parents de la famille' using errcode = '42501'; end if;
    if p_role not in ('parent','adult','child','guest') then raise exception 'Rôle inconnu' using errcode = 'check_violation'; end if;
  elsif p_scope = 'circle' then
    if private.circle_role(p_scope_id) <> 'founder' then raise exception 'Réservé au fondateur du cercle' using errcode = '42501'; end if;
    if p_role not in ('member','moderator') then raise exception 'Rôle inconnu' using errcode = 'check_violation'; end if;
  else raise exception 'Portée inconnue' using errcode = 'check_violation'; end if;
  perform private.rate_hit('invite_create', 20, 3600);
  e := now() + make_interval(days => least(greatest(coalesce(p_days, 7), 1), 30));
  loop
    c := private.gen_code();
    begin
      insert into public.invitations (code_hash, scope_type, family_id, circle_id, role, max_uses, expires_at, created_by)
      values (private.code_hash(c), p_scope, case when p_scope = 'family' then p_scope_id end, case when p_scope = 'circle' then p_scope_id end,
              p_role, least(greatest(coalesce(p_max_uses, 1), 1), 50), e, me)
      returning invitations.id into nid;
      exit;
    exception when unique_violation then
    end;
  end loop;
  return query select nid, c, e;
end $$;

-- Demandes d’entrée. Pas d’annuaire : il faut l’identifiant du groupe (lien partagé par l’administrateur).
create table public.group_join_requests (
  id uuid primary key default gen_random_uuid(),
  scope_type text not null check (scope_type in ('family', 'circle')),
  family_id uuid references public.families(id) on delete cascade,
  circle_id uuid references public.circles(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 60),
  message text check (message is null or char_length(message) <= 280),
  status text not null default 'pending' check (status in ('pending', 'approved', 'refused')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  check ((scope_type = 'family' and family_id is not null and circle_id is null)
      or (scope_type = 'circle' and circle_id is not null and family_id is null))
);
create unique index group_join_requests_pending_family
  on public.group_join_requests (user_id, family_id) where status = 'pending' and family_id is not null;
create unique index group_join_requests_pending_circle
  on public.group_join_requests (user_id, circle_id) where status = 'pending' and circle_id is not null;

alter table public.group_join_requests enable row level security;
revoke all on public.group_join_requests from anon, authenticated;
grant select on public.group_join_requests to authenticated;
create policy group_join_requests_select on public.group_join_requests for select to authenticated
  using (user_id = (select auth.uid())
      or (scope_type = 'family' and private.is_family_parent(family_id))
      or (scope_type = 'circle' and private.circle_role(circle_id) = 'founder'));

create or replace function public.request_group_join(p_scope text, p_scope_id uuid, p_display_name text, p_message text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare me uuid := (select auth.uid()); nm text := left(trim(coalesce(p_display_name, '')), 60); rid uuid; msg text := nullif(left(trim(coalesce(p_message, '')), 280), '');
begin
  if me is null then raise exception 'Connexion requise' using errcode = '42501'; end if;
  if nm = '' then raise exception 'Indiquez votre prénom' using errcode = 'check_violation'; end if;
  if private.is_minor(me) then raise exception 'Un compte enfant rejoint par invitation d’un parent' using errcode = '42501'; end if;
  perform private.rate_hit('join_request', 10, 3600);
  if p_scope = 'family' then
    if not exists (select 1 from public.families where id = p_scope_id) then raise exception 'Groupe introuvable' using errcode = 'P0002'; end if;
    if exists (select 1 from public.family_members where family_id = p_scope_id and user_id = me) then
      raise exception 'Vous faites déjà partie de cette famille' using errcode = 'check_violation'; end if;
    insert into public.group_join_requests (scope_type, family_id, user_id, display_name, message)
      values ('family', p_scope_id, me, nm, msg) returning id into rid;
  elsif p_scope = 'circle' then
    if not exists (select 1 from public.circles where id = p_scope_id) then raise exception 'Groupe introuvable' using errcode = 'P0002'; end if;
    if exists (select 1 from public.circle_members where circle_id = p_scope_id and user_id = me) then
      raise exception 'Vous faites déjà partie de ce cercle' using errcode = 'check_violation'; end if;
    insert into public.group_join_requests (scope_type, circle_id, user_id, display_name, message)
      values ('circle', p_scope_id, me, nm, msg) returning id into rid;
  else raise exception 'Groupe invalide' using errcode = '22023'; end if;
  return rid;
exception when unique_violation then
  select id into rid from public.group_join_requests
    where user_id = me and status = 'pending' and ((p_scope = 'family' and family_id = p_scope_id) or (p_scope = 'circle' and circle_id = p_scope_id))
    limit 1;
  return rid;
end $$;

create or replace function public.review_group_join_request(p_id uuid, p_approve boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := (select auth.uid()); r public.group_join_requests;
begin
  if me is null then raise exception 'Connexion requise' using errcode = '42501'; end if;
  select * into r from public.group_join_requests where id = p_id for update;
  if not found or r.status <> 'pending' then raise exception 'Demande introuvable' using errcode = 'P0002'; end if;
  if not private.is_group_admin(r.scope_type, r.family_id, r.circle_id) then
    raise exception 'Réservé à l’administrateur du groupe' using errcode = '42501'; end if;
  if not coalesce(p_approve, false) then
    update public.group_join_requests set status = 'refused', reviewed_at = now(), reviewed_by = me where id = r.id;
    return;
  end if;
  if r.scope_type = 'family' then
    if not exists (select 1 from public.family_members where family_id = r.family_id and user_id = r.user_id) then
      insert into public.family_members (family_id, user_id, display_name, role) values (r.family_id, r.user_id, r.display_name, 'adult');
      insert into public.sharing_preferences (user_id, scope_type, family_id, mode) values (r.user_id, 'family', r.family_id, 'counter')
        on conflict (user_id, family_id, circle_id) do nothing;
    end if;
  else
    if not exists (select 1 from public.circle_members where circle_id = r.circle_id and user_id = r.user_id) then
      insert into public.circle_members (circle_id, user_id, display_name, role, rules_accepted_at)
        values (r.circle_id, r.user_id, r.display_name, 'member', now());
      insert into public.sharing_preferences (user_id, scope_type, circle_id, mode) values (r.user_id, 'circle', r.circle_id, 'participation')
        on conflict (user_id, family_id, circle_id) do nothing;
    end if;
  end if;
  update public.group_join_requests set status = 'approved', reviewed_at = now(), reviewed_by = me where id = r.id;
end $$;

-- Supprime CE groupe seulement. La cascade enlève ses membres, objectifs et compteurs de CE groupe.
-- Elle ne touche pas au profil, ni aux objectifs d’un autre groupe, ni aux zikrs personnels (ils ne sont pas en base).
create or replace function public.delete_group(p_scope text, p_scope_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := (select auth.uid());
begin
  if me is null then raise exception 'Connexion requise' using errcode = '42501'; end if;
  if p_scope = 'family' then
    if not private.is_family_parent(p_scope_id) then raise exception 'Réservé à l’administrateur du groupe' using errcode = '42501'; end if;
    delete from public.families where id = p_scope_id;
  elsif p_scope = 'circle' then
    if private.circle_role(p_scope_id) <> 'founder' then raise exception 'Réservé à l’administrateur du groupe' using errcode = '42501'; end if;
    delete from public.circles where id = p_scope_id;
  else raise exception 'Groupe invalide' using errcode = '22023'; end if;
end $$;

-- Archivage et indicateur « peut administrer » : parent ou fondateur, pas l’adulte ni le modérateur.
create or replace function public.set_group_program_status(p_id uuid, p_status text) returns void
language plpgsql security definer set search_path = '' as $$
declare g public.group_programs;
begin
  select * into g from public.group_programs where id = p_id;
  if not found then raise exception 'Programme introuvable' using errcode = 'P0002'; end if;
  if p_status not in ('active','archived') then raise exception 'Statut invalide' using errcode = '22023'; end if;
  if not private.is_group_admin(g.scope_type, g.family_id, g.circle_id) then
    raise exception 'Action non autorisée pour votre rôle.' using errcode = '42501'; end if;
  update public.group_programs set status = p_status, updated_at = now() where id = p_id;
end $$;

create or replace function public.group_program_view(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare me uuid := (select auth.uid()); g public.group_programs; steps jsonb; members jsonb;
begin
  select * into g from public.group_programs where id = p_id;
  if not found or not private.scope_member(g.scope_type, g.family_id, g.circle_id) then
    raise exception 'Programme introuvable' using errcode = 'P0002'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'position', s.position, 'label', s.label, 'arabic', s.arabic,
      'translit', s.translit, 'translation', s.translation, 'target', s.target, 'verification', s.verification,
      'source_ref', s.source_ref,
      'total', (select coalesce(sum(p.count), 0) from public.group_program_progress p where p.step_id = s.id),
      'done_by', (select count(*) from public.group_program_progress p where p.step_id = s.id and p.count >= s.target),
      'mine', (select p.count from public.group_program_progress p where p.step_id = s.id and p.user_id = me))
    order by s.position), '[]'::jsonb) into steps
  from public.group_program_steps s where s.program_id = g.id;

  select coalesce(jsonb_agg(x order by x ->> 'name'), '[]'::jsonb) into members from (
    select jsonb_build_object('user_id', u.user_id, 'name', u.display_name, 'me', u.user_id = me,
      'participated', exists (select 1 from public.group_program_progress p where p.program_id = g.id and p.user_id = u.user_id and p.count > 0),
      'steps_done', case when u.mode = 'counter' or u.user_id = me then (select count(*) from public.group_program_progress p
          join public.group_program_steps s on s.id = p.step_id where p.program_id = g.id and p.user_id = u.user_id and p.count >= s.target) end,
      'counts', case when u.mode = 'counter' or u.user_id = me then (select coalesce(jsonb_object_agg(s.position::text, p.count), '{}'::jsonb)
          from public.group_program_progress p join public.group_program_steps s on s.id = p.step_id
          where p.program_id = g.id and p.user_id = u.user_id) end) as x
    from (
      select m.user_id, m.display_name, coalesce(sp.mode, 'counter') as mode from public.family_members m
        left join public.sharing_preferences sp on sp.user_id = m.user_id and sp.family_id = g.family_id
        where g.scope_type = 'family' and m.family_id = g.family_id and m.user_id is not null
      union all
      select m.user_id, m.display_name, coalesce(sp.mode, 'participation') from public.circle_members m
        left join public.sharing_preferences sp on sp.user_id = m.user_id and sp.circle_id = g.circle_id
        where g.scope_type = 'circle' and m.circle_id = g.circle_id
    ) u where u.mode <> 'nothing' or u.user_id = me) q;

  return jsonb_build_object('id', g.id, 'scope_type', g.scope_type, 'scope_id', coalesce(g.family_id, g.circle_id),
    'title', g.title, 'description', g.description, 'source_note', g.source_note, 'version', g.version,
    'status', g.status, 'created_by', g.created_by, 'created_at', g.created_at,
    'can_admin', private.is_group_admin(g.scope_type, g.family_id, g.circle_id) and not private.is_minor(me),
    'steps', steps, 'members', members);
end $$;

revoke all on function public.request_group_join(text, uuid, text, text), public.review_group_join_request(uuid, boolean),
  public.delete_group(text, uuid), public.set_program_step_target(uuid, int), public.move_program_step(uuid, int)
  from public, anon;
grant execute on function public.request_group_join(text, uuid, text, text), public.review_group_join_request(uuid, boolean),
  public.delete_group(text, uuid), public.set_program_step_target(uuid, int), public.move_program_step(uuid, int)
  to authenticated;
