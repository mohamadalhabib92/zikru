-- Appels : l’interrupteur reste fermé tant qu’aucune adresse de serveur n’est posée.
-- Classes : un enseignant validé par Bissabi (jamais soi-même) et Premium actif.
-- ADDITIVE. NON APPLIQUÉE au Supabase hébergé. Aucune ligne de zikr, de compteur ou de groupe n’est réécrite.
--
-- calls.enabled reste false. calls.server_url reste vide. Les deux doivent être remplis par Mohamed,
-- et le secret LiveKit reste dans l’environnement de la fonction call-token, jamais dans l’app.

insert into public.app_config (key, value, description) values
  ('calls.server_url', '""', 'Adresse wss du serveur LiveKit auto-hébergé. Vide ou invalide : les appels restent fermés, même si calls.enabled est true.')
on conflict (key) do nothing;

create or replace function private.calls_open() returns boolean
language sql stable security definer set search_path = '' as $$
  select private.config_bool('calls.enabled', false)
     and coalesce(private.config('calls.server_url') #>> '{}', '') ~ '^wss://[^[:space:]]+$';
$$;
revoke all on function private.calls_open() from public, anon;
grant execute on function private.calls_open() to authenticated;

-- ===================================================================== Droits d’appel (URL obligatoire, vidéo mixte fermée sur une classe)
create or replace function private.call_rights(p_scope text, p_scope_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare me uuid := (select auth.uid()); r text; minor boolean; c record; video boolean; reason text; n int;
        on_ boolean := private.calls_open();
        vid boolean := private.config_bool('calls.video', true);
        cap int := greatest(private.config_int('calls.max_participants', 12), 2);
        ck text; amix boolean; mixed boolean := false;
begin
  if me is null then return jsonb_build_object('member', false, 'enabled', on_); end if;
  minor := private.is_minor(me);
  if p_scope = 'circle' then
    r := private.circle_role(p_scope_id);
    if r is null then return jsonb_build_object('member', false, 'enabled', on_); end if;
    select count(*) into n from public.circle_members where circle_id = p_scope_id;
    select c2.kind, c2.allow_mixed_video into ck, amix from public.circles c2 where c2.id = p_scope_id;
    if minor then
      select * into c from private.minor_call_consent(me, null);
      if coalesce(ck, 'circle') = 'class' then
        if not private.minor_may_join_class(me, p_scope_id) then reason := 'parental'; end if;
        -- Vidéo d’une classe : accord « classes » et accord vidéo, pas l’accord des cercles de proches.
        video := coalesce((
          select bool_or(pc.allow_classes and pc.allow_video_calls)
          from public.family_members m
          join public.parental_controls pc on pc.child_member_id = m.id
          where m.user_id = me and m.role = 'child'), false);
      else
        if not coalesce(c.circles, false) then reason := 'parental'; end if;
        video := coalesce(c.video_circles, false);
      end if;
    else
      video := true;
    end if;
    if coalesce(ck, 'circle') = 'class' and not coalesce(amix, false) then
      video := false;
      mixed := true;
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
    'video_needs_consent', vid and not video and not mixed and (minor or r = 'child'),
    'mixed_closed', mixed,
    'admin', case p_scope when 'circle' then r in ('founder', 'moderator') else r = 'parent' end and reason is null,
    'max_participants', least(cap, greatest(n, 2)));
end $$;

-- L’hôte termine l’appel pour tout le monde. La fonction call-token supprime ensuite la salle LiveKit.
alter table private.moderation_actions drop constraint if exists moderation_actions_action_check;
alter table private.moderation_actions add constraint moderation_actions_action_check
  check (action in ('delete_group_message', 'report_status', 'platform_delete_group_message', 'call_mute', 'call_remove', 'call_end'));

create or replace function public.end_group_call(p_scope text, p_scope_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare me uuid := (select auth.uid()); r jsonb := private.call_rights(p_scope, p_scope_id);
begin
  if me is null then raise exception 'Connexion requise' using errcode = '42501'; end if;
  if p_scope not in ('family', 'circle') then raise exception 'Groupe invalide' using errcode = '22023'; end if;
  if not coalesce((r ->> 'admin')::boolean, false) then raise exception 'Action non autorisée' using errcode = '42501'; end if;
  insert into private.moderation_actions (actor_id, action, target_id, scope_type, family_id, circle_id, snapshot)
    values (me, 'call_end', p_scope_id, p_scope,
            case when p_scope = 'family' then p_scope_id end, case when p_scope = 'circle' then p_scope_id end,
            jsonb_build_object('by', 'host'));
  return true;
end $$;
revoke all on function public.end_group_call(text, uuid) from public, anon;
grant execute on function public.end_group_call(text, uuid) to authenticated;

-- ===================================================================== Classe = cercle marqué, sans toucher aux cercles déjà là
alter table public.circles
  add column if not exists kind text not null default 'circle',
  add column if not exists allow_minors boolean not null default false,
  add column if not exists allow_mixed_video boolean not null default false;
alter table public.circles drop constraint if exists circles_kind_check;
alter table public.circles add constraint circles_kind_check check (kind in ('circle', 'class'));

alter table public.parental_controls add column if not exists allow_classes boolean not null default false;

-- Mineur dans une classe : la classe est ouverte aux mineurs ET un parent a coché l’autorisation.
create or replace function private.minor_may_join_class(uid uuid, cid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.circles c where c.id = cid and c.kind = 'class' and c.allow_minors)
     and coalesce((
       select bool_or(pc.allow_classes)
       from public.family_members m
       join public.parental_controls pc on pc.child_member_id = m.id
       where m.user_id = uid and m.role = 'child'
     ), false);
$$;
revoke all on function private.minor_may_join_class(uuid, uuid) from public, anon;
grant execute on function private.minor_may_join_class(uuid, uuid) to authenticated;

-- Un mineur quitte les cercles de proches. Une classe déjà rejointe (parent + enseignant d’accord) reste.
create or replace function private.sync_minor(uid uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare minor boolean;
begin
  if uid is null then return; end if;
  minor := exists (select 1 from public.family_members where user_id = uid and role = 'child');
  update public.profiles set is_minor = minor where id = uid and is_minor is distinct from minor;
  if minor then
    delete from public.circle_members m using public.circles c
    where m.circle_id = c.id and m.user_id = uid and c.kind = 'circle';
  end if;
end $$;

-- Capacité : un cercle gratuit reste à la limite du plan. Une classe a son propre plafond (12, comme l’appel).
create or replace function private.group_member_cap(p_circle uuid) returns int
language plpgsql stable security definer set search_path = '' as $$
declare owner uuid; own_cap int; c public.circles; hard int;
begin
  select * into c from public.circles where id = p_circle;
  if not found then return 0; end if;
  hard := coalesce((private.config('max_group_members_hard') #>> '{}')::int, 500);
  if c.kind = 'class' then
    return least(coalesce(c.max_members, 12), hard);
  end if;
  select user_id into owner from public.circle_members where circle_id = p_circle and role = 'founder' order by joined_at limit 1;
  owner := coalesce(owner, c.created_by);
  own_cap := private.user_limit_int(owner, 'max_group_members_created', 2);
  return least(coalesce(own_cap, hard), coalesce(c.max_members, hard), hard);
end $$;

create or replace function private.circle_members_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare cap int; n int;
begin
  perform 1 from public.circles where id = new.circle_id for update;
  cap := private.group_member_cap(new.circle_id);
  select count(*) into n from public.circle_members where circle_id = new.circle_id;
  if n >= cap then
    raise exception 'Ce groupe est complet (% membres maximum, créateur inclus)', cap
      using errcode = 'ZKG01',
            detail = jsonb_build_object('reason', 'group_full', 'limit_key', 'max_group_members_created', 'limit', cap, 'members', n)::text,
            hint = 'Le propriétaire du groupe peut retirer un membre, ou la limite pourra évoluer.';
  end if;
  if private.is_minor(new.user_id) and not private.minor_may_join_class(new.user_id, new.circle_id) then
    raise exception 'Les comptes enfants restent dans leur famille' using errcode = '42501';
  end if;
  return new;
end $$;

-- Les classes ne comptent pas dans le plafond des cercles de proches.
create or replace function private.create_circle(p_name text, p_description text, p_rules text, p_display_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare me uuid := (select auth.uid()); cid uuid; lim int;
begin
  if me is null then raise exception 'Connexion requise' using errcode = '42501'; end if;
  if private.is_minor(me) then raise exception 'Les comptes enfants restent dans leur famille' using errcode = '42501'; end if;
  perform private.assert_may_create_group();
  lim := private.user_limit_int(me, 'max_groups_created', 20);
  if lim is not null and (select count(*) from public.circles where created_by = me and kind = 'circle') >= lim then
    raise exception 'Limite de % groupes créés atteinte', lim using errcode = 'ZKG02',
      detail = jsonb_build_object('reason', 'groups_created_limit', 'limit_key', 'max_groups_created', 'limit', lim)::text; end if;
  insert into public.circles (name, description, rules, created_by)
    values (trim(p_name), nullif(trim(p_description), ''), nullif(trim(p_rules), ''), me) returning id into cid;
  insert into public.circle_members (circle_id, user_id, display_name, role, rules_accepted_at) values (cid, me, trim(p_display_name), 'founder', now());
  insert into public.sharing_preferences (user_id, scope_type, circle_id, mode) values (me, 'circle', cid, 'participation');
  return cid;
end $$;

create or replace function private.accept_invitation(p_code text, p_display_name text, p_accept_rules boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := (select auth.uid()); i public.invitations; nm text := left(trim(coalesce(p_display_name, '')), 60);
begin
  if me is null then raise exception 'Connexion requise' using errcode = '42501'; end if;
  perform private.rate_hit('invite_attempt', 30, 3600);
  if nm = '' then raise exception 'Indiquez votre prénom' using errcode = 'check_violation'; end if;
  select * into i from public.invitations where code_hash = private.code_hash(p_code) for update;
  if not found or i.revoked_at is not null or i.expires_at < now() or i.uses >= i.max_uses then
    return jsonb_build_object('error', 'invalid');
  end if;
  if exists (select 1 from public.invitation_redemptions where invitation_id = i.id and user_id = me) then
    raise exception 'Invitation déjà utilisée par ce compte' using errcode = 'check_violation';
  end if;
  if i.scope_type = 'family' then
    if exists (select 1 from public.family_members where family_id = i.family_id and user_id = me) then
      raise exception 'Vous faites déjà partie de cette famille' using errcode = 'check_violation'; end if;
    if i.role = 'child' and exists (select 1 from public.family_members where user_id = me and role in ('parent','adult')) then
      raise exception 'Ce compte est adulte dans une autre famille' using errcode = 'check_violation'; end if;
    insert into public.family_members (family_id, user_id, display_name, role, managed_by)
      values (i.family_id, me, nm, i.role, case when i.role = 'child' then i.created_by end);
    insert into public.sharing_preferences (user_id, scope_type, family_id, mode) values (me, 'family', i.family_id, 'counter')
      on conflict (user_id, family_id, circle_id) do nothing;
    if i.role = 'child' then
      insert into public.parental_controls (child_member_id, family_id, updated_by)
        select m.id, i.family_id, i.created_by from public.family_members m where m.family_id = i.family_id and m.user_id = me;
    end if;
  else
    if private.is_minor(me) and not private.minor_may_join_class(me, i.circle_id) then
      raise exception 'Les comptes enfants restent dans leur famille' using errcode = '42501'; end if;
    if i.role = 'moderator' and private.is_minor(me) then
      raise exception 'Un enfant ne peut pas être modérateur' using errcode = '42501'; end if;
    if exists (select 1 from public.circles where id = i.circle_id and rules is not null) and not coalesce(p_accept_rules, false) then
      raise exception 'Le règlement du cercle doit être accepté' using errcode = 'check_violation'; end if;
    if exists (select 1 from public.circle_members where circle_id = i.circle_id and user_id = me) then
      raise exception 'Vous faites déjà partie de ce cercle' using errcode = 'check_violation'; end if;
    insert into public.circle_members (circle_id, user_id, display_name, role, rules_accepted_at)
      values (i.circle_id, me, nm, i.role, now());
    insert into public.sharing_preferences (user_id, scope_type, circle_id, mode) values (me, 'circle', i.circle_id, 'participation')
      on conflict (user_id, family_id, circle_id) do nothing;
  end if;
  insert into public.invitation_redemptions (invitation_id, user_id) values (i.id, me);
  update public.invitations set uses = uses + 1 where id = i.id;
  return jsonb_build_object('scope_type', i.scope_type, 'id', coalesce(i.family_id, i.circle_id));
end $$;

-- ===================================================================== Validation enseignant (Bissabi), jamais une case dans l’app
create table private.teacher_grants (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  granted_by uuid references public.profiles(id) on delete set null,
  note text check (note is null or char_length(note) <= 500),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz
);
alter table private.teacher_grants enable row level security;
revoke all on private.teacher_grants from public, anon, authenticated;

create or replace function private.has_teacher_grant(uid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from private.teacher_grants g where g.user_id = uid and g.revoked_at is null);
$$;

-- Les deux conditions : ligne posée par un admin, et Premium actif (plan qui peut créer un groupe).
create or replace function private.is_teacher(uid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.has_teacher_grant(uid) and private.may_create_groups(uid);
$$;
revoke all on function private.has_teacher_grant(uuid), private.is_teacher(uuid) from public, anon;
grant execute on function private.has_teacher_grant(uuid), private.is_teacher(uuid) to authenticated;

create or replace function public.am_i_teacher() returns boolean
language sql stable security invoker set search_path = '' as $$
  select private.is_teacher((select auth.uid()));
$$;
revoke all on function public.am_i_teacher() from public, anon;
grant execute on function public.am_i_teacher() to authenticated;

create or replace function public.grant_teacher(p_user uuid, p_note text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := (select auth.uid());
begin
  if me is null or not private.has_role('admin') then raise exception 'Réservé à l’administration Bissabi' using errcode = '42501'; end if;
  if p_user is null or p_user = me then raise exception 'On ne s’accorde pas le rôle soi-même' using errcode = '42501'; end if;
  if not exists (select 1 from public.profiles where id = p_user) then raise exception 'Compte introuvable' using errcode = 'P0002'; end if;
  insert into private.teacher_grants (user_id, granted_by, note)
    values (p_user, me, nullif(left(trim(coalesce(p_note, '')), 500), ''))
  on conflict (user_id) do update set revoked_at = null, granted_by = me, granted_at = now(), note = excluded.note;
end $$;

create or replace function public.revoke_teacher(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := (select auth.uid());
begin
  if me is null or not private.has_role('admin') then raise exception 'Réservé à l’administration Bissabi' using errcode = '42501'; end if;
  update private.teacher_grants set revoked_at = now() where user_id = p_user and revoked_at is null;
end $$;
revoke all on function public.grant_teacher(uuid, text), public.revoke_teacher(uuid) from public, anon;
grant execute on function public.grant_teacher(uuid, text), public.revoke_teacher(uuid) to authenticated;

create or replace function private.verse_count(p_surah int) returns int
language sql immutable as $$
  select (array[7,286,200,176,120,165,206,75,129,109,123,111,43,52,99,128,111,110,98,135,112,78,118,64,77,227,93,88,69,60,34,30,73,54,45,83,182,88,75,85,54,53,89,59,37,35,38,29,18,45,60,49,62,55,78,96,29,22,24,13,14,11,11,18,12,12,30,52,52,44,28,28,20,56,40,31,50,40,46,42,29,19,36,25,22,17,19,26,30,20,15,21,11,8,8,19,5,8,8,11,11,8,3,9,5,4,7,3,6,3,5,4,5,6])[p_surah];
$$;

create or replace function private.assert_passage(p_surah int, p_from int, p_to int) returns void
language plpgsql immutable as $$
declare n int := private.verse_count(p_surah);
begin
  if n is null or p_from < 1 or p_to < p_from or p_to > n then
    raise exception 'Passage invalide' using errcode = '22023';
  end if;
end $$;

create or replace function public.create_class(p_name text, p_description text, p_display_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare me uuid := (select auth.uid()); cid uuid; nm text := left(trim(coalesce(p_display_name, '')), 60);
begin
  if me is null then raise exception 'Connexion requise' using errcode = '42501'; end if;
  if private.is_minor(me) then raise exception 'Un compte enfant ne crée pas de classe' using errcode = '42501'; end if;
  if private.is_suspended(me) then raise exception 'Compte suspendu' using errcode = '42501'; end if;
  if not private.has_teacher_grant(me) then
    raise exception 'Rôle enseignant non validé' using errcode = 'ZKT01',
      detail = jsonb_build_object('reason', 'not_teacher')::text; end if;
  if not private.may_create_groups(me) then
    raise exception 'Créer une classe est réservé à Zikru Premium' using errcode = 'ZKP01',
      detail = jsonb_build_object('reason', 'premium_required', 'product', 'ch.mohamadba.zikru.premium.lifetime')::text; end if;
  if (select count(*) from public.circles where created_by = me and kind = 'class') >= 10 then
    raise exception 'Limite de classes atteinte' using errcode = 'ZKG02',
      detail = jsonb_build_object('reason', 'groups_created_limit', 'limit', 10)::text; end if;
  if nm = '' or char_length(trim(p_name)) < 1 or char_length(trim(p_name)) > 80 then
    raise exception 'Nom requis' using errcode = '22023'; end if;
  perform private.rate_hit('create_class', 10, 3600);
  insert into public.circles (name, description, kind, allow_minors, allow_mixed_video, max_members, created_by)
    values (trim(p_name), nullif(left(trim(coalesce(p_description, '')), 500), ''), 'class', false, false, 12, me)
    returning id into cid;
  insert into public.circle_members (circle_id, user_id, display_name, role, rules_accepted_at) values (cid, me, nm, 'founder', now());
  insert into public.sharing_preferences (user_id, scope_type, circle_id, mode) values (me, 'circle', cid, 'participation');
  return cid;
end $$;

create or replace function public.set_class_options(p_id uuid, p_allow_minors boolean, p_allow_mixed_video boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := (select auth.uid());
begin
  if me is null then raise exception 'Connexion requise' using errcode = '42501'; end if;
  if not private.is_teacher(me) then raise exception 'Rôle enseignant non validé' using errcode = 'ZKT01'; end if;
  if private.circle_role(p_id) is distinct from 'founder' then raise exception 'Réservé à l’enseignant de la classe' using errcode = '42501'; end if;
  if not exists (select 1 from public.circles where id = p_id and kind = 'class') then
    raise exception 'Classe introuvable' using errcode = 'P0002'; end if;
  update public.circles set allow_minors = coalesce(p_allow_minors, false), allow_mixed_video = coalesce(p_allow_mixed_video, false) where id = p_id;
end $$;

-- Leçon en direct : le son et l’image passent par l’appel du groupe (LiveKit), pas par une autre file.
create table public.class_lessons (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.circles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  starts_at timestamptz not null,
  surah int not null check (surah between 1 and 114),
  ayah_from int not null,
  ayah_to int not null,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  cancelled_at timestamptz
);
create index class_lessons_circle_idx on public.class_lessons (circle_id, starts_at);
alter table public.class_lessons enable row level security;
revoke all on public.class_lessons from anon, authenticated;
grant select on public.class_lessons to authenticated;
create policy class_lessons_select on public.class_lessons for select to authenticated
  using (private.is_circle_member(circle_id));

create table public.class_assignments (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.circles(id) on delete cascade,
  surah int not null check (surah between 1 and 114),
  ayah_from int not null,
  ayah_to int not null,
  note text check (note is null or char_length(note) <= 500),
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index class_assignments_circle_idx on public.class_assignments (circle_id, created_at desc);
alter table public.class_assignments enable row level security;
revoke all on public.class_assignments from anon, authenticated;
grant select on public.class_assignments to authenticated;
create policy class_assignments_select on public.class_assignments for select to authenticated
  using (private.is_circle_member(circle_id));

create table public.class_assignment_acks (
  assignment_id uuid not null references public.class_assignments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  done_at timestamptz not null default now(),
  primary key (assignment_id, user_id)
);
alter table public.class_assignment_acks enable row level security;
revoke all on public.class_assignment_acks from anon, authenticated;
grant select on public.class_assignment_acks to authenticated;
create policy class_assignment_acks_select on public.class_assignment_acks for select to authenticated
  using (user_id = (select auth.uid()) or exists (
    select 1 from public.class_assignments a where a.id = assignment_id and private.circle_role(a.circle_id) = 'founder'));

create or replace function public.schedule_class_lesson(p_class uuid, p_title text, p_starts_at timestamptz, p_surah int, p_from int, p_to int) returns uuid
language plpgsql security definer set search_path = '' as $$
declare me uuid := (select auth.uid()); lid uuid; title text := left(trim(coalesce(p_title, '')), 80);
begin
  if me is null then raise exception 'Connexion requise' using errcode = '42501'; end if;
  if not private.is_teacher(me) or private.circle_role(p_class) is distinct from 'founder' then
    raise exception 'Réservé à l’enseignant de la classe' using errcode = '42501'; end if;
  if not exists (select 1 from public.circles where id = p_class and kind = 'class') then
    raise exception 'Classe introuvable' using errcode = 'P0002'; end if;
  if title = '' then raise exception 'Titre requis' using errcode = '22023'; end if;
  if p_starts_at < now() - interval '5 minutes' or p_starts_at > now() + interval '1 year' then
    raise exception 'Horaire invalide' using errcode = '22023'; end if;
  perform private.assert_passage(p_surah, p_from, p_to);
  insert into public.class_lessons (circle_id, title, starts_at, surah, ayah_from, ayah_to, created_by)
    values (p_class, title, p_starts_at, p_surah, p_from, p_to, me) returning class_lessons.id into lid;
  return lid;
end $$;

create or replace function public.cancel_class_lesson(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := (select auth.uid()); cid uuid;
begin
  if me is null then raise exception 'Connexion requise' using errcode = '42501'; end if;
  select circle_id into cid from public.class_lessons where id = p_id and cancelled_at is null;
  if cid is null or private.circle_role(cid) is distinct from 'founder' or not private.is_teacher(me) then
    raise exception 'Réservé à l’enseignant de la classe' using errcode = '42501'; end if;
  update public.class_lessons set cancelled_at = now() where id = p_id;
end $$;

create or replace function public.assign_recitation(p_class uuid, p_surah int, p_from int, p_to int, p_note text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare me uuid := (select auth.uid()); aid uuid;
begin
  if me is null then raise exception 'Connexion requise' using errcode = '42501'; end if;
  if not private.is_teacher(me) or private.circle_role(p_class) is distinct from 'founder' then
    raise exception 'Réservé à l’enseignant de la classe' using errcode = '42501'; end if;
  if not exists (select 1 from public.circles where id = p_class and kind = 'class') then
    raise exception 'Classe introuvable' using errcode = 'P0002'; end if;
  perform private.assert_passage(p_surah, p_from, p_to);
  insert into public.class_assignments (circle_id, surah, ayah_from, ayah_to, note, created_by)
    values (p_class, p_surah, p_from, p_to, nullif(left(trim(coalesce(p_note, '')), 500), ''), me)
    returning class_assignments.id into aid;
  return aid;
end $$;

create or replace function public.mark_recitation_done(p_assignment uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := (select auth.uid()); cid uuid;
begin
  if me is null then raise exception 'Connexion requise' using errcode = '42501'; end if;
  select circle_id into cid from public.class_assignments where id = p_assignment;
  if cid is null or not private.is_circle_member(cid) then raise exception 'Devoir introuvable' using errcode = '42501'; end if;
  insert into public.class_assignment_acks (assignment_id, user_id) values (p_assignment, me)
  on conflict (assignment_id, user_id) do nothing;
end $$;

revoke all on function public.create_class(text, text, text), public.set_class_options(uuid, boolean, boolean),
  public.schedule_class_lesson(uuid, text, timestamptz, int, int, int), public.cancel_class_lesson(uuid),
  public.assign_recitation(uuid, int, int, int, text), public.mark_recitation_done(uuid) from public, anon;
grant execute on function public.create_class(text, text, text), public.set_class_options(uuid, boolean, boolean),
  public.schedule_class_lesson(uuid, text, timestamptz, int, int, int), public.cancel_class_lesson(uuid),
  public.assign_recitation(uuid, int, int, int, text), public.mark_recitation_done(uuid) to authenticated;
