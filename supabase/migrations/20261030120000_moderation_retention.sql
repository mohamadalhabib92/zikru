-- Lot B — Modération et conservation des données des communautés (audit du 30.10.2026).
-- Dépend de : 20261030110000_messagerie_securite.sql.
--
--  1. Blocage : masque les échanges dans les deux sens, appliqué par le serveur (envoi refusé, lecture masquée).
--  2. Signalement avec motif (message, membre, cercle, session) + instantané côté serveur ; RPC report_content.
--  3. Suspension d'un compte par la modération (table privée, gérée en SQL par l'équipe).
--  4. Filtre de contenu de base (liste de termes modifiable, liens refusés dans les encouragements) : SQLSTATE ZKF01.
--  5. Contact modération (app_config 'moderation.contact_email').
--  6. Durées de conservation + purge automatique quotidienne (pg_cron si disponible).

-- ===================================================================== 1. Blocage
create table public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  blocked_name text not null default '' check (char_length(blocked_name) <= 60),  -- posé par le serveur
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index blocks_blocked_idx on public.blocks (blocked_id);
alter table public.blocks enable row level security;
revoke all on public.blocks from anon, authenticated;
grant select, delete on public.blocks to authenticated;
-- Seul celui qui bloque voit sa liste (la personne bloquée n'est pas prévenue). Ajout via block_user().
create policy blocks_select on public.blocks for select to authenticated using (blocker_id = (select auth.uid()));
create policy blocks_delete on public.blocks for delete to authenticated using (blocker_id = (select auth.uid()));

create or replace function private.is_blocked(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.blocks where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a));
$$;

-- ===================================================================== 3. Suspension (modération)
create table private.user_suspensions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  until timestamptz,                         -- null = sans échéance
  reason text check (char_length(reason) <= 500),
  created_at timestamptz not null default now()
);
alter table private.user_suspensions enable row level security;
revoke all on private.user_suspensions from public, anon, authenticated;

create or replace function private.is_suspended(uid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from private.user_suspensions s where s.user_id = uid and (s.until is null or s.until > now()));
$$;

-- can_message, version finale : lot A + blocage + suspension.
create or replace function private.can_message(st text, fid uuid, cid uuid, recipient uuid) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare me uuid := (select auth.uid()); rrole text; srole text; sm text; rm text;
begin
  if me is null or recipient is null or recipient = me then return false; end if;
  if private.is_blocked(me, recipient) or private.is_suspended(me) then return false; end if;
  if st = 'family' then
    select role into srole from public.family_members where family_id = fid and user_id = me;
    select role into rrole from public.family_members where family_id = fid and user_id = recipient;
    if srole is null or rrole is null then return false; end if;
    if (private.is_minor(me) and srole <> 'child') or (private.is_minor(recipient) and rrole <> 'child') then return false; end if;
    if srole = 'child' then
      sm := private.child_messaging(fid, me);
      if sm = 'none' then return false; end if;
      if sm = 'parents' and rrole <> 'parent' then return false; end if;
      if rrole = 'guest' then return false; end if;
    end if;
    if rrole = 'child' then
      rm := private.child_messaging(fid, recipient);
      if rm = 'none' then return false; end if;
      if rm = 'parents' and srole <> 'parent' then return false; end if;
      if srole = 'guest' then return false; end if;
    end if;
    return true;
  elsif st = 'circle' then
    return private.is_circle_member(cid)
       and exists (select 1 from public.circle_members where circle_id = cid and user_id = recipient)
       and not private.is_minor(me) and not private.is_minor(recipient);
  end if;
  return false;
end $$;

-- Un enfant voit-il ce message ? Non si son réglage l'interdit pour cet expéditeur (« Aucun » / « Parents »).
create or replace function private.child_may_read(fid uuid, child uuid, other uuid) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare m text := private.child_messaging(fid, child); orole text;
begin
  if m = 'none' then return false; end if;
  if m = 'parents' then
    select role into orole from public.family_members where family_id = fid and user_id = other;
    return coalesce(orole = 'parent', false);
  end if;
  return true;
end $$;

-- Lecture des encouragements : expéditeur / destinataire, sauf blocage (dans les deux sens) et réglage
-- parental de l'enfant ; les parents gardent la supervision des messages impliquant un mineur.
drop policy encouragements_select on public.encouragements;
create policy encouragements_select on public.encouragements for select to authenticated
  using (
    ((sender_id = (select auth.uid()) or recipient_id = (select auth.uid()))
      and not private.is_blocked(sender_id, recipient_id)
      and (scope_type <> 'family' or not private.is_minor((select auth.uid()))
           or private.child_may_read(family_id, (select auth.uid()),
                case when sender_id = (select auth.uid()) then recipient_id else sender_id end)))
    or (scope_type = 'family' and private.is_family_parent(family_id)
        and (private.is_minor(sender_id) or private.is_minor(recipient_id))));

