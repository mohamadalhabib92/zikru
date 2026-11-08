-- Passe 5 — Communautés sûres : discussion de groupe (lot C de l'audit messagerie du 30.10.2026).
-- ADDITIVE : nouvelles tables, fonctions et réglages ; aucune donnée supprimée, aucune table retirée.
-- NON APPLIQUÉE au projet Supabase en ligne : à appliquer seulement après accord de Mohamed.
--
-- Contenu :
--   1. public.group_messages : fil de discussion d'une famille ou d'un cercle (texte ≤ 2000, réponse/citation,
--      « supprimer pour tous », messages spéciaux bravo / du'a / rappel / salām). Écriture uniquement par RPC.
--   2. Visibilité : membres seulement ; blocage dans les deux sens ; règles enfant identiques aux encouragements
--      (défaut « Parents » : un enfant n'échange qu'avec ses parents ; « Aucun » coupe tout ; jamais avec un invité).
--   3. public.group_prefs : dernier message lu (badge non lus) et sourdine, par personne et par groupe.
--   4. Anti-abus : débit (rate.group_message*), filtre de termes, liens, comptes suspendus.
--   5. Signalement d'un message de groupe (instantané côté modération) + journal des suppressions par la modération.
--   6. Conservation : 365 jours (retention.group_messages_days), purge quotidienne existante étendue.
--   7. Realtime : publication supabase_realtime (si présente).
-- Messagerie « chiffré en transit, pas encore de bout en bout » : pas de chiffrement de bout en bout (Phase 3, OpenMLS).
-- La limite de 4 personnes des cercles gratuits reste appliquée par accept_invitation (inchangé) ; familles non limitées.

-- ===================================================================== 1. Messages
create table public.group_messages (
  id uuid primary key default gen_random_uuid(),
  scope_type text not null check (scope_type in ('family','circle')),
  family_id uuid references public.families(id) on delete cascade,
  circle_id uuid references public.circles(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  sender_name text not null default '' check (char_length(sender_name) <= 60),   -- posé par le serveur
  kind text not null default 'text' check (kind in ('text','bravo','dua','rappel','salam')),
  body text not null default '' check (char_length(body) <= 2000),
  reply_to uuid references public.group_messages(id) on delete set null,
  client_id uuid not null,                     -- identifiant posé par l'appareil : renvoi hors ligne sans doublon
  created_at timestamptz not null default clock_timestamp(),   -- horloge réelle : ordre exact dans le fil
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id) on delete set null,
  unique (sender_id, client_id),
  check (deleted_at is not null or char_length(trim(body)) >= 1),
  check ((scope_type = 'family' and family_id is not null and circle_id is null)
      or (scope_type = 'circle' and circle_id is not null and family_id is null))
);
create index group_messages_family_idx on public.group_messages (family_id, created_at desc) where family_id is not null;
create index group_messages_circle_idx on public.group_messages (circle_id, created_at desc) where circle_id is not null;
create index group_messages_sender_idx on public.group_messages (sender_id);
create index group_messages_reply_idx on public.group_messages (reply_to) where reply_to is not null;
create index group_messages_deleted_by_idx on public.group_messages (deleted_by) where deleted_by is not null;
create index group_messages_created_idx on public.group_messages (created_at);
alter table public.group_messages enable row level security;
revoke all on public.group_messages from anon, authenticated;
grant select (id, scope_type, family_id, circle_id, sender_id, sender_name, kind, body, reply_to, client_id, created_at, deleted_at)
  on public.group_messages to authenticated;

-- Réglage parental d'un enfant, défaut strict « parents » (même si la ligne de contrôle manque).
create or replace function private.child_messaging_strict(fid uuid, uid uuid) returns text
language sql stable security definer set search_path = '' as $$
  select coalesce((select pc.messaging from public.family_members m join public.parental_controls pc on pc.child_member_id = m.id
                   where m.family_id = fid and m.user_id = uid), 'parents');
$$;

-- Deux personnes d'une même famille peuvent-elles se lire dans le fil ? (même logique que can_message)
-- Un ancien membre (rôle inconnu) est traité comme un adulte.
create or replace function private.family_pair_ok(fid uuid, a uuid, b uuid) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare ra text; rb text; m text;
begin
  if a = b then return true; end if;
  select role into ra from public.family_members where family_id = fid and user_id = a;
  select role into rb from public.family_members where family_id = fid and user_id = b;
  ra := coalesce(ra, case when private.is_minor(a) then 'child' else 'adult' end);
  rb := coalesce(rb, case when private.is_minor(b) then 'child' else 'adult' end);
  if (private.is_minor(a) and ra <> 'child') or (private.is_minor(b) and rb <> 'child') then return false; end if;
  if ra = 'child' then
    m := private.child_messaging_strict(fid, a);
    if m = 'none' or rb = 'guest' or (m = 'parents' and rb <> 'parent') then return false; end if;
  end if;
  if rb = 'child' then
    m := private.child_messaging_strict(fid, b);
    if m = 'none' or ra = 'guest' or (m = 'parents' and ra <> 'parent') then return false; end if;
  end if;
  return true;
end $$;

-- La personne connectée voit-elle ce message ?
create or replace function private.gm_visible(st text, fid uuid, cid uuid, sender uuid) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare me uuid := (select auth.uid()); myrole text;
begin
  if me is null then return false; end if;
  if sender <> me and private.is_blocked(me, sender) then return false; end if;
  if st = 'circle' then return private.is_circle_member(cid) and not private.is_minor(me); end if;
  if st <> 'family' then return false; end if;
  select role into myrole from public.family_members where family_id = fid and user_id = me;
  if myrole is null then return false; end if;
  if myrole = 'child' and private.child_messaging_strict(fid, me) = 'none' then return false; end if;
  return private.family_pair_ok(fid, me, sender);
end $$;

create policy group_messages_select on public.group_messages for select to authenticated
  using (private.gm_visible(scope_type, family_id, circle_id, sender_id));

-- Que peut faire la personne connectée dans ce fil ? (affichage : composer, droits de modération)
create or replace function private.group_chat_rights(p_scope text, p_scope_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare me uuid := (select auth.uid()); r text; m text;
begin
  if me is null then return jsonb_build_object('member', false); end if;
  if p_scope = 'circle' then
    r := private.circle_role(p_scope_id);
    if r is null then return jsonb_build_object('member', false); end if;
    return jsonb_build_object('member', true, 'role', r, 'can_post', not private.is_suspended(me),
      'can_moderate', r in ('founder','moderator'), 'audience', 'all');
  elsif p_scope = 'family' then
    r := private.family_role(p_scope_id);
    if r is null then return jsonb_build_object('member', false); end if;
    m := case when r = 'child' then private.child_messaging_strict(p_scope_id, me) end;
    return jsonb_build_object('member', true, 'role', r, 'can_post', not private.is_suspended(me) and coalesce(m, '') <> 'none',
      'can_moderate', r = 'parent',
      'audience', case when r = 'child' then (case m when 'family' then 'family_no_guests' when 'parents' then 'parents' else 'none' end)
                       when r = 'guest' then 'no_children' else 'all' end);
  end if;
  return jsonb_build_object('member', false);
end $$;
create or replace function public.group_chat_rights(p_scope text, p_scope_id uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$ select private.group_chat_rights(p_scope, p_scope_id) $$;

insert into public.app_config (key, value, description) values
  ('rate.group_message',       '{"max": 120, "window_s": 3600}', 'Messages de discussion de groupe par heure et par personne.'),
  ('rate.group_message_burst', '{"max": 12, "window_s": 60}',    'Messages de discussion de groupe par minute et par personne.'),
  ('retention.group_messages_days', '365', 'Messages de discussion de groupe supprimés après N jours.'),
  ('filter.group_links', '"minors"', 'Liens dans les discussions de groupe : "all" = refusés partout, "minors" = refusés dans les familles avec un enfant, "off".')
on conflict (key) do nothing;

-- Envoi (idempotent par client_id) : nom posé par le serveur, filtre, liens, débit, réglage parental.
create or replace function private.post_group_message(p_scope text, p_scope_id uuid, p_body text, p_kind text,
  p_reply_to uuid, p_client_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := (select auth.uid()); r jsonb; nm text; b text := trim(coalesce(p_body, '')); g public.group_messages;
        lm text := coalesce(private.config('filter.group_links') #>> '{}', 'minors'); has_child boolean := false;
begin
  if me is null then raise exception 'Connexion requise' using errcode = '42501'; end if;
  if p_client_id is null then raise exception 'Identifiant manquant' using errcode = 'check_violation'; end if;
  select * into g from public.group_messages where sender_id = me and client_id = p_client_id;
  if found then
    return to_jsonb(g) - 'deleted_by';                       -- renvoi après coupure réseau : pas de doublon
  end if;
  r := private.group_chat_rights(p_scope, p_scope_id);
  if not coalesce((r ->> 'member')::boolean, false) then raise exception 'Groupe introuvable' using errcode = '42501'; end if;
  if private.is_suspended(me) then raise exception 'Compte suspendu par la modération.' using errcode = '42501'; end if;
  if not coalesce((r ->> 'can_post')::boolean, false) then
    raise exception 'Le réglage parental ne permet pas d''écrire dans cette discussion.' using errcode = '42501'; end if;
  if coalesce(p_kind, 'text') not in ('text','bravo','dua','rappel','salam') then
    raise exception 'Type de message inconnu' using errcode = 'check_violation'; end if;
  if char_length(b) < 1 or char_length(b) > 2000 then
    raise exception 'Message vide ou trop long (2000 caractères maximum).' using errcode = 'check_violation'; end if;
  if private.text_flagged(b) then
    raise exception 'Ce message contient un terme non autorisé. Merci de le reformuler.' using errcode = 'ZKF01',
      detail = '{"field": "body"}';
  end if;
  if p_scope = 'family' then
    has_child := exists (select 1 from public.family_members where family_id = p_scope_id and role = 'child');
  end if;
  if private.has_link(b) and (lm = 'all' or (lm = 'minors' and has_child)) then
    raise exception 'Les liens ne sont pas autorisés dans cette discussion.' using errcode = 'ZKF01',
      detail = '{"field": "body", "rule": "link"}';
  end if;
  if p_reply_to is not null and not exists (select 1 from public.group_messages x where x.id = p_reply_to
       and x.scope_type = p_scope and coalesce(x.family_id, x.circle_id) = p_scope_id
       and private.gm_visible(x.scope_type, x.family_id, x.circle_id, x.sender_id)) then
    raise exception 'Message cité introuvable' using errcode = '42501';
  end if;
  perform private.rate_hit('group_message_burst', 12, 60);
  perform private.rate_hit('group_message', 120, 3600);
  if p_scope = 'family' then
    select display_name into nm from public.family_members where family_id = p_scope_id and user_id = me;
  else
    select display_name into nm from public.circle_members where circle_id = p_scope_id and user_id = me;
  end if;
  insert into public.group_messages (scope_type, family_id, circle_id, sender_id, sender_name, kind, body, reply_to, client_id, created_at)
    values (p_scope, case when p_scope = 'family' then p_scope_id end, case when p_scope = 'circle' then p_scope_id end,
            me, left(coalesce(nm, ''), 60), coalesce(p_kind, 'text'), b, p_reply_to, p_client_id, clock_timestamp())
    on conflict (sender_id, client_id) do nothing
    returning * into g;
  if g.id is null then select * into g from public.group_messages where sender_id = me and client_id = p_client_id; end if;
  -- Écrire vaut lecture : le badge de l'expéditeur reste à zéro.
  perform private.mark_group_read(p_scope, p_scope_id);
  return to_jsonb(g) - 'deleted_by';
end $$;

-- ===================================================================== 3. Lu / sourdine
create table public.group_prefs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  scope_type text not null check (scope_type in ('family','circle')),
  family_id uuid references public.families(id) on delete cascade,
  circle_id uuid references public.circles(id) on delete cascade,
  last_read_at timestamptz,
  muted boolean not null default false,
  updated_at timestamptz not null default now(),
  check ((scope_type = 'family' and family_id is not null and circle_id is null)
      or (scope_type = 'circle' and circle_id is not null and family_id is null))
);
create unique index group_prefs_family_uq on public.group_prefs (user_id, family_id) where family_id is not null;
create unique index group_prefs_circle_uq on public.group_prefs (user_id, circle_id) where circle_id is not null;
create index group_prefs_family_idx on public.group_prefs (family_id);
create index group_prefs_circle_idx on public.group_prefs (circle_id);
alter table public.group_prefs enable row level security;
revoke all on public.group_prefs from anon, authenticated;
grant select on public.group_prefs to authenticated;
create policy group_prefs_select_own on public.group_prefs for select to authenticated using (user_id = (select auth.uid()));

create or replace function private.upsert_group_pref(p_scope text, p_scope_id uuid, p_read boolean, p_muted boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := (select auth.uid());
begin
  if me is null or not private.scope_member(p_scope, case when p_scope = 'family' then p_scope_id end,
                                            case when p_scope = 'circle' then p_scope_id end) then
    raise exception 'Groupe introuvable' using errcode = '42501'; end if;
  update public.group_prefs set
      last_read_at = case when p_read then clock_timestamp() else last_read_at end,
      muted = coalesce(p_muted, muted), updated_at = now()
    where user_id = me and ((p_scope = 'family' and family_id = p_scope_id) or (p_scope = 'circle' and circle_id = p_scope_id));
  if not found then
    insert into public.group_prefs (user_id, scope_type, family_id, circle_id, last_read_at, muted)
      values (me, p_scope, case when p_scope = 'family' then p_scope_id end, case when p_scope = 'circle' then p_scope_id end,
              case when p_read then clock_timestamp() end, coalesce(p_muted, false));
  end if;
end $$;
create or replace function private.mark_group_read(p_scope text, p_scope_id uuid) returns void
language sql security definer set search_path = '' as $$ select private.upsert_group_pref(p_scope, p_scope_id, true, null) $$;

-- Non lus par groupe (plafonnés à 99), dernier message visible, sourdine.
create or replace function private.group_unread() returns table (scope_type text, scope_id uuid, unread int, last_at timestamptz, muted boolean)
language sql stable security definer set search_path = '' as $$
  with me as (select (select auth.uid()) as uid),
  scopes as (
    select 'family'::text as st, fm.family_id as sid, fm.joined_at from public.family_members fm, me where fm.user_id = me.uid
    union all
    select 'circle'::text, cm.circle_id, cm.joined_at from public.circle_members cm, me where cm.user_id = me.uid
  )
  select s.st, s.sid,
    (select count(*)::int from (select 1 from public.group_messages g, me
       where coalesce(g.family_id, g.circle_id) = s.sid and g.scope_type = s.st and g.sender_id <> me.uid and g.deleted_at is null
         and g.created_at > coalesce(p.last_read_at, s.joined_at)
         and private.gm_visible(g.scope_type, g.family_id, g.circle_id, g.sender_id) limit 99) x),
    (select max(g.created_at) from public.group_messages g
       where coalesce(g.family_id, g.circle_id) = s.sid and g.scope_type = s.st
         and private.gm_visible(g.scope_type, g.family_id, g.circle_id, g.sender_id)),
    coalesce(p.muted, false)
  from scopes s cross join me
  left join public.group_prefs p on p.user_id = me.uid
    and ((s.st = 'family' and p.family_id = s.sid) or (s.st = 'circle' and p.circle_id = s.sid));
$$;

create or replace function public.post_group_message(p_scope text, p_scope_id uuid, p_body text, p_kind text default 'text',
  p_reply_to uuid default null, p_client_id uuid default null) returns jsonb
language sql security invoker set search_path = '' as $$
  select private.post_group_message(p_scope, p_scope_id, p_body, p_kind, p_reply_to, p_client_id) $$;
create or replace function public.mark_group_read(p_scope text, p_scope_id uuid) returns void
language sql security invoker set search_path = '' as $$ select private.mark_group_read(p_scope, p_scope_id) $$;
create or replace function public.set_group_muted(p_scope text, p_scope_id uuid, p_muted boolean) returns void
language sql security invoker set search_path = '' as $$ select private.upsert_group_pref(p_scope, p_scope_id, false, p_muted) $$;
create or replace function public.group_unread() returns table (scope_type text, scope_id uuid, unread int, last_at timestamptz, muted boolean)
language sql stable security invoker set search_path = '' as $$ select * from private.group_unread() $$;

-- ===================================================================== 5. Supprimer pour tous + journal de modération
create table private.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  action text not null check (action in ('delete_group_message')),
  target_id uuid not null,
  target_user_id uuid,
  scope_type text, family_id uuid, circle_id uuid,
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index moderation_actions_created_idx on private.moderation_actions (created_at);
alter table private.moderation_actions enable row level security;
revoke all on private.moderation_actions from public, anon, authenticated;

-- Auteur, ou modération du groupe (fondateur / modérateur d'un cercle, parent d'une famille). Le texte est effacé
-- pour tout le monde ; une suppression par la modération garde une copie dans le journal (côté équipe Zikru).
create or replace function private.delete_group_message(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := (select auth.uid()); g public.group_messages; is_mod boolean;
begin
  if me is null then raise exception 'Connexion requise' using errcode = '42501'; end if;
  select * into g from public.group_messages where id = p_id;
  if not found or not private.gm_visible(g.scope_type, g.family_id, g.circle_id, g.sender_id) then
    raise exception 'Message introuvable' using errcode = '42501'; end if;
  if g.deleted_at is not null then return; end if;
  is_mod := case g.scope_type when 'circle' then private.is_circle_mod(g.circle_id) else private.is_family_parent(g.family_id) end;
  if g.sender_id <> me and not is_mod then raise exception 'Action non autorisée' using errcode = '42501'; end if;
  if g.sender_id <> me then
    insert into private.moderation_actions (actor_id, action, target_id, target_user_id, scope_type, family_id, circle_id, snapshot)
      values (me, 'delete_group_message', g.id, g.sender_id, g.scope_type, g.family_id, g.circle_id,
              jsonb_build_object('body', g.body, 'kind', g.kind, 'sender_name', g.sender_name, 'created_at', g.created_at));
  end if;
  update public.group_messages set body = '', deleted_at = now(), deleted_by = me where id = p_id;
end $$;
create or replace function public.delete_group_message(p_id uuid) returns void
language sql security invoker set search_path = '' as $$ select private.delete_group_message(p_id) $$;

-- Signalement : nouveau type de cible « group_message » (les autres types sont inchangés).
alter table public.reports drop constraint if exists reports_target_type_check;
alter table public.reports add constraint reports_target_type_check
  check (target_type in ('message','member','circle','session','group_message'));

-- report_content : version Passe 5 = version lot B + branche « group_message ».
create or replace function private.report_content(p_target_type text, p_target_id uuid, p_reason text, p_details text,
  p_scope_type text, p_scope_id uuid, p_block boolean) returns uuid
language plpgsql security definer set search_path = '' as $$
declare me uuid := (select auth.uid()); tu uuid; st text; fid uuid; cid uuid; snap jsonb; rid uuid;
        e public.encouragements; s public.zikr_sessions; c public.circles; gm public.group_messages;
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
  elsif p_target_type = 'group_message' then
    select * into gm from public.group_messages where id = p_target_id;
    -- Visible, ou masqué seulement parce que la personne qui signale a bloqué l'auteur (signaler après avoir bloqué).
    if not found or gm.deleted_at is not null or not (private.gm_visible(gm.scope_type, gm.family_id, gm.circle_id, gm.sender_id)
         or (private.scope_member(gm.scope_type, gm.family_id, gm.circle_id) and private.is_blocked(me, gm.sender_id))) then
      raise exception 'Message introuvable' using errcode = '42501'; end if;
    tu := gm.sender_id; st := gm.scope_type; fid := gm.family_id; cid := gm.circle_id;
    snap := jsonb_build_object('body', gm.body, 'kind', gm.kind, 'sender_id', gm.sender_id, 'sender_name', gm.sender_name,
                               'reply_to', gm.reply_to, 'created_at', gm.created_at);
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
-- ===================================================================== 6. Conservation (365 jours)
-- purge_expired : version lot B + messages de groupe + préférences orphelines (personne sortie du groupe).
create or replace function private.purge_expired() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare n_msg int; n_live int; n_ses int; n_inv int; n_rep int; n_rate int; n_sus int; n_gm int; n_gp int; n_ma int;
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
  delete from public.group_messages where created_at < now() - make_interval(days => private.retention_days('group_messages_days', 365));
  get diagnostics n_gm = row_count;
  delete from public.group_prefs p where not exists (
    select 1 from public.family_members m where p.family_id is not null and m.family_id = p.family_id and m.user_id = p.user_id
    union all
    select 1 from public.circle_members m where p.circle_id is not null and m.circle_id = p.circle_id and m.user_id = p.user_id);
  get diagnostics n_gp = row_count;
  delete from private.moderation_actions where created_at < now() - make_interval(days => private.retention_days('reports_closed_days', 365));
  get diagnostics n_ma = row_count;
  return jsonb_build_object('messages', n_msg, 'live_closed', n_live, 'sessions', n_ses, 'invitations', n_inv,
                            'reports', n_rep, 'rate_counters', n_rate, 'suspensions', n_sus,
                            'group_messages', n_gm, 'group_prefs', n_gp, 'moderation_actions', n_ma, 'at', now());
end $$;

-- ===================================================================== 7. Temps réel
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.group_messages;
  end if;
end $$;

-- File de modération : journal des suppressions par les modérateurs de groupe (éditeur SQL, non exposé).
create or replace view private.moderation_log as
  select a.created_at, a.action, a.actor_id, a.target_id, a.target_user_id, a.scope_type, a.family_id, a.circle_id, a.snapshot
  from private.moderation_actions a order by a.created_at desc;
revoke all on private.moderation_log from public, anon, authenticated;

-- ===================================================================== Droits
revoke all on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated;
revoke execute on function private.purge_expired() from authenticated;
revoke execute on function public.post_group_message(text, uuid, text, text, uuid, uuid), public.mark_group_read(text, uuid),
  public.set_group_muted(text, uuid, boolean), public.group_unread(), public.delete_group_message(uuid),
  public.group_chat_rights(text, uuid) from public, anon;
grant execute on function public.post_group_message(text, uuid, text, text, uuid, uuid), public.mark_group_read(text, uuid),
  public.set_group_muted(text, uuid, boolean), public.group_unread(), public.delete_group_message(uuid),
  public.group_chat_rights(text, uuid) to authenticated;
