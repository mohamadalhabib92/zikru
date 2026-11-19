-- Programmes de groupe : un programme de zikr ordonné (étapes) partagé dans une famille ou un cercle,
-- avec la progression de chaque membre étape par étape (Tasbih de groupe qui enchaîne les étapes).
-- ADDITIVE : nouvelles tables, fonctions et réglages ; rien n'est supprimé ni modifié dans l'existant.
-- NON APPLIQUÉE au projet Supabase en ligne : à appliquer seulement après accord explicite de Mohamed.
--
-- Contenu :
--   1. public.group_programs : titre, description, source, version, statut (actif / archivé).
--   2. public.group_program_steps : étapes ordonnées — libellé, texte arabe complet, translittération,
--      traduction, nombre, statut de lecture (« unverified » lu sur un document / « catalogue » / « quran »
--      reconnu par l'appareil dans le catalogue de l'app) et référence de source. Aucun statut « validé ».
--   3. public.group_program_progress : avancée de chaque personne par étape (lisible par elle seule ; les autres
--      voient l'avancée via group_program_view, masquée selon les préférences de partage existantes).
--   4. Droits : lecture = membres du groupe ; création / modification / archivage = mêmes rôles que shared_goals
--      (famille : parent ou adulte ; cercle : fondateur ou modérateur), jamais un compte mineur, jamais un compte
--      suspendu ; filtre de termes sur tous les textes ; débit limité. Écriture uniquement par RPC.
--   5. Idempotence : l'identifiant du programme est choisi par l'appareil ; un renvoi renvoie le même programme.

insert into public.app_config (key, value, description) values
  ('rate.group_program',   '{"max": 20, "window_s": 3600}',   'Programmes de groupe créés ou modifiés par heure et par personne.'),
  ('rate.program_progress','{"max": 1200, "window_s": 3600}', 'Enregistrements d''avancée d''un programme de groupe par heure et par personne.')
on conflict (key) do nothing;

-- ===================================================================== 1-3. Tables
create table public.group_programs (
  id uuid primary key,                                            -- choisi par l'appareil (idempotence)
  scope_type text not null check (scope_type in ('family','circle')),
  family_id uuid references public.families(id) on delete cascade,
  circle_id uuid references public.circles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  description text check (char_length(description) <= 500),
  source_note text check (char_length(source_note) <= 200),      -- ex. « Importé d'un document » (jamais la photo)
  version int not null default 1 check (version >= 1),
  status text not null default 'active' check (status in ('active','archived')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((scope_type = 'family' and family_id is not null and circle_id is null)
      or (scope_type = 'circle' and circle_id is not null and family_id is null))
);
create index group_programs_family_idx on public.group_programs (family_id);
create index group_programs_circle_idx on public.group_programs (circle_id);
create index group_programs_created_by_idx on public.group_programs (created_by);

create table public.group_program_steps (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.group_programs(id) on delete cascade,
  position int not null check (position between 1 and 100),
  label text not null check (char_length(label) between 1 and 120),
  arabic text check (char_length(arabic) <= 4000),
  translit text check (char_length(translit) <= 4000),
  translation text check (char_length(translation) <= 4000),
  target int not null check (target between 1 and 100000),
  verification text not null default 'unverified' check (verification in ('unverified','catalogue','quran')),
  source_ref text check (char_length(source_ref) <= 200),
  unique (program_id, position),
  unique (id, program_id)
);

create table public.group_program_progress (
  program_id uuid not null references public.group_programs(id) on delete cascade,
  step_id uuid not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  count int not null default 0 check (count between 0 and 100000),
  updated_at timestamptz not null default now(),
  primary key (step_id, user_id),
  foreign key (step_id, program_id) references public.group_program_steps(id, program_id) on delete cascade
);
create index group_program_progress_program_idx on public.group_program_progress (program_id);
create index group_program_progress_user_idx on public.group_program_progress (user_id);

alter table public.group_programs enable row level security;
alter table public.group_program_steps enable row level security;
alter table public.group_program_progress enable row level security;
revoke all on public.group_programs, public.group_program_steps, public.group_program_progress from anon, authenticated;
grant select on public.group_programs, public.group_program_steps, public.group_program_progress to authenticated;

create or replace function private.program_member(pid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.group_programs p where p.id = pid and private.scope_member(p.scope_type, p.family_id, p.circle_id));
$$;

create policy group_programs_select on public.group_programs for select to authenticated
  using (private.scope_member(scope_type, family_id, circle_id));
create policy group_program_steps_select on public.group_program_steps for select to authenticated
  using (private.program_member(program_id));
create policy group_program_progress_select on public.group_program_progress for select to authenticated
  using (user_id = (select auth.uid()) and private.program_member(program_id));

-- Filtre de termes (même déclencheur générique que shared_goals / familles / cercles).
create trigger group_programs_filter before insert or update of title, description, source_note on public.group_programs
  for each row execute function private.content_filter_guard('title', 'description', 'source_note');
create trigger group_program_steps_filter before insert or update of label, arabic, translit, translation, source_ref on public.group_program_steps
  for each row execute function private.content_filter_guard('label', 'arabic', 'translit', 'translation', 'source_ref');

-- ===================================================================== 4. Droits d'écriture
-- Peut créer / modifier un programme dans ce groupe : mêmes rôles que shared_goals_insert, + ni mineur ni suspendu.
create or replace function private.program_admin_check(st text, fid uuid, cid uuid) returns void
language plpgsql stable security definer set search_path = '' as $$
declare me uuid := (select auth.uid());
begin
  if me is null then raise exception 'Connexion requise' using errcode = '42501'; end if;
  if private.is_minor(me) then raise exception 'Un compte enfant ne peut pas créer de programme de groupe.' using errcode = '42501'; end if;
  if private.is_suspended(me) then raise exception 'Compte suspendu par la modération.' using errcode = '42501'; end if;
  if not private.scope_admin(st, fid, cid) then raise exception 'Action non autorisée pour votre rôle.' using errcode = '42501'; end if;
end $$;

-- Insère les étapes (tableau JSON ordonné) d'un programme ; positions 1..n dans l'ordre reçu.
create or replace function private.program_insert_steps(pid uuid, p_steps jsonb) returns int
language plpgsql security definer set search_path = '' as $$
declare n int := coalesce(jsonb_array_length(p_steps), 0);
begin
  if jsonb_typeof(p_steps) is distinct from 'array' or n < 1 or n > 100 then
    raise exception 'Un programme contient de 1 à 100 étapes.' using errcode = '22023'; end if;
  insert into public.group_program_steps (program_id, position, label, arabic, translit, translation, target, verification, source_ref)
  select pid, e.ord::int, trim(e.v ->> 'label'), nullif(e.v ->> 'arabic', ''), nullif(e.v ->> 'translit', ''),
         nullif(e.v ->> 'translation', ''), (e.v ->> 'target')::int, coalesce(nullif(e.v ->> 'verification', ''), 'unverified'),
         nullif(e.v ->> 'source_ref', '')
  from jsonb_array_elements(p_steps) with ordinality as e(v, ord);
  return n;
end $$;

create or replace function public.create_group_program(p_id uuid, p_scope text, p_scope_id uuid, p_title text,
  p_steps jsonb, p_description text default null, p_source_note text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := (select auth.uid()); fid uuid; cid uuid; g public.group_programs;
begin
  if p_scope not in ('family','circle') then raise exception 'Groupe invalide' using errcode = '22023'; end if;
  fid := case when p_scope = 'family' then p_scope_id end;
  cid := case when p_scope = 'circle' then p_scope_id end;
  perform private.program_admin_check(p_scope, fid, cid);
  -- Renvoi du même lot (double appui, réseau coupé) : on rend le programme existant, sans doublon.
  select * into g from public.group_programs where id = p_id;
  if found then
    if g.created_by is distinct from me or g.scope_type <> p_scope or coalesce(g.family_id, g.circle_id) <> p_scope_id then
      raise exception 'Identifiant déjà utilisé' using errcode = '23505'; end if;
    return jsonb_build_object('id', g.id, 'created', false, 'version', g.version);
  end if;
  perform private.rate_hit('group_program', 20, 3600);
  insert into public.group_programs (id, scope_type, family_id, circle_id, title, description, source_note, created_by)
    values (p_id, p_scope, fid, cid, trim(p_title), nullif(trim(p_description), ''), nullif(trim(p_source_note), ''), me);
  perform private.program_insert_steps(p_id, p_steps);
  return jsonb_build_object('id', p_id, 'created', true, 'version', 1);
end $$;

-- Remplace les étapes (nouvelle version). Refuse si quelqu'un d'autre a modifié entre-temps (40001).
-- Les avancées de l'ancienne version sont effacées (les étapes changent).
create or replace function public.update_group_program(p_id uuid, p_expected_version int, p_title text, p_steps jsonb,
  p_description text default null) returns int
language plpgsql security definer set search_path = '' as $$
declare g public.group_programs;
begin
  select * into g from public.group_programs where id = p_id for update;
  if not found then raise exception 'Programme introuvable' using errcode = 'P0002'; end if;
  perform private.program_admin_check(g.scope_type, g.family_id, g.circle_id);
  if g.version <> p_expected_version then
    raise exception 'Le programme a été modifié entre-temps. Rechargez-le.' using errcode = '40001'; end if;
  perform private.rate_hit('group_program', 20, 3600);
  delete from public.group_program_steps where program_id = p_id;
  perform private.program_insert_steps(p_id, p_steps);
  update public.group_programs set title = trim(p_title), description = nullif(trim(p_description), ''),
    version = version + 1, updated_at = now() where id = p_id;
  return g.version + 1;
end $$;

create or replace function public.set_group_program_status(p_id uuid, p_status text) returns void
language plpgsql security definer set search_path = '' as $$
declare g public.group_programs;
begin
  select * into g from public.group_programs where id = p_id;
  if not found then raise exception 'Programme introuvable' using errcode = 'P0002'; end if;
  if p_status not in ('active','archived') then raise exception 'Statut invalide' using errcode = '22023'; end if;
  -- Archiver n'ajoute pas de contenu : ni mineur (déjà exclu des rôles admin) ni contrôle de suspension nécessaire.
  if not private.scope_admin(g.scope_type, g.family_id, g.circle_id) then
    raise exception 'Action non autorisée pour votre rôle.' using errcode = '42501'; end if;
  update public.group_programs set status = p_status, updated_at = now() where id = p_id;
end $$;

-- Avancée personnelle sur une étape (valeur absolue, bornée au nombre de l'étape). Membres du groupe seulement.
create or replace function public.set_program_progress(p_step uuid, p_count int) returns int
language plpgsql security definer set search_path = '' as $$
declare me uuid := (select auth.uid()); s public.group_program_steps; g public.group_programs; c int;
begin
  if me is null then raise exception 'Connexion requise' using errcode = '42501'; end if;
  select * into s from public.group_program_steps where id = p_step;
  if not found then raise exception 'Étape introuvable' using errcode = 'P0002'; end if;
  select * into g from public.group_programs where id = s.program_id;
  if not private.scope_member(g.scope_type, g.family_id, g.circle_id) then
    raise exception 'Action non autorisée pour votre rôle.' using errcode = '42501'; end if;
  if g.status <> 'active' then raise exception 'Programme archivé' using errcode = '22023'; end if;
  perform private.rate_hit('program_progress', 1200, 3600);
  c := least(greatest(coalesce(p_count, 0), 0), s.target);
  insert into public.group_program_progress as p (program_id, step_id, user_id, count) values (g.id, s.id, me, c)
    on conflict (step_id, user_id) do update set count = excluded.count, updated_at = now();
  return c;
end $$;

-- Vue d'un programme : étapes, total par étape, et avancée des membres masquée comme goal_progress
-- (famille : « compteur » par défaut ; cercle : « participation » par défaut ; « rien » = absent, sauf soi).
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
    'can_admin', private.scope_admin(g.scope_type, g.family_id, g.circle_id) and not private.is_minor(me),
    'steps', steps, 'members', members);
end $$;

-- ===================================================================== Droits d'exécution
-- Seules les nouvelles fonctions sont touchées (aucun « grant on all functions » qui rouvrirait d'anciennes fonctions).
revoke all on function private.program_member(uuid), private.program_admin_check(text, uuid, uuid),
  private.program_insert_steps(uuid, jsonb) from public, anon, authenticated;
grant execute on function private.program_member(uuid) to authenticated;   -- utilisée par les policies de lecture
revoke execute on function public.create_group_program(uuid, text, uuid, text, jsonb, text, text),
  public.update_group_program(uuid, int, text, jsonb, text), public.set_group_program_status(uuid, text),
  public.set_program_progress(uuid, int), public.group_program_view(uuid) from public, anon;
grant execute on function public.create_group_program(uuid, text, uuid, text, jsonb, text, text),
  public.update_group_program(uuid, int, text, jsonb, text), public.set_group_program_status(uuid, text),
  public.set_program_progress(uuid, int), public.group_program_view(uuid) to authenticated;