-- Sessions et invitations : refusées aux comptes suspendus.
drop policy zikr_sessions_insert on public.zikr_sessions;
create policy zikr_sessions_insert on public.zikr_sessions for insert to authenticated
  with check (started_by = (select auth.uid()) and status = 'live' and private.scope_member(scope_type, family_id, circle_id)
              and not private.is_suspended((select auth.uid())));

-- Bloquer / débloquer.
create or replace function private.block_user(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := (select auth.uid()); nm text;
begin
  if me is null then raise exception 'Connexion requise' using errcode = '42501'; end if;
  if p_user is null or p_user = me then raise exception 'Action impossible' using errcode = 'check_violation'; end if;
  if not private.can_see_profile(p_user) and not exists (select 1 from public.encouragements e
       where (e.sender_id = p_user and e.recipient_id = me) or (e.sender_id = me and e.recipient_id = p_user)) then
    raise exception 'Personne introuvable' using errcode = '42501';
  end if;
  perform private.rate_hit('block', 50, 86400);
  select display_name into nm from public.profiles where id = p_user;
  insert into public.blocks (blocker_id, blocked_id, blocked_name) values (me, p_user, left(coalesce(nm, ''), 60))
    on conflict (blocker_id, blocked_id) do nothing;
end $$;
create or replace function public.block_user(p_user uuid) returns void
language sql security invoker set search_path = '' as $$ select private.block_user(p_user) $$;

-- ===================================================================== 2. Signalements
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles(id) on delete set null,
  target_type text not null check (target_type in ('message','member','circle','session')),
  target_id uuid not null,
  target_user_id uuid references public.profiles(id) on delete set null,
  scope_type text check (scope_type in ('family','circle')),
  family_id uuid references public.families(id) on delete set null,
  circle_id uuid references public.circles(id) on delete set null,
  reason text not null check (reason in ('spam','harassment','hate','sexual','violence','self_harm','impersonation','child_safety','other')),
  details text check (char_length(details) <= 1000),
  snapshot jsonb not null default '{}'::jsonb,       -- copie du contenu signalé au moment du signalement
  status text not null default 'open' check (status in ('open','reviewing','actioned','dismissed')),
  resolution text check (char_length(resolution) <= 1000),
  created_at timestamptz not null default now(),
  handled_at timestamptz
);
create index reports_open_idx on public.reports (created_at) where status in ('open','reviewing');
create index reports_reporter_idx on public.reports (reporter_id);
create index reports_target_user_idx on public.reports (target_user_id);
create index reports_family_idx on public.reports (family_id);
create index reports_circle_idx on public.reports (circle_id);
alter table public.reports enable row level security;
revoke all on public.reports from anon, authenticated;
grant select (id, target_type, target_id, reason, status, created_at, handled_at) on public.reports to authenticated;
create policy reports_select_own on public.reports for select to authenticated using (reporter_id = (select auth.uid()));
-- Traitement : équipe Zikru via le tableau de bord Supabase (rôle service), voir docs/moderation.md.

create or replace function private.report_content(p_target_type text, p_target_id uuid, p_reason text, p_details text,
  p_scope_type text, p_scope_id uuid, p_block boolean) returns uuid
language plpgsql security definer set search_path = '' as $$
declare me uuid := (select auth.uid()); tu uuid; st text; fid uuid; cid uuid; snap jsonb; rid uuid;
        e public.encouragements; s public.zikr_sessions; c public.circles;
