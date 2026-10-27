-- Zikru — Communautés niveaux 1 (Famille / Usra) et 2 (Proches / Ahbab).
-- Conçu pour accueillir plus tard : Locale (communities), Régionale (networks), Oumma (global_events).
-- Règles : RLS partout ; fonctions SECURITY DEFINER uniquement dans le schéma non exposé « private » ;
-- les mineurs ne sont jamais visibles hors de leur famille ; aucune découverte publique.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

-- ============ Tables ============
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 60),
  lang text not null default 'fr' check (lang in ('fr','en','de','de-CH','ar','ff','wo')),
  is_minor boolean not null default false,            -- géré par le serveur (rôle « enfant » dans une famille)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  wird text check (char_length(wird) <= 500),           -- wird familial
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.family_members (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,   -- null = enfant géré sans compte
  display_name text not null check (char_length(display_name) between 1 and 60),
  role text not null check (role in ('parent','adult','child','guest')),
  managed_by uuid references public.profiles(id) on delete set null,
  joined_at timestamptz not null default now(),
  unique (family_id, user_id),
  check (user_id is not null or role = 'child')
);
create index family_members_user_idx on public.family_members (user_id);
create index family_members_managed_by_idx on public.family_members (managed_by);

create table public.parental_controls (
  child_member_id uuid primary key references public.family_members(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  daily_minutes_limit int check (daily_minutes_limit between 5 and 600),
  messaging text not null default 'family' check (messaging in ('none','parents','family')),
  allow_circles boolean not null default false,        -- réservé : les mineurs ne rejoignent pas encore de cercles
  content_level text not null default 'enfant' check (content_level in ('enfant','ado')),
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);
create index parental_controls_family_idx on public.parental_controls (family_id);

create table public.circles (
  id uuid primary key default gen_random_uuid(),
  level smallint not null default 2 check (level = 2),  -- 2 = Proches ; 3+ = tables dédiées plus tard
  name text not null check (char_length(name) between 1 and 80),
  description text check (char_length(description) <= 500),
  rules text check (char_length(rules) <= 2000),
  max_members int not null default 50 check (max_members between 2 and 50),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.circle_members (
  circle_id uuid not null references public.circles(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 60),
  role text not null default 'member' check (role in ('founder','moderator','member')),
  rules_accepted_at timestamptz,
  joined_at timestamptz not null default now(),
  primary key (circle_id, user_id)
);
create index circle_members_user_idx on public.circle_members (user_id);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  scope_type text not null check (scope_type in ('family','circle')),
  family_id uuid references public.families(id) on delete cascade,
  circle_id uuid references public.circles(id) on delete cascade,
  role text not null default 'member' check (role in ('adult','child','guest','member','moderator')),
  max_uses int not null default 1 check (max_uses between 1 and 50),
  uses int not null default 0,
  expires_at timestamptz not null default now() + interval '7 days',
  revoked_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check ((scope_type = 'family' and family_id is not null and circle_id is null and role in ('adult','child','guest'))
      or (scope_type = 'circle' and circle_id is not null and family_id is null and role in ('member','moderator'))),
  check (expires_at <= created_at + interval '30 days')
);
create index invitations_family_idx on public.invitations (family_id);
create index invitations_circle_idx on public.invitations (circle_id);
create index invitations_created_by_idx on public.invitations (created_by);

create table public.invitation_redemptions (
  invitation_id uuid not null references public.invitations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  redeemed_at timestamptz not null default now(),
  primary key (invitation_id, user_id)
);
create index invitation_redemptions_user_idx on public.invitation_redemptions (user_id);

create table public.sharing_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  scope_type text not null check (scope_type in ('family','circle')),
  family_id uuid references public.families(id) on delete cascade,
  circle_id uuid references public.circles(id) on delete cascade,
  mode text not null check (mode in ('nothing','participation','counter')),
  updated_at timestamptz not null default now(),
  check ((scope_type = 'family' and family_id is not null and circle_id is null)
      or (scope_type = 'circle' and circle_id is not null and family_id is null)),
  unique nulls not distinct (user_id, family_id, circle_id)
);
create index sharing_preferences_family_idx on public.sharing_preferences (family_id);
create index sharing_preferences_circle_idx on public.sharing_preferences (circle_id);

