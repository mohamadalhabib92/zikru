-- Lot A — Sécurité de la messagerie des communautés (audit du 30.10.2026).
-- Dépend de : 20261027220000_communautes_famille_proches.sql, 20261030100000_droits_limite_groupes.sql.
--
--  1. Contrôle parental : défaut « parents seulement » ; « Aucun » bloque vraiment l'envoi ET la réception
--     (même avec les parents) ; un invité ne peut jamais écrire à un enfant (ni l'inverse) ;
--     un mineur n'échange que dans une famille où il est « enfant ».
--  2. Zikr en direct : le nom affiché est posé par le serveur (nom du membre dans le lieu), plus d'usurpation ;
--     le compteur ne peut pas monter plus vite qu'un humain (cadence + rafale configurables).
--  3. Limitation de débit (messages, sessions, essais de codes, création d'invitations) : SQLSTATE ZKR01.
--  4. Codes d'invitation stockés hachés (SHA-256) ; le code n'est montré qu'une fois, à la création.
--  5. Un modérateur ne peut pas créer d'invitation « modérateur » ; une invitation révoquée ne peut pas être réactivée.
--  6. Pas deux fois le même nom dans un cercle (anti-usurpation) : SQLSTATE ZKN01.
-- Tous les seuils vivent dans public.app_config (clés 'rate.*', 'live.*') : modifiables sans publier l'app.

-- ===================================================================== 1. Contrôle parental
alter table public.parental_controls alter column messaging set default 'parents';

-- Réglage de messagerie d'un enfant ('none' | 'parents' | 'family'). Défaut prudent : 'parents'.
create or replace function private.child_messaging(fid uuid, uid uuid) returns text
language sql stable security definer set search_path = '' as $$
  select coalesce((select pc.messaging from public.family_members m join public.parental_controls pc on pc.child_member_id = m.id
                   where m.family_id = fid and m.user_id = uid), 'parents');
$$;

-- Peut-on écrire à « recipient » ? (redéfinie au lot B pour ajouter le blocage)
create or replace function private.can_message(st text, fid uuid, cid uuid, recipient uuid) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare me uuid := (select auth.uid()); rrole text; srole text; sm text; rm text;
begin
  if me is null or recipient is null or recipient = me then return false; end if;
  if st = 'family' then
    select role into srole from public.family_members where family_id = fid and user_id = me;
    select role into rrole from public.family_members where family_id = fid and user_id = recipient;
    if srole is null or rrole is null then return false; end if;
    -- Un mineur n'échange que là où il est « enfant » (donc sous contrôle parental).
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

-- « Aucun » = l'enfant ne reçoit plus rien non plus : les messages déjà reçus de non-parents restent visibles
-- des parents (supervision) mais plus de l'enfant. Lecture : voir encouragements_select (lot B).

-- ===================================================================== 3. Limitation de débit
create table private.rate_counters (
  user_id uuid not null,
  action text not null,
  bucket bigint not null,        -- numéro de fenêtre (epoch / durée)
  n int not null default 0,
  at timestamptz not null default now(),   -- début de fenêtre (sert à la purge)
  primary key (user_id, action, bucket)
);
alter table private.rate_counters enable row level security;
revoke all on private.rate_counters from public, anon, authenticated;

-- Compte une action et refuse au-delà du seuil (SQLSTATE ZKR01, détail JSON avec retry_after_s).
-- Seuil : app_config 'rate.<action>' = {"max": n, "window_s": s}, sinon valeurs par défaut.
create or replace function private.rate_hit(p_action text, p_max int, p_window_s int) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare me uuid := (select auth.uid()); cfg jsonb := private.config('rate.' || p_action);
        mx int := coalesce((cfg ->> 'max')::int, p_max); win int := greatest(coalesce((cfg ->> 'window_s')::int, p_window_s), 1);
        b bigint; c int; ep numeric := extract(epoch from now());
begin
  if me is null or mx is null or mx <= 0 then return; end if;   -- service / désactivé
  b := floor(ep / win)::bigint;
  insert into private.rate_counters as r (user_id, action, bucket, n) values (me, p_action, b, 1)
    on conflict (user_id, action, bucket) do update set n = r.n + 1
    returning n into c;
  if c > mx then
    raise exception 'Trop de tentatives. Réessayez dans un moment.' using errcode = 'ZKR01',
      detail = jsonb_build_object('action', p_action, 'max', mx, 'window_s', win, 'retry_after_s', ceil((b + 1) * win - ep))::text;
  end if;
end $$;

insert into public.app_config (key, value, description) values
  ('rate.message',        '{"max": 30, "window_s": 3600}', 'Encouragements envoyés par heure et par personne.'),
  ('rate.message_burst',  '{"max": 6, "window_s": 60}',    'Encouragements envoyés par minute et par personne.'),
  ('rate.session_create', '{"max": 6, "window_s": 3600}',  'Sessions de zikr en direct lancées par heure.'),
  ('rate.invite_attempt', '{"max": 30, "window_s": 3600}', 'Essais de code d''invitation (aperçu + adhésion) par heure.'),
  ('rate.invite_create',  '{"max": 20, "window_s": 3600}', 'Invitations créées par heure.'),
  ('live.max_rate',       '15',  'Zikr en direct : hausse maximale du compteur par seconde (cadence humaine).'),
  ('live.burst',          '200', 'Zikr en direct : rafale tolérée (comptage hors ligne puis envoi).')
on conflict (key) do nothing;

create or replace function private.encouragements_rate() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.rate_hit('message_burst', 6, 60);
  perform private.rate_hit('message', 30, 3600);
  return new;
end $$;
create trigger encouragements_rate before insert on public.encouragements
  for each row execute function private.encouragements_rate();

create or replace function private.zikr_sessions_rate() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.rate_hit('session_create', 6, 3600);
  return new;
end $$;
create trigger zikr_sessions_rate before insert on public.zikr_sessions
  for each row execute function private.zikr_sessions_rate();

-- ===================================================================== 2. Zikr en direct : nom et compteur
create or replace function private.session_counts_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare s public.zikr_sessions; nm text; since timestamptz; prev int := 0; allowed numeric;
        rate numeric := coalesce((private.config('live.max_rate') #>> '{}')::numeric, 15);
        burst numeric := coalesce((private.config('live.burst') #>> '{}')::numeric, 200);
begin
  select * into s from public.zikr_sessions where id = new.session_id;
  if s.scope_type = 'family' then
    select display_name into nm from public.family_members where family_id = s.family_id and user_id = new.user_id;
  else
    select display_name into nm from public.circle_members where circle_id = s.circle_id and user_id = new.user_id;
  end if;
  if coalesce(trim(nm), '') = '' then select display_name into nm from public.profiles where id = new.user_id; end if;
  new.display_name := left(coalesce(trim(nm), ''), 60);   -- jamais la valeur envoyée par le client
  if tg_op = 'UPDATE' then
    new.session_id := old.session_id; new.user_id := old.user_id;
    prev := old.count; since := old.updated_at;
  else
    since := coalesce(s.started_at, now());
  end if;
  if new.count > prev then
    allowed := prev + burst + ceil(rate * greatest(extract(epoch from now() - since), 0));
    new.count := least(new.count::numeric, allowed, 1000000)::int;
  end if;
  new.updated_at := now();                                  -- horloge serveur (sert au calcul de cadence)
  return new;
end $$;
create trigger zikr_session_counts_guard before insert or update on public.zikr_session_counts
  for each row execute function private.session_counts_guard();

-- ===================================================================== 4. Codes d'invitation hachés
create or replace function private.code_hash(p_code text) returns bytea
language sql immutable set search_path = '' as $$
  select extensions.digest(upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g')), 'sha256');
$$;

alter table public.invitations add column code_hash bytea;
update public.invitations set code_hash = private.code_hash(code);
alter table public.invitations alter column code_hash set not null;
alter table public.invitations add constraint invitations_code_hash_key unique (code_hash);
alter table public.invitations drop column code;   -- plus aucun code en clair en base
-- Le hash reste côté serveur : lecture client limitée aux colonnes utiles.
revoke select on public.invitations from anon, authenticated;
grant select (id, scope_type, family_id, circle_id, role, max_uses, uses, expires_at, revoked_at, created_by, created_at)
  on public.invitations to authenticated;

drop function public.create_invitation(text, uuid, text, int, int);
drop function private.create_invitation(text, uuid, text, int, int);
create function private.create_invitation(p_scope text, p_scope_id uuid, p_role text, p_max_uses int, p_days int)
returns table (id uuid, code text, expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare me uuid := (select auth.uid()); c text; e timestamptz; nid uuid;
begin
  if me is null then raise exception 'Connexion requise' using errcode = '42501'; end if;
  if p_scope = 'family' then
    if not private.is_family_parent(p_scope_id) then raise exception 'Réservé aux parents de la famille' using errcode = '42501'; end if;
    if p_role not in ('parent','adult','child','guest') then raise exception 'Rôle inconnu' using errcode = 'check_violation'; end if;
  elsif p_scope = 'circle' then
    if not private.is_circle_mod(p_scope_id) then raise exception 'Réservé au fondateur et aux modérateurs' using errcode = '42501'; end if;
    if p_role not in ('member','moderator') then raise exception 'Rôle inconnu' using errcode = 'check_violation'; end if;
    if p_role = 'moderator' and private.circle_role(p_scope_id) <> 'founder' then
      raise exception 'Seul le fondateur peut inviter un modérateur' using errcode = '42501'; end if;
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
    exception when unique_violation then -- collision improbable : on régénère
    end;
  end loop;
  return query select nid, c, e;   -- seul moment où le code en clair existe
end $$;
create function public.create_invitation(p_scope text, p_scope_id uuid, p_role text, p_max_uses int default 1, p_days int default 7)
returns table (id uuid, code text, expires_at timestamptz)
language sql security invoker set search_path = '' as $$ select * from private.create_invitation(p_scope, p_scope_id, p_role, p_max_uses, p_days) $$;
revoke execute on function private.create_invitation(text, uuid, text, int, int), public.create_invitation(text, uuid, text, int, int) from public, anon;
grant execute on function private.create_invitation(text, uuid, text, int, int), public.create_invitation(text, uuid, text, int, int) to authenticated;

-- Aperçu : compte comme un essai (anti force brute) → volatile.
create or replace function private.preview_invitation(p_code text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare i public.invitations; n text; rules text; cnt int; cap int;
begin
  if (select auth.uid()) is null then raise exception 'Connexion requise' using errcode = '42501'; end if;
  perform private.rate_hit('invite_attempt', 30, 3600);
  select * into i from public.invitations where code_hash = private.code_hash(p_code);
  if not found or i.revoked_at is not null or i.expires_at < now() or i.uses >= i.max_uses then
    return jsonb_build_object('valid', false);
  end if;
  if i.scope_type = 'family' then
    select name into n from public.families where id = i.family_id;
    select count(*) into cnt from public.family_members where family_id = i.family_id;
  else
    select c.name, c.rules into n, rules from public.circles c where id = i.circle_id;
    select count(*) into cnt from public.circle_members where circle_id = i.circle_id;
    cap := private.group_member_cap(i.circle_id);
  end if;
  return jsonb_build_object('valid', true, 'scope_type', i.scope_type, 'name', n, 'role', i.role,
    'rules', rules, 'members', cnt, 'max_members', cap, 'full', cap is not null and cnt >= cap, 'expires_at', i.expires_at);
end $$;
create or replace function public.preview_invitation(p_code text) returns jsonb
language sql volatile security invoker set search_path = '' as $$ select private.preview_invitation(p_code) $$;

-- Adhésion. Un code invalide ne lève PAS d'erreur (sinon le compteur d'essais serait annulé avec la transaction) :
-- il renvoie {"error": "invalid"}.
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

-- ===================================================================== 5. Révocation définitive
create or replace function private.invitations_revoke_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.revoked_at is not null and new.revoked_at is distinct from old.revoked_at then
    raise exception 'Une invitation révoquée ne peut pas être réactivée' using errcode = '42501';
  end if;
  if old.revoked_at is null and new.revoked_at is not null then new.revoked_at := now(); end if;
  return new;
end $$;
create trigger invitations_revoke_guard before update of revoked_at on public.invitations
  for each row execute function private.invitations_revoke_guard();

drop policy invitations_update on public.invitations;
create policy invitations_update on public.invitations for update to authenticated
  using (created_by = (select auth.uid())
         or (scope_type = 'family' and private.is_family_parent(family_id))
         or (scope_type = 'circle' and private.is_circle_mod(circle_id)))
  with check (created_by = (select auth.uid())
         or (scope_type = 'family' and private.is_family_parent(family_id))
         or (scope_type = 'circle' and private.is_circle_mod(circle_id)));

-- ===================================================================== 6. Noms uniques dans un cercle
create or replace function private.circle_member_name_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.display_name := left(trim(new.display_name), 60);
  if exists (select 1 from public.circle_members m where m.circle_id = new.circle_id and m.user_id <> new.user_id
             and lower(trim(m.display_name)) = lower(new.display_name)) then
    raise exception 'Ce nom est déjà utilisé dans ce cercle' using errcode = 'ZKN01';
  end if;
  return new;
end $$;
create trigger circle_members_name_guard before insert or update of display_name on public.circle_members
  for each row execute function private.circle_member_name_guard();

revoke all on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated;