begin
  if me is null then raise exception 'Connexion requise' using errcode = '42501'; end if;
  if p_reason not in ('spam','harassment','hate','sexual','violence','self_harm','impersonation','child_safety','other') then
    raise exception 'Motif inconnu' using errcode = 'check_violation'; end if;
  if p_target_type = 'message' then
    select * into e from public.encouragements where id = p_target_id;
    if not found or not (e.sender_id = me or e.recipient_id = me
         or (e.scope_type = 'family' and private.is_family_parent(e.family_id) and (private.is_minor(e.sender_id) or private.is_minor(e.recipient_id)))) then
      raise exception 'Message introuvable' using errcode = '42501'; end if;
    tu := case when e.sender_id = me then e.recipient_id else e.sender_id end;
    st := e.scope_type; fid := e.family_id; cid := e.circle_id;
    snap := jsonb_build_object('body', e.body, 'kind', e.kind, 'sender_id', e.sender_id, 'recipient_id', e.recipient_id, 'created_at', e.created_at);
  elsif p_target_type = 'member' then
    if p_scope_type = 'family' and private.is_family_member(p_scope_id) then
      select user_id, jsonb_build_object('display_name', display_name, 'role', role) into tu, snap
        from public.family_members where family_id = p_scope_id and user_id = p_target_id;
      fid := p_scope_id;
    elsif p_scope_type = 'circle' and private.is_circle_member(p_scope_id) then
      select user_id, jsonb_build_object('display_name', display_name, 'role', role) into tu, snap
        from public.circle_members where circle_id = p_scope_id and user_id = p_target_id;
      cid := p_scope_id;
    end if;
    if tu is null then raise exception 'Membre introuvable' using errcode = '42501'; end if;
    st := p_scope_type;
  elsif p_target_type = 'circle' then
    select * into c from public.circles where id = p_target_id;
    if not found or not private.is_circle_member(c.id) then raise exception 'Cercle introuvable' using errcode = '42501'; end if;
    st := 'circle'; cid := c.id;
    snap := jsonb_build_object('name', c.name, 'description', c.description, 'rules', c.rules);
    select user_id into tu from public.circle_members where circle_id = c.id and role = 'founder' limit 1;
  elsif p_target_type = 'session' then
    select * into s from public.zikr_sessions where id = p_target_id;
    if not found or not private.scope_member(s.scope_type, s.family_id, s.circle_id) then
      raise exception 'Session introuvable' using errcode = '42501'; end if;
    tu := s.started_by; st := s.scope_type; fid := s.family_id; cid := s.circle_id;
    snap := jsonb_build_object('title', s.title, 'formula', s.formula, 'started_at', s.started_at);
  else
    raise exception 'Type inconnu' using errcode = 'check_violation';
  end if;
  if tu = me then tu := null; end if;
  -- Doublon : même personne, même cible, encore ouvert → on renvoie le signalement existant.
  select id into rid from public.reports where reporter_id = me and target_type = p_target_type and target_id = p_target_id
    and status in ('open','reviewing') limit 1;
  if rid is null then
    perform private.rate_hit('report', 20, 86400);
    insert into public.reports (reporter_id, target_type, target_id, target_user_id, scope_type, family_id, circle_id, reason, details, snapshot)
      values (me, p_target_type, p_target_id, tu, st, fid, cid, p_reason, nullif(left(trim(coalesce(p_details, '')), 1000), ''), coalesce(snap, '{}'::jsonb))
      returning id into rid;
  end if;
  if coalesce(p_block, false) and tu is not null then perform private.block_user(tu); end if;
  return rid;
end $$;
create or replace function public.report_content(p_target_type text, p_target_id uuid, p_reason text, p_details text default null,
  p_scope_type text default null, p_scope_id uuid default null, p_block boolean default false) returns uuid
language sql security invoker set search_path = '' as $$
  select private.report_content(p_target_type, p_target_id, p_reason, p_details, p_scope_type, p_scope_id, p_block) $$;

-- File de modération lisible dans l'éditeur SQL (non exposée à l'API).
create or replace view private.moderation_queue as
  select r.id, r.created_at, r.status, r.reason, r.target_type, r.target_id, r.target_user_id,
         (select count(*) from public.reports r2 where r2.target_user_id = r.target_user_id and r.target_user_id is not null) as reports_on_user,
         r.scope_type, r.family_id, r.circle_id, r.details, r.snapshot
  from public.reports r where r.status in ('open','reviewing') order by r.created_at;
revoke all on private.moderation_queue from public, anon, authenticated;

-- ===================================================================== 4. Filtre de contenu de base
create table private.blocked_terms (
  term text primary key check (char_length(term) between 2 and 60 and term = lower(term)),
  lang text not null default 'fr' check (lang in ('fr','en','ar','other')),
  note text
);
alter table private.blocked_terms enable row level security;
revoke all on private.blocked_terms from public, anon, authenticated;
-- Liste de départ volontairement courte (insultes graves, injures sexuelles, slurs) — à relire par l'équipe.
insert into private.blocked_terms (term, lang) values
  ('connard','fr'),('connasse','fr'),('salope','fr'),('pute','fr'),('putain de ta','fr'),('enculé','fr'),('encule','fr'),
  ('fils de pute','fr'),('fdp','fr'),('nique ta mère','fr'),('nique ta mere','fr'),('ntm','fr'),('pédé','fr'),('bougnoule','fr'),('sale juif','fr'),('sale arabe','fr'),('sale noir','fr'),
  ('fuck you','en'),('motherfucker','en'),('bitch','en'),('cunt','en'),('whore','en'),('slut','en'),('faggot','en'),('nigger','en'),('nigga','en'),('kill yourself','en'),('kys','en'),
  ('شرموطة','ar'),('شرموط','ar'),('قحبة','ar'),('عاهرة','ar'),('منيوك','ar'),('كس امك','ar'),('كس أمك','ar'),('يلعن دينك','ar'),
  ('sharmouta','other'),('charmouta','other'),('qahba','other'),('9ahba','other'),('zamel','other'),('nik mok','other'),('nik yemak','other')