create table public.shared_goals (
  id uuid primary key default gen_random_uuid(),
  scope_type text not null check (scope_type in ('family','circle')),
  family_id uuid references public.families(id) on delete cascade,
  circle_id uuid references public.circles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  formula text check (char_length(formula) <= 200),
  target bigint not null check (target between 1 and 100000000),
  starts_on date not null default current_date,
  ends_on date,
  status text not null default 'active' check (status in ('active','done','archived')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check ((scope_type = 'family' and family_id is not null and circle_id is null)
      or (scope_type = 'circle' and circle_id is not null and family_id is null))
);
create index shared_goals_family_idx on public.shared_goals (family_id);
create index shared_goals_circle_idx on public.shared_goals (circle_id);
create index shared_goals_created_by_idx on public.shared_goals (created_by);

create table public.goal_contributions (
  id bigint generated always as identity primary key,
  goal_id uuid not null references public.shared_goals(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,   -- compte qui a saisi
  member_id uuid references public.family_members(id) on delete cascade,  -- enfant géré (saisi par un parent)
  count int not null check (count between 1 and 100000),
  source text not null default 'manuel' check (source in ('manuel','bluetooth','clavier','live')),
  client_id text unique check (char_length(client_id) <= 64),            -- idempotence (file hors-ligne)
  created_at timestamptz not null default now()
);
create index goal_contributions_goal_idx on public.goal_contributions (goal_id);
create index goal_contributions_user_idx on public.goal_contributions (user_id);
create index goal_contributions_member_idx on public.goal_contributions (member_id);

-- Compteurs agrégés (extensible : scope_type 'community' / 'network' / 'global' plus tard)
create table public.aggregated_counters (
  id bigint generated always as identity primary key,
  scope_type text not null check (scope_type in ('family','circle','community','network','global')),
  scope_id uuid,
  goal_id uuid references public.shared_goals(id) on delete cascade,
  day date,
  total bigint not null default 0,
  contributions int not null default 0,
  updated_at timestamptz not null default now(),
  unique nulls not distinct (scope_type, scope_id, goal_id, day)
);
create index aggregated_counters_goal_idx on public.aggregated_counters (goal_id);

create table public.zikr_sessions (
  id uuid primary key default gen_random_uuid(),
  scope_type text not null check (scope_type in ('family','circle')),
  family_id uuid references public.families(id) on delete cascade,
  circle_id uuid references public.circles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  formula text check (char_length(formula) <= 200),
  target int check (target between 1 and 1000000),
  status text not null default 'live' check (status in ('live','ended')),
  started_by uuid references public.profiles(id) on delete set null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  check ((scope_type = 'family' and family_id is not null and circle_id is null)
      or (scope_type = 'circle' and circle_id is not null and family_id is null))
);
create index zikr_sessions_family_idx on public.zikr_sessions (family_id);
create index zikr_sessions_circle_idx on public.zikr_sessions (circle_id);
create index zikr_sessions_started_by_idx on public.zikr_sessions (started_by);

create table public.zikr_session_counts (
  session_id uuid not null references public.zikr_sessions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 60),
  count int not null default 0 check (count between 0 and 1000000),
  updated_at timestamptz not null default now(),
  primary key (session_id, user_id)
);
create index zikr_session_counts_user_idx on public.zikr_session_counts (user_id);

create table public.family_calendar_events (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  kind text not null default 'rappel' check (kind in ('wird','fete','zikr','cours','rappel','autre')),
  starts_at timestamptz not null,
  ends_at timestamptz,
  all_day boolean not null default false,
  notes text check (char_length(notes) <= 1000),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index family_calendar_events_family_idx on public.family_calendar_events (family_id, starts_at);
create index family_calendar_events_created_by_idx on public.family_calendar_events (created_by);

create table public.encouragements (
  id uuid primary key default gen_random_uuid(),
  scope_type text not null check (scope_type in ('family','circle')),
  family_id uuid references public.families(id) on delete cascade,
  circle_id uuid references public.circles(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null default 'bravo' check (kind in ('bravo','dua','rappel','salam')),
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  check (sender_id <> recipient_id),
  check ((scope_type = 'family' and family_id is not null and circle_id is null)
      or (scope_type = 'circle' and circle_id is not null and family_id is null))
);
create index encouragements_recipient_idx on public.encouragements (recipient_id, created_at desc);
create index encouragements_sender_idx on public.encouragements (sender_id);
create index encouragements_family_idx on public.encouragements (family_id);
create index encouragements_circle_idx on public.encouragements (circle_id);
-- ============ Fonctions d'appartenance (schéma privé, non exposé) ============
create or replace function private.is_family_member(fid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.family_members m where m.family_id = fid and m.user_id = (select auth.uid()));
$$;
create or replace function private.family_role(fid uuid) returns text
language sql stable security definer set search_path = '' as $$
  select m.role from public.family_members m where m.family_id = fid and m.user_id = (select auth.uid());
$$;
create or replace function private.is_family_parent(fid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(private.family_role(fid) = 'parent', false);
$$;
create or replace function private.is_family_adult(fid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(private.family_role(fid) in ('parent','adult'), false);
$$;
create or replace function private.is_circle_member(cid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.circle_members m where m.circle_id = cid and m.user_id = (select auth.uid()));
$$;
create or replace function private.circle_role(cid uuid) returns text
language sql stable security definer set search_path = '' as $$
  select m.role from public.circle_members m where m.circle_id = cid and m.user_id = (select auth.uid());
$$;
create or replace function private.is_circle_mod(cid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(private.circle_role(cid) in ('founder','moderator'), false);
$$;
create or replace function private.is_minor(uid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select p.is_minor from public.profiles p where p.id = uid), false);
$$;
create or replace function private.scope_member(st text, fid uuid, cid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select case st when 'family' then private.is_family_member(fid) when 'circle' then private.is_circle_member(cid) else false end;
$$;
create or replace function private.scope_admin(st text, fid uuid, cid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select case st when 'family' then private.is_family_adult(fid) when 'circle' then private.is_circle_mod(cid) else false end;
$$;
-- Visibilité d'un profil : soi-même, sa famille, ou ses cercles (jamais un mineur hors famille).
create or replace function private.can_see_profile(uid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select uid = (select auth.uid())
    or exists (select 1 from public.family_members a join public.family_members b on a.family_id = b.family_id
               where a.user_id = (select auth.uid()) and b.user_id = uid)
    or (not private.is_minor(uid) and exists (
          select 1 from public.circle_members a join public.circle_members b on a.circle_id = b.circle_id
          where a.user_id = (select auth.uid()) and b.user_id = uid));
$$;
create or replace function private.can_see_session(sid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.zikr_sessions s where s.id = sid and private.scope_member(s.scope_type, s.family_id, s.circle_id));
$$;
create or replace function private.session_live_and_visible(sid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.zikr_sessions s where s.id = sid and s.status = 'live'
                 and private.scope_member(s.scope_type, s.family_id, s.circle_id));
$$;
-- Réglage de messagerie d'un enfant dans une famille ('parents' | 'family'), défaut 'family'.
create or replace function private.child_messaging(fid uuid, uid uuid) returns text
language sql stable security definer set search_path = '' as $$
  select coalesce((select pc.messaging from public.family_members m join public.parental_controls pc on pc.child_member_id = m.id
                   where m.family_id = fid and m.user_id = uid), 'family');
$$;
-- Encouragements : famille = membres de la même famille (enfants selon contrôle parental) ; cercle = adultes du cercle.
create or replace function private.can_message(st text, fid uuid, cid uuid, recipient uuid) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare me uuid := (select auth.uid()); rrole text; srole text;
begin
  if me is null or recipient = me then return false; end if;
  if st = 'family' then
    select role into srole from public.family_members where family_id = fid and user_id = me;
    select role into rrole from public.family_members where family_id = fid and user_id = recipient;
    if srole is null or rrole is null then return false; end if;
    if srole = 'child' and private.child_messaging(fid, me) = 'parents' and rrole <> 'parent' then return false; end if;
    if rrole = 'child' and private.child_messaging(fid, recipient) = 'parents' and srole <> 'parent' then return false; end if;
    return true;
  elsif st = 'circle' then
    return private.is_circle_member(cid)
       and exists (select 1 from public.circle_members where circle_id = cid and user_id = recipient)
       and not private.is_minor(me) and not private.is_minor(recipient);
  end if;
  return false;
end $$;
create or replace function private.can_contribute(gid uuid, mid uuid) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare g public.shared_goals;
begin
  select * into g from public.shared_goals where id = gid;
  if not found or g.status <> 'active' then return false; end if;
  if not private.scope_member(g.scope_type, g.family_id, g.circle_id) then return false; end if;
  if mid is null then return true; end if;
  return g.scope_type = 'family' and private.is_family_parent(g.family_id)
     and exists (select 1 from public.family_members m where m.id = mid and m.family_id = g.family_id and m.role = 'child');
end $$;

-- ============ Codes d'invitation ============
create or replace function private.gen_code() returns text
language plpgsql volatile set search_path = '' as $$
declare alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; b bytea := extensions.gen_random_bytes(10); out text := ''; i int;
begin
  for i in 0..9 loop out := out || substr(alphabet, (get_byte(b, i) % 32) + 1, 1); end loop;
  return out;
end $$;

-- ============ Triggers ============
create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, left(coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'), ''), ''), 60))
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function private.handle_new_user();

create or replace function private.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$ begin new.updated_at := now(); return new; end $$;
create trigger profiles_touch before update on public.profiles for each row execute function private.touch_updated_at();

-- Statut mineur = rôle « enfant » dans au moins une famille ; un mineur quitte automatiquement tout cercle.
create or replace function private.sync_minor(uid uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare minor boolean;
begin
  if uid is null then return; end if;
  minor := exists (select 1 from public.family_members where user_id = uid and role = 'child');
  update public.profiles set is_minor = minor where id = uid and is_minor is distinct from minor;
  if minor then delete from public.circle_members where user_id = uid; end if;
end $$;

create or replace function private.family_members_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.role = 'parent' and (select count(*) from public.family_members
        where family_id = new.family_id and role = 'parent' and id <> new.id) >= 2 then
    raise exception 'Une famille compte au plus 2 parents administrateurs' using errcode = 'check_violation';
  end if;
  if (select count(*) from public.family_members where family_id = new.family_id and id <> new.id) >= 30 and tg_op = 'INSERT' then
    raise exception 'Une famille compte au plus 30 membres' using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger family_members_guard before insert or update of role on public.family_members
  for each row execute function private.family_members_guard();

create or replace function private.family_members_after() returns trigger
language plpgsql security definer set search_path = '' as $$
declare heir uuid;
begin
  if tg_op in ('INSERT','UPDATE') then perform private.sync_minor(new.user_id); end if;
  if tg_op in ('DELETE','UPDATE') then perform private.sync_minor(old.user_id); end if;
  if tg_op = 'DELETE' and old.role = 'parent'
     and exists (select 1 from public.families where id = old.family_id)
     and not exists (select 1 from public.family_members where family_id = old.family_id and role = 'parent') then
    select id into heir from public.family_members
      where family_id = old.family_id and user_id is not null and role in ('adult','guest')
      order by (role = 'adult') desc, joined_at limit 1;
    if heir is not null then
      update public.family_members set role = 'parent' where id = heir;
    elsif exists (select 1 from public.family_members where family_id = old.family_id and user_id is not null) then
      raise exception 'Nommez un autre parent avant de quitter la famille' using errcode = 'check_violation';
    else
      delete from public.families where id = old.family_id;  -- plus aucun compte : la famille est supprimée
    end if;
  end if;
  return null;
end $$;
create trigger family_members_after after insert or update or delete on public.family_members
  for each row execute function private.family_members_after();

-- Proches : 50 membres maximum (verrou sur le cercle → pas de dépassement concurrent) ; pas de mineurs.
create or replace function private.circle_members_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare cap int;
begin
  select max_members into cap from public.circles where id = new.circle_id for update;
  if (select count(*) from public.circle_members where circle_id = new.circle_id) >= cap then
    raise exception 'Ce cercle a atteint sa limite de % membres', cap using errcode = 'check_violation';
  end if;
  if private.is_minor(new.user_id) then
    raise exception 'Les comptes enfants restent dans leur famille' using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger circle_members_guard before insert on public.circle_members
  for each row execute function private.circle_members_guard();

create or replace function private.circle_members_after() returns trigger
language plpgsql security definer set search_path = '' as $$
declare heir uuid;
begin
  if old.role = 'founder' and exists (select 1 from public.circles where id = old.circle_id)
     and not exists (select 1 from public.circle_members where circle_id = old.circle_id and role = 'founder') then
    select user_id into heir from public.circle_members where circle_id = old.circle_id
      order by (role = 'moderator') desc, joined_at limit 1;
    if heir is null then delete from public.circles where id = old.circle_id;
    else update public.circle_members set role = 'founder' where circle_id = old.circle_id and user_id = heir; end if;
  end if;
  return null;
end $$;
create trigger circle_members_after after delete on public.circle_members
  for each row execute function private.circle_members_after();

-- Compteurs agrégés (total par objectif + total du jour par famille/cercle).
create or replace function private.goal_contributions_aggregate() returns trigger
language plpgsql security definer set search_path = '' as $$
declare r record; g public.shared_goals; sign int; sid uuid;
begin
  if tg_op = 'INSERT' then r := new; sign := 1; else r := old; sign := -1; end if;
  select * into g from public.shared_goals where id = r.goal_id;
  if not found then return null; end if;
  sid := coalesce(g.family_id, g.circle_id);
  insert into public.aggregated_counters as a (scope_type, scope_id, goal_id, day, total, contributions)
    values (g.scope_type, sid, g.id, null, greatest(sign * r.count, 0), greatest(sign, 0))
    on conflict (scope_type, scope_id, goal_id, day) do update
      set total = greatest(a.total + sign * r.count, 0), contributions = greatest(a.contributions + sign, 0), updated_at = now();
  insert into public.aggregated_counters as a (scope_type, scope_id, goal_id, day, total, contributions)
    values (g.scope_type, sid, null, (r.created_at at time zone 'UTC')::date, greatest(sign * r.count, 0), greatest(sign, 0))
    on conflict (scope_type, scope_id, goal_id, day) do update
      set total = greatest(a.total + sign * r.count, 0), contributions = greatest(a.contributions + sign, 0), updated_at = now();
  if sign = 1 and g.status = 'active' and (select total from public.aggregated_counters
        where scope_type = g.scope_type and scope_id = sid and goal_id = g.id and day is null) >= g.target then
    update public.shared_goals set status = 'done' where id = g.id;
  end if;
  return null;
end $$;
create trigger goal_contributions_aggregate after insert or delete on public.goal_contributions
  for each row execute function private.goal_contributions_aggregate();

-- ============ RPC (implémentations privées) ============
create or replace function private.create_family(p_name text, p_display_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare me uuid := (select auth.uid()); fid uuid;
begin
  if me is null then raise exception 'Connexion requise' using errcode = '42501'; end if;
  if private.is_minor(me) then raise exception 'Un compte enfant ne peut pas créer de famille' using errcode = '42501'; end if;
  if (select count(*) from public.family_members where user_id = me) >= 10 then
    raise exception 'Limite de 10 familles atteinte' using errcode = 'check_violation'; end if;
  insert into public.families (name, created_by) values (trim(p_name), me) returning id into fid;
  insert into public.family_members (family_id, user_id, display_name, role) values (fid, me, trim(p_display_name), 'parent');
  insert into public.sharing_preferences (user_id, scope_type, family_id, mode) values (me, 'family', fid, 'counter');
  return fid;
end $$;

create or replace function private.create_circle(p_name text, p_description text, p_rules text, p_display_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare me uuid := (select auth.uid()); cid uuid;
begin
  if me is null then raise exception 'Connexion requise' using errcode = '42501'; end if;
  if private.is_minor(me) then raise exception 'Les comptes enfants restent dans leur famille' using errcode = '42501'; end if;
  if (select count(*) from public.circles where created_by = me) >= 20 then
    raise exception 'Limite de 20 cercles créés atteinte' using errcode = 'check_violation'; end if;
  insert into public.circles (name, description, rules, created_by)
    values (trim(p_name), nullif(trim(p_description), ''), nullif(trim(p_rules), ''), me) returning id into cid;
  insert into public.circle_members (circle_id, user_id, display_name, role, rules_accepted_at) values (cid, me, trim(p_display_name), 'founder', now());
  insert into public.sharing_preferences (user_id, scope_type, circle_id, mode) values (me, 'circle', cid, 'participation');
  return cid;
end $$;

create or replace function private.create_invitation(p_scope text, p_scope_id uuid, p_role text, p_max_uses int, p_days int)
returns table (code text, expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare me uuid := (select auth.uid()); c text; e timestamptz;
begin
  if p_scope = 'family' then
    if not private.is_family_parent(p_scope_id) then raise exception 'Réservé aux parents de la famille' using errcode = '42501'; end if;
  elsif p_scope = 'circle' then
    if not private.is_circle_mod(p_scope_id) then raise exception 'Réservé au fondateur et aux modérateurs' using errcode = '42501'; end if;
  else raise exception 'Portée inconnue'; end if;
  e := now() + make_interval(days => least(greatest(coalesce(p_days, 7), 1), 30));
  loop
    c := private.gen_code();
    begin
      insert into public.invitations (code, scope_type, family_id, circle_id, role, max_uses, expires_at, created_by)
      values (c, p_scope, case when p_scope = 'family' then p_scope_id end, case when p_scope = 'circle' then p_scope_id end,
              p_role, least(greatest(coalesce(p_max_uses, 1), 1), 50), e, me);
      exit;
    exception when unique_violation then -- collision improbable : on régénère
    end;
  end loop;
  return query select c, e;
end $$;

create or replace function private.preview_invitation(p_code text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare i public.invitations; n text; rules text; cnt int; cap int;
begin
  if (select auth.uid()) is null then raise exception 'Connexion requise' using errcode = '42501'; end if;
  select * into i from public.invitations where code = upper(trim(p_code));
  if not found or i.revoked_at is not null or i.expires_at < now() or i.uses >= i.max_uses then
    return jsonb_build_object('valid', false);
  end if;
  if i.scope_type = 'family' then
    select name into n from public.families where id = i.family_id;
    select count(*) into cnt from public.family_members where family_id = i.family_id;
  else
    select name, c.rules, max_members into n, rules, cap from public.circles c where id = i.circle_id;
    select count(*) into cnt from public.circle_members where circle_id = i.circle_id;
  end if;
  return jsonb_build_object('valid', true, 'scope_type', i.scope_type, 'name', n, 'role', i.role,
    'rules', rules, 'members', cnt, 'max_members', cap, 'expires_at', i.expires_at);
end $$;

create or replace function private.accept_invitation(p_code text, p_display_name text, p_accept_rules boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := (select auth.uid()); i public.invitations; nm text := left(trim(coalesce(p_display_name, '')), 60);
begin
  if me is null then raise exception 'Connexion requise' using errcode = '42501'; end if;
  if nm = '' then raise exception 'Indiquez votre prénom' using errcode = 'check_violation'; end if;
  select * into i from public.invitations where code = upper(trim(p_code)) for update;
  if not found or i.revoked_at is not null or i.expires_at < now() or i.uses >= i.max_uses then
    raise exception 'Invitation invalide ou expirée' using errcode = 'P0002';
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
    if private.is_minor(me) then raise exception 'Les comptes enfants restent dans leur famille' using errcode = '42501'; end if;
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

create or replace function private.add_managed_child(p_family uuid, p_display_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare me uuid := (select auth.uid()); mid uuid;
begin
  if not private.is_family_parent(p_family) then raise exception 'Réservé aux parents' using errcode = '42501'; end if;
  insert into public.family_members (family_id, user_id, display_name, role, managed_by)
    values (p_family, null, left(trim(p_display_name), 60), 'child', me) returning id into mid;
  insert into public.parental_controls (child_member_id, family_id, updated_by) values (mid, p_family, me);
  return mid;
end $$;

create or replace function private.set_member_role(p_member uuid, p_role text) returns void
language plpgsql security definer set search_path = '' as $$
declare m public.family_members;
begin
  select * into m from public.family_members where id = p_member;
  if not found or not private.is_family_parent(m.family_id) then raise exception 'Réservé aux parents' using errcode = '42501'; end if;
  if p_role not in ('parent','adult','child','guest') then raise exception 'Rôle inconnu'; end if;
  if m.user_id is null and p_role <> 'child' then raise exception 'Un enfant sans compte reste « enfant »'; end if;
  if m.role = 'parent' and p_role <> 'parent' and (select count(*) from public.family_members where family_id = m.family_id and role = 'parent') < 2 then
    raise exception 'La famille doit garder au moins un parent' using errcode = 'check_violation'; end if;
  if p_role = 'child' and m.user_id is not null and exists (select 1 from public.family_members where user_id = m.user_id and role in ('parent','adult') and id <> m.id) then
    raise exception 'Ce compte est adulte dans une autre famille' using errcode = 'check_violation'; end if;
  update public.family_members set role = p_role where id = p_member;
  if p_role = 'child' then
    insert into public.parental_controls (child_member_id, family_id, updated_by) values (p_member, m.family_id, (select auth.uid()))
      on conflict (child_member_id) do nothing;
  else
    delete from public.parental_controls where child_member_id = p_member;
  end if;
end $$;

create or replace function private.set_circle_role(p_circle uuid, p_user uuid, p_role text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if private.circle_role(p_circle) <> 'founder' then raise exception 'Réservé au fondateur' using errcode = '42501'; end if;
  if p_role not in ('moderator','member') then raise exception 'Rôle inconnu'; end if;
  update public.circle_members set role = p_role where circle_id = p_circle and user_id = p_user and role <> 'founder';
end $$;

-- Avancée d'un objectif, masquée selon les préférences de partage de chacun.
create or replace function private.goal_progress(p_goal uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare g public.shared_goals; tot bigint; res jsonb;
begin
  select * into g from public.shared_goals where id = p_goal;
  if not found or not private.scope_member(g.scope_type, g.family_id, g.circle_id) then
    raise exception 'Objectif introuvable' using errcode = 'P0002'; end if;
  select coalesce(sum(count), 0) into tot from public.goal_contributions where goal_id = g.id;
  if g.scope_type = 'family' then
    select coalesce(jsonb_agg(x order by x->>'name'), '[]'::jsonb) into res from (
      select jsonb_build_object('member_id', m.id, 'name', m.display_name, 'role', m.role,
        'participated', s.n > 0,
        'count', case when coalesce(sp.mode, 'counter') = 'counter' then s.n end) as x
      from public.family_members m
      left join public.sharing_preferences sp on sp.user_id = m.user_id and sp.family_id = g.family_id
      cross join lateral (select coalesce(sum(c.count), 0) as n from public.goal_contributions c
        where c.goal_id = g.id and (c.member_id = m.id or (c.member_id is null and m.user_id is not null and c.user_id = m.user_id))) s
      where m.family_id = g.family_id and coalesce(sp.mode, 'counter') <> 'nothing') q;
  else
    select coalesce(jsonb_agg(x order by x->>'name'), '[]'::jsonb) into res from (
      select jsonb_build_object('user_id', m.user_id, 'name', m.display_name, 'role', m.role,
        'participated', s.n > 0,
        'count', case when sp.mode = 'counter' or m.user_id = (select auth.uid()) then s.n end) as x
      from public.circle_members m
      left join public.sharing_preferences sp on sp.user_id = m.user_id and sp.circle_id = g.circle_id
      cross join lateral (select coalesce(sum(c.count), 0) as n from public.goal_contributions c
        where c.goal_id = g.id and c.user_id = m.user_id) s
      where m.circle_id = g.circle_id and (coalesce(sp.mode, 'participation') <> 'nothing' or m.user_id = (select auth.uid()))) q;
  end if;
  return jsonb_build_object('goal_id', g.id, 'title', g.title, 'target', g.target, 'total', tot, 'status', g.status, 'members', res);
end $$;

-- Suppression de compte (exigence App Store) : familles orphelines supprimées, puis l'utilisateur.
create or replace function private.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := (select auth.uid());
begin
  if me is null then raise exception 'Connexion requise' using errcode = '42501'; end if;
  delete from public.families f where exists (select 1 from public.family_members m where m.family_id = f.id and m.user_id = me and m.role = 'parent')
    and not exists (select 1 from public.family_members o where o.family_id = f.id and o.user_id is not null and o.user_id <> me and o.role in ('parent','adult','guest'));
  delete from auth.users where id = me;
end $$;

revoke all on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated;
-- ============ RLS ============
alter table public.profiles enable row level security;
alter table public.families enable row level security;
alter table public.family_members enable row level security;
alter table public.parental_controls enable row level security;
alter table public.circles enable row level security;
alter table public.circle_members enable row level security;
alter table public.invitations enable row level security;
alter table public.invitation_redemptions enable row level security;
alter table public.sharing_preferences enable row level security;
alter table public.shared_goals enable row level security;
alter table public.goal_contributions enable row level security;
alter table public.aggregated_counters enable row level security;
alter table public.zikr_sessions enable row level security;
alter table public.zikr_session_counts enable row level security;
alter table public.family_calendar_events enable row level security;
alter table public.encouragements enable row level security;

-- Aucun accès anonyme : tout passe par un compte connecté.
revoke all on public.profiles, public.families, public.family_members, public.parental_controls, public.circles,
  public.circle_members, public.invitations, public.invitation_redemptions, public.sharing_preferences, public.shared_goals,
  public.goal_contributions, public.aggregated_counters, public.zikr_sessions, public.zikr_session_counts,
  public.family_calendar_events, public.encouragements from anon;

-- Écritures limitées colonne par colonne là où des champs sont gérés par le serveur.
revoke insert, update on public.profiles from authenticated;
grant update (display_name, lang) on public.profiles to authenticated;
revoke insert, update on public.families from authenticated;
grant update (name, wird) on public.families to authenticated;
revoke insert, update on public.family_members from authenticated;
grant update (display_name) on public.family_members to authenticated;
revoke insert, update on public.circles from authenticated;
grant update (name, description, rules) on public.circles to authenticated;
revoke insert, update on public.circle_members from authenticated;
grant update (display_name) on public.circle_members to authenticated;
revoke insert, update on public.invitations from authenticated;
grant update (revoked_at) on public.invitations to authenticated;
revoke insert, update, delete on public.invitation_redemptions, public.aggregated_counters from authenticated;
revoke update on public.goal_contributions from authenticated;
revoke update on public.encouragements from authenticated;
grant update (read_at) on public.encouragements to authenticated;
revoke update on public.zikr_sessions from authenticated;
grant update (status, ended_at) on public.zikr_sessions to authenticated;

-- profiles
create policy profiles_select on public.profiles for select to authenticated using (private.can_see_profile(id));
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- families
create policy families_select on public.families for select to authenticated using (private.is_family_member(id));
create policy families_update on public.families for update to authenticated
  using (private.is_family_parent(id)) with check (private.is_family_parent(id));
create policy families_delete on public.families for delete to authenticated using (private.is_family_parent(id));

-- family_members
create policy family_members_select on public.family_members for select to authenticated using (private.is_family_member(family_id));
create policy family_members_update on public.family_members for update to authenticated
  using (private.is_family_parent(family_id) or user_id = (select auth.uid()))
  with check (private.is_family_parent(family_id) or user_id = (select auth.uid()));
create policy family_members_delete on public.family_members for delete to authenticated
  using (private.is_family_parent(family_id) or user_id = (select auth.uid()));

-- parental_controls (parents ; l'enfant peut lire ses propres réglages)
create policy parental_controls_select on public.parental_controls for select to authenticated
  using (private.is_family_parent(family_id)
         or exists (select 1 from public.family_members m where m.id = child_member_id and m.user_id = (select auth.uid())));
create policy parental_controls_insert on public.parental_controls for insert to authenticated
  with check (private.is_family_parent(family_id)
    and exists (select 1 from public.family_members m where m.id = child_member_id and m.family_id = parental_controls.family_id and m.role = 'child'));
create policy parental_controls_update on public.parental_controls for update to authenticated
  using (private.is_family_parent(family_id))
  with check (private.is_family_parent(family_id)
    and exists (select 1 from public.family_members m where m.id = child_member_id and m.family_id = parental_controls.family_id and m.role = 'child'));
create policy parental_controls_delete on public.parental_controls for delete to authenticated using (private.is_family_parent(family_id));

-- circles
create policy circles_select on public.circles for select to authenticated using (private.is_circle_member(id));
create policy circles_update on public.circles for update to authenticated
  using (private.is_circle_mod(id)) with check (private.is_circle_mod(id));
create policy circles_delete on public.circles for delete to authenticated using (private.circle_role(id) = 'founder');

-- circle_members
create policy circle_members_select on public.circle_members for select to authenticated using (private.is_circle_member(circle_id));
create policy circle_members_update on public.circle_members for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy circle_members_delete on public.circle_members for delete to authenticated
  using (user_id = (select auth.uid()) or (private.is_circle_mod(circle_id) and role <> 'founder'));

-- invitations (visibles et révocables par leur créateur et les administrateurs du lieu)
create policy invitations_select on public.invitations for select to authenticated
  using (created_by = (select auth.uid())
         or (scope_type = 'family' and private.is_family_parent(family_id))
         or (scope_type = 'circle' and private.is_circle_mod(circle_id)));
create policy invitations_update on public.invitations for update to authenticated
  using (created_by = (select auth.uid())
         or (scope_type = 'family' and private.is_family_parent(family_id))
         or (scope_type = 'circle' and private.is_circle_mod(circle_id)))
  with check (true);
create policy invitations_delete on public.invitations for delete to authenticated
  using (created_by = (select auth.uid())
         or (scope_type = 'family' and private.is_family_parent(family_id))
         or (scope_type = 'circle' and private.is_circle_mod(circle_id)));

create policy invitation_redemptions_select on public.invitation_redemptions for select to authenticated
  using (user_id = (select auth.uid()));

-- sharing_preferences (chacun gère les siennes, dans un lieu dont il est membre)
create policy sharing_preferences_select on public.sharing_preferences for select to authenticated
  using (user_id = (select auth.uid()));
create policy sharing_preferences_insert on public.sharing_preferences for insert to authenticated
  with check (user_id = (select auth.uid()) and private.scope_member(scope_type, family_id, circle_id));
create policy sharing_preferences_update on public.sharing_preferences for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and private.scope_member(scope_type, family_id, circle_id));
create policy sharing_preferences_delete on public.sharing_preferences for delete to authenticated
  using (user_id = (select auth.uid()));

-- shared_goals
create policy shared_goals_select on public.shared_goals for select to authenticated
  using (private.scope_member(scope_type, family_id, circle_id));
create policy shared_goals_insert on public.shared_goals for insert to authenticated
  with check (created_by = (select auth.uid()) and private.scope_admin(scope_type, family_id, circle_id));
create policy shared_goals_update on public.shared_goals for update to authenticated
  using (private.scope_admin(scope_type, family_id, circle_id))
  with check (private.scope_admin(scope_type, family_id, circle_id));
create policy shared_goals_delete on public.shared_goals for delete to authenticated
  using (private.scope_admin(scope_type, family_id, circle_id));

-- goal_contributions (chacun voit les siennes ; l'avancée commune passe par goal_progress / aggregated_counters)
create policy goal_contributions_select on public.goal_contributions for select to authenticated
  using (user_id = (select auth.uid()));
create policy goal_contributions_insert on public.goal_contributions for insert to authenticated
  with check (user_id = (select auth.uid()) and private.can_contribute(goal_id, member_id));
create policy goal_contributions_delete on public.goal_contributions for delete to authenticated
  using (user_id = (select auth.uid()) and created_at > now() - interval '1 day');

-- aggregated_counters (lecture seule, membres du lieu)
create policy aggregated_counters_select on public.aggregated_counters for select to authenticated
  using ((scope_type = 'family' and private.is_family_member(scope_id))
      or (scope_type = 'circle' and private.is_circle_member(scope_id)));

-- zikr_sessions (zikr en direct)
create policy zikr_sessions_select on public.zikr_sessions for select to authenticated
  using (private.scope_member(scope_type, family_id, circle_id));
create policy zikr_sessions_insert on public.zikr_sessions for insert to authenticated
  with check (started_by = (select auth.uid()) and status = 'live' and private.scope_member(scope_type, family_id, circle_id));
create policy zikr_sessions_update on public.zikr_sessions for update to authenticated
  using (started_by = (select auth.uid()) or private.scope_admin(scope_type, family_id, circle_id))
  with check (started_by = (select auth.uid()) or private.scope_admin(scope_type, family_id, circle_id));

create policy zikr_session_counts_select on public.zikr_session_counts for select to authenticated
  using (private.can_see_session(session_id));
create policy zikr_session_counts_insert on public.zikr_session_counts for insert to authenticated
  with check (user_id = (select auth.uid()) and private.session_live_and_visible(session_id));
create policy zikr_session_counts_update on public.zikr_session_counts for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and private.session_live_and_visible(session_id));

-- family_calendar_events
create policy family_calendar_events_select on public.family_calendar_events for select to authenticated
  using (private.is_family_member(family_id));
create policy family_calendar_events_insert on public.family_calendar_events for insert to authenticated
  with check (created_by = (select auth.uid()) and private.is_family_adult(family_id));
create policy family_calendar_events_update on public.family_calendar_events for update to authenticated
  using (private.is_family_adult(family_id)) with check (private.is_family_adult(family_id));
create policy family_calendar_events_delete on public.family_calendar_events for delete to authenticated
  using (private.is_family_adult(family_id));

-- encouragements (privés : expéditeur, destinataire ; les parents voient ceux de leurs enfants)
create policy encouragements_select on public.encouragements for select to authenticated
  using (sender_id = (select auth.uid()) or recipient_id = (select auth.uid())
         or (scope_type = 'family' and private.is_family_parent(family_id)
             and (private.is_minor(sender_id) or private.is_minor(recipient_id))));
create policy encouragements_insert on public.encouragements for insert to authenticated
  with check (sender_id = (select auth.uid()) and private.can_message(scope_type, family_id, circle_id, recipient_id));
create policy encouragements_update on public.encouragements for update to authenticated
  using (recipient_id = (select auth.uid())) with check (recipient_id = (select auth.uid()));
create policy encouragements_delete on public.encouragements for delete to authenticated
  using (sender_id = (select auth.uid()) or recipient_id = (select auth.uid()));

-- ============ RPC publiques (SECURITY INVOKER → implémentation privée) ============
create function public.create_family(p_name text, p_display_name text) returns uuid
language sql security invoker set search_path = '' as $$ select private.create_family(p_name, p_display_name) $$;
create function public.create_circle(p_name text, p_description text, p_rules text, p_display_name text) returns uuid
language sql security invoker set search_path = '' as $$ select private.create_circle(p_name, p_description, p_rules, p_display_name) $$;
create function public.create_invitation(p_scope text, p_scope_id uuid, p_role text, p_max_uses int default 1, p_days int default 7)
returns table (code text, expires_at timestamptz)
language sql security invoker set search_path = '' as $$ select * from private.create_invitation(p_scope, p_scope_id, p_role, p_max_uses, p_days) $$;
create function public.preview_invitation(p_code text) returns jsonb
language sql security invoker set search_path = '' as $$ select private.preview_invitation(p_code) $$;
create function public.accept_invitation(p_code text, p_display_name text, p_accept_rules boolean default false) returns jsonb
language sql security invoker set search_path = '' as $$ select private.accept_invitation(p_code, p_display_name, p_accept_rules) $$;
create function public.add_managed_child(p_family uuid, p_display_name text) returns uuid
language sql security invoker set search_path = '' as $$ select private.add_managed_child(p_family, p_display_name) $$;
create function public.set_member_role(p_member uuid, p_role text) returns void
language sql security invoker set search_path = '' as $$ select private.set_member_role(p_member, p_role) $$;
create function public.set_circle_role(p_circle uuid, p_user uuid, p_role text) returns void
language sql security invoker set search_path = '' as $$ select private.set_circle_role(p_circle, p_user, p_role) $$;
create function public.goal_progress(p_goal uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$ select private.goal_progress(p_goal) $$;
create function public.delete_my_account() returns void
language sql security invoker set search_path = '' as $$ select private.delete_my_account() $$;

revoke execute on function public.create_family(text, text), public.create_circle(text, text, text, text),
  public.create_invitation(text, uuid, text, int, int), public.preview_invitation(text), public.accept_invitation(text, text, boolean),
  public.add_managed_child(uuid, text), public.set_member_role(uuid, text), public.set_circle_role(uuid, uuid, text),
  public.goal_progress(uuid), public.delete_my_account() from public, anon;
grant execute on function public.create_family(text, text), public.create_circle(text, text, text, text),
  public.create_invitation(text, uuid, text, int, int), public.preview_invitation(text), public.accept_invitation(text, text, boolean),
  public.add_managed_child(uuid, text), public.set_member_role(uuid, text), public.set_circle_role(uuid, uuid, text),
  public.goal_progress(uuid), public.delete_my_account() to authenticated;

-- ============ Realtime (postgres_changes, filtré par RLS) ============
alter publication supabase_realtime add table public.aggregated_counters, public.zikr_sessions,
  public.zikr_session_counts, public.encouragements, public.shared_goals;
alter table public.zikr_session_counts replica identity full;