on conflict do nothing;

insert into public.app_config (key, value, description) values
  ('filter.enabled', 'true', 'Filtre de contenu de base (termes interdits) sur messages, noms et titres.'),
  ('filter.links',   '"all"', 'Liens dans les encouragements : "all" = refusés partout, "minors" = refusés si un mineur est concerné, "off".'),
  ('moderation.contact_email', '"mohamadalhabib@live.com"', 'Contact modération affiché dans l''app (provisoire).'),
  ('rate.report', '{"max": 20, "window_s": 86400}', 'Signalements par jour et par personne.'),
  ('rate.block',  '{"max": 50, "window_s": 86400}', 'Blocages par jour et par personne.')
on conflict (key) do nothing;

-- Normalisation : minuscules, sans accents latins, espaces compactés.
create or replace function private.norm_text(p text) returns text
language sql immutable set search_path = '' as $$
  select regexp_replace(lower(translate(coalesce(p, ''),
    'ÀÁÂÃÄÅàáâãäåÈÉÊËèéêëÌÍÎÏìíîïÒÓÔÕÖòóôõöÙÚÛÜùúûüÇçÑñ', 'AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn')), '\s+', ' ', 'g');
$$;

-- Vrai si le texte contient un terme interdit (mot entier, accents ignorés).
create or replace function private.text_flagged(p text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare t text := ' ' || private.norm_text(p) || ' ';
begin
  if p is null or trim(p) = '' or coalesce((private.config('filter.enabled') #>> '{}'), 'true') <> 'true' then return false; end if;
  t := regexp_replace(t, '[[:punct:]]', ' ', 'g');
  return exists (
    select 1 from private.blocked_terms b
    where position(' ' || regexp_replace(private.norm_text(b.term), '[[:punct:]]', ' ', 'g') || ' ' in t) > 0);
end $$;

create or replace function private.has_link(p text) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(p, '') ~* '(https?://|www\.|\m[a-z0-9-]+\.(com|net|org|fr|ch|io|me|ly|gg|xyz|app|link|info|biz|ru|tk)\M|t\.me/|wa\.me/)';
$$;

-- Déclencheur générique : arguments = noms des colonnes texte à contrôler.
create or replace function private.content_filter_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare col text; j jsonb := to_jsonb(new);
begin
  foreach col in array tg_argv loop
    if private.text_flagged(j ->> col) then
      raise exception 'Ce texte contient un terme non autorisé. Merci de le reformuler.' using errcode = 'ZKF01',
        detail = jsonb_build_object('field', col)::text;
    end if;
  end loop;
  return new;
end $$;

create or replace function private.encouragements_filter() returns trigger
language plpgsql security definer set search_path = '' as $$
declare mode text := coalesce(private.config('filter.links') #>> '{}', 'all');
begin
  if private.text_flagged(new.body) then
    raise exception 'Ce message contient un terme non autorisé. Merci de le reformuler.' using errcode = 'ZKF01',
      detail = '{"field": "body"}';
  end if;
  if private.has_link(new.body) and (mode = 'all'
       or (mode = 'minors' and (private.is_minor(new.sender_id) or private.is_minor(new.recipient_id)))) then
    raise exception 'Les liens ne sont pas autorisés dans les encouragements.' using errcode = 'ZKF01',
      detail = '{"field": "body", "rule": "link"}';
  end if;
  return new;
end $$;

create trigger encouragements_filter before insert or update of body on public.encouragements
  for each row execute function private.encouragements_filter();
create trigger circles_filter before insert or update of name, description, rules on public.circles
  for each row execute function private.content_filter_guard('name', 'description', 'rules');
create trigger circle_members_filter before insert or update of display_name on public.circle_members
  for each row execute function private.content_filter_guard('display_name');
create trigger families_filter before insert or update of name, wird on public.families
  for each row execute function private.content_filter_guard('name', 'wird');
create trigger family_members_filter before insert or update of display_name on public.family_members
  for each row execute function private.content_filter_guard('display_name');
create trigger profiles_filter before update of display_name on public.profiles
  for each row execute function private.content_filter_guard('display_name');
create trigger zikr_sessions_filter before insert or update of title, formula on public.zikr_sessions
  for each row execute function private.content_filter_guard('title', 'formula');
create trigger shared_goals_filter before insert or update of title, formula on public.shared_goals
  for each row execute function private.content_filter_guard('title', 'formula');
create trigger family_calendar_events_filter before insert or update of title, notes on public.family_calendar_events
  for each row execute function private.content_filter_guard('title', 'notes');

-- Contact modération (lisible par tout compte connecté).
create or replace function private.moderation_contact() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('email', coalesce(private.config('moderation.contact_email') #>> '{}', 'mohamadalhabib@live.com'));
$$;
create or replace function public.moderation_contact() returns jsonb
language sql stable security invoker set search_path = '' as $$ select private.moderation_contact() $$;

-- ===================================================================== 6. Conservation et purge
insert into public.app_config (key, value, description) values
  ('retention.messages_days',         '365', 'Encouragements supprimés après N jours.'),
  ('retention.sessions_days',         '90',  'Sessions de zikr en direct terminées supprimées après N jours (avec leurs compteurs).'),
  ('retention.live_max_hours',        '24',  'Une session restée « en direct » plus de N heures est terminée automatiquement.'),
  ('retention.invitations_days',      '30',  'Invitations expirées ou révoquées supprimées N jours après.'),
  ('retention.reports_closed_days',   '365', 'Signalements traités supprimés N jours après leur traitement.'),
  ('retention.rate_counters_days',    '2',   'Compteurs anti-abus supprimés après N jours.'),
  ('retention.suspensions_days',      '30',  'Suspensions échues supprimées N jours après.')
on conflict (key) do nothing;

create or replace function private.retention_days(p_key text, p_default int) returns int
language sql stable security definer set search_path = '' as $$
  select greatest(coalesce((private.config('retention.' || p_key) #>> '{}')::int, p_default), 1);
$$;

create or replace function private.purge_expired() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare n_msg int; n_live int; n_ses int; n_inv int; n_rep int; n_rate int; n_sus int;
begin
  delete from public.encouragements where created_at < now() - make_interval(days => private.retention_days('messages_days', 365));
  get diagnostics n_msg = row_count;
  update public.zikr_sessions set status = 'ended', ended_at = now()
    where status = 'live' and started_at < now() - make_interval(hours => private.retention_days('live_max_hours', 24));
  get diagnostics n_live = row_count;
  delete from public.zikr_sessions where status = 'ended'
    and coalesce(ended_at, started_at) < now() - make_interval(days => private.retention_days('sessions_days', 90));
  get diagnostics n_ses = row_count;
  delete from public.invitations where coalesce(revoked_at, expires_at) < now() - make_interval(days => private.retention_days('invitations_days', 30))
    and (revoked_at is not null or expires_at < now());
  get diagnostics n_inv = row_count;
  delete from public.reports where status in ('actioned','dismissed')
    and coalesce(handled_at, created_at) < now() - make_interval(days => private.retention_days('reports_closed_days', 365));
  get diagnostics n_rep = row_count;
  delete from private.rate_counters where at < now() - make_interval(days => private.retention_days('rate_counters_days', 2));
  get diagnostics n_rate = row_count;
  delete from private.user_suspensions where until is not null and until < now() - make_interval(days => private.retention_days('suspensions_days', 30));
  get diagnostics n_sus = row_count;
  return jsonb_build_object('messages', n_msg, 'live_closed', n_live, 'sessions', n_ses, 'invitations', n_inv,
                            'reports', n_rep, 'rate_counters', n_rate, 'suspensions', n_sus, 'at', now());
end $$;
revoke all on function private.purge_expired() from public, anon, authenticated;

-- Planification quotidienne (03:15 UTC) si pg_cron est disponible (Supabase) ; ignorée ailleurs (tests).
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('zikru-purge-expired', '15 3 * * *', 'select private.purge_expired()');
  end if;
end $$;

-- ===================================================================== Droits
revoke all on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated;
revoke execute on function private.purge_expired() from authenticated;
revoke execute on function public.block_user(uuid), public.report_content(text, uuid, text, text, text, uuid, boolean),
  public.moderation_contact() from public, anon;
grant execute on function public.block_user(uuid), public.report_content(text, uuid, text, text, text, uuid, boolean),
  public.moderation_contact() to authenticated;
