-- =====================================================================================
-- Zikru P1 — Groupes de zikr, invitations hachées, compteur temps réel sans double comptage.
--
-- ÉTAT : BROUILLON NON APPLIQUÉ. Ce fichier vit dans docs/p1-groups/ et n'est PAS dans
-- supabase/migrations/. Relire, tester (docs/p1-groups/sql/tests), puis le déplacer dans
-- supabase/migrations/ et l'appliquer d'abord sur une branche / un projet de test.
--
-- Dépend de : 20261027220000_communautes_famille_proches.sql (+ 2210, 2220)
--            et de docs/entitlements/sql/20261029110000_p1a_droits.sql (droits gratuit/premium).
-- Choix : un « groupe de zikr » = un cercle (niveau 2) existant. Rôles : founder = administrateur,
-- moderator = modérateur, member = membre. On étend l'existant au lieu de dupliquer des tables.
--
-- Contenu :
--   1. private.hit()             limitation de débit générique (par compte, par fenêtre)
--   2. group_invites             invitations à jeton aléatoire 192 bits, seul le SHA-256 est stocké
--   3. devices                   appareils d'un compte (téléphone, montre, bague, web)
--   4. counter_events            événements de comptage idempotents, clé (device_id, seq, goal_id)
--   5. ingest_counter_events()   ingestion par lots, dédoublonnage, plausibilité, totaux renvoyés
--   6. Realtime broadcast privé  topic « goal:<uuid> », lecture réservée aux membres (RLS)
--   7. group_planned_sessions    séances programmées (rappels calculés en local sur l'appareil)
--   8. RPC publiques (SECURITY INVOKER) + droits
--
-- Règles reprises de la base : fonctions SECURITY DEFINER uniquement dans « private »,
-- search_path = '' partout, aucun droit pour anon, RLS sur chaque table exposée.
-- =====================================================================================

-- ---------------------------------------------------------------- 0. Petites extensions de l'existant
-- Nouvelles sources de comptage (montre, bague ZKR-R1, écran du tasbih).
alter table public.goal_contributions drop constraint if exists goal_contributions_source_check;
alter table public.goal_contributions add constraint goal_contributions_source_check
  check (source in ('manuel','bluetooth','clavier','live','ecran','montre','bague'));

-- ---------------------------------------------------------------- 1. Limitation de débit
-- Compteur de requêtes par (compte, seau, fenêtre fixe). Les anciennes fenêtres sont purgées
-- par une tâche pg_cron (voir fin de fichier). Aucune table exposée : accès via fonctions seulement.
create table private.rate_limits (
  user_id uuid not null,
  bucket text not null,
  window_start timestamptz not null,
  hits int not null default 0,
  primary key (user_id, bucket, window_start)
);

create or replace function private.hit(p_bucket text, p_max int, p_window_s int) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := (select auth.uid()); w timestamptz; n int;
begin
  if me is null then raise exception 'Connexion requise' using errcode = '42501'; end if;
  w := to_timestamp(floor(extract(epoch from now()) / p_window_s) * p_window_s);
  insert into private.rate_limits as r (user_id, bucket, window_start, hits) values (me, p_bucket, w, 1)
    on conflict (user_id, bucket, window_start) do update set hits = r.hits + 1
    returning hits into n;
  if n > p_max then
    raise exception 'Trop de requêtes, réessayez dans quelques minutes' using errcode = 'P0429';
  end if;
end $$;

-- base64url sans remplissage (jetons copiables dans une URL / un QR code).
create or replace function private.b64url(b bytea) returns text
language sql immutable set search_path = '' as $$
  select rtrim(translate(encode(b, 'base64'), E'+/\n', '-_'), '=');
$$;

-- ---------------------------------------------------------------- 2. Invitations hachées
-- Le jeton (24 octets aléatoires = 192 bits, 32 caractères base64url) n'est montré qu'une fois,
-- à sa création. La base ne garde que SHA-256(jeton) : une fuite de la table ne permet pas de
-- rejoindre un groupe. 192 bits rendent la force brute impossible ; la limitation de débit
-- protège en plus contre le spam de tentatives.
create table public.group_invites (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.circles(id) on delete cascade,
  token_hash bytea not null unique check (octet_length(token_hash) = 32),
  role text not null default 'member' check (role in ('member','moderator')),
  max_uses int not null default 10 check (max_uses between 1 and 200),
  uses int not null default 0 check (uses >= 0),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (expires_at > created_at and expires_at <= created_at + interval '7 days'),
  check (uses <= max_uses)
);
create index group_invites_circle_idx on public.group_invites (circle_id);
create index group_invites_created_by_idx on public.group_invites (created_by);

create table public.group_invite_redemptions (
  invite_id uuid not null references public.group_invites(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  redeemed_at timestamptz not null default now(),
  primary key (invite_id, user_id)
);
create index group_invite_redemptions_user_idx on public.group_invite_redemptions (user_id);

create or replace function private.create_group_invite(p_circle uuid, p_role text, p_max_uses int, p_hours int)
returns table (invite_id uuid, token text, expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare me uuid := (select auth.uid()); r text := coalesce(p_role, 'member'); t text; e timestamptz; iid uuid;
begin
  if me is null then raise exception 'Connexion requise' using errcode = '42501'; end if;
  if not private.is_circle_mod(p_circle) then
    raise exception 'Réservé à l''administrateur et aux modérateurs du groupe' using errcode = '42501'; end if;
  if r not in ('member','moderator') then raise exception 'Rôle inconnu' using errcode = '22023'; end if;
  if r = 'moderator' and private.circle_role(p_circle) <> 'founder' then
    raise exception 'Seul l''administrateur peut inviter un modérateur' using errcode = '42501'; end if;
  perform private.hit('invite:create', 30, 3600);
  if (select count(*) from public.group_invites i
      where i.circle_id = p_circle and i.revoked_at is null and i.expires_at > now() and i.uses < i.max_uses) >= 20 then
    raise exception 'Trop d''invitations actives (20 max) : révoquez-en une' using errcode = 'check_violation'; end if;
  t := private.b64url(extensions.gen_random_bytes(24));
  e := now() + make_interval(hours => least(greatest(coalesce(p_hours, 48), 1), 168));  -- 1 h à 7 jours
  insert into public.group_invites (circle_id, token_hash, role, max_uses, expires_at, created_by)
    values (p_circle, extensions.digest(t, 'sha256'), r, least(greatest(coalesce(p_max_uses, 10), 1), 200), e, me)
    returning id into iid;
  return query select iid, t, e;
end $$;

-- Aperçu avant d'accepter : nom du groupe, nombre de membres, règlement. Ne révèle rien
-- d'autre (ni membres, ni objectifs). Même message pour « inexistant », « expiré », « révoqué ».
create or replace function private.preview_group_invite(p_token text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare i public.group_invites; c public.circles; n int; cap int;
begin
  if (select auth.uid()) is null then raise exception 'Connexion requise' using errcode = '42501'; end if;
  perform private.hit('invite:preview', 60, 3600);
  select * into i from public.group_invites where token_hash = extensions.digest(coalesce(p_token, ''), 'sha256');
  if not found or i.revoked_at is not null or i.expires_at <= now() or i.uses >= i.max_uses then
    return jsonb_build_object('valid', false); end if;
  select * into c from public.circles where id = i.circle_id;
  select count(*) into n from public.circle_members where circle_id = c.id;
  cap := private.group_member_cap(c.id);  -- P1a : capacité effective (plan du propriétaire), jamais une constante
  return jsonb_build_object('valid', true, 'circle_id', c.id, 'name', c.name, 'description', c.description,
    'rules', c.rules, 'members', n, 'max_members', cap, 'full', n >= cap, 'role', i.role, 'expires_at', i.expires_at,
    'already_member', private.is_circle_member(c.id));
end $$;

create or replace function private.join_group(p_token text, p_display_name text, p_accept_rules boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := (select auth.uid()); i public.group_invites; c public.circles;
        nm text := left(trim(coalesce(p_display_name, '')), 60);
begin
  if me is null then raise exception 'Connexion requise' using errcode = '42501'; end if;
  perform private.hit('invite:join', 20, 3600);
  if nm = '' then raise exception 'Indiquez un nom affiché' using errcode = '22023'; end if;
  -- Verrou de ligne : deux personnes qui utilisent la dernière place en même temps ne passent pas toutes les deux.
  select * into i from public.group_invites where token_hash = extensions.digest(coalesce(p_token, ''), 'sha256') for update;
  if not found or i.revoked_at is not null or i.expires_at <= now() or i.uses >= i.max_uses then
    raise exception 'Invitation invalide ou expirée' using errcode = 'P0002'; end if;
  if private.is_minor(me) then raise exception 'Les comptes enfants restent dans leur famille' using errcode = '42501'; end if;
  if private.is_circle_member(i.circle_id) then raise exception 'Vous êtes déjà membre de ce groupe' using errcode = '23505'; end if;
  select * into c from public.circles where id = i.circle_id;
  if c.rules is not null and not coalesce(p_accept_rules, false) then
    raise exception 'Le règlement du groupe doit être accepté' using errcode = '22023'; end if;
  -- Le déclencheur circle_members_guard (redéfini en P1a) verrouille la ligne du groupe, compte les membres
  -- (créateur inclus) et compare à la limite du plan du propriétaire : SQLSTATE ZKG01 si complet.
  -- Il refuse aussi les mineurs. Toute l'opération est annulée en cas de refus (jeton non consommé).
  insert into public.circle_members (circle_id, user_id, display_name, role, rules_accepted_at)
    values (i.circle_id, me, nm, i.role, case when c.rules is not null then now() end);
  -- Par défaut : on montre la participation, pas le nombre (choix modifiable : set_group_sharing).
  insert into public.sharing_preferences (user_id, scope_type, circle_id, mode)
    values (me, 'circle', i.circle_id, 'participation') on conflict do nothing;
  insert into public.group_invite_redemptions (invite_id, user_id) values (i.id, me);
  update public.group_invites set uses = uses + 1 where id = i.id;
  return jsonb_build_object('circle_id', i.circle_id, 'role', i.role);
end $$;

create or replace function private.revoke_group_invite(p_invite uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare cid uuid;
begin
  select circle_id into cid from public.group_invites where id = p_invite;
  if cid is null or not private.is_circle_mod(cid) then raise exception 'Invitation introuvable' using errcode = 'P0002'; end if;
  update public.group_invites set revoked_at = coalesce(revoked_at, now()) where id = p_invite;
end $$;

create or replace function private.leave_group(p_circle uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  -- Le déclencheur circle_members_after transmet le rôle d'administrateur (ou supprime le groupe vide).
  delete from public.circle_members where circle_id = p_circle and user_id = (select auth.uid());
  if not found then raise exception 'Vous n''êtes pas membre de ce groupe' using errcode = 'P0002'; end if;
end $$;

-- Modération : un modérateur retire un membre ; seul l'administrateur retire un modérateur.
create or replace function private.remove_group_member(p_circle uuid, p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare target text; mine text := private.circle_role(p_circle);
begin
  select role into target from public.circle_members where circle_id = p_circle and user_id = p_user;
  if target is null then raise exception 'Membre introuvable' using errcode = 'P0002'; end if;
  if p_user = (select auth.uid()) then raise exception 'Utilisez « quitter le groupe »' using errcode = '22023'; end if;
  if target = 'founder' or mine is null or mine = 'member' or (target = 'moderator' and mine <> 'founder') then
    raise exception 'Action réservée' using errcode = '42501'; end if;
  delete from public.circle_members where circle_id = p_circle and user_id = p_user;
end $$;

-- Confidentialité de sa progression dans un groupe : 'nothing' (invisible), 'participation'
-- (« a participé », sans nombre — défaut), 'counter' (nombre visible par les membres).
-- La règle est appliquée côté serveur par private.goal_progress (migration de base).
create or replace function private.set_group_sharing(p_circle uuid, p_mode text) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := (select auth.uid());
begin
  if not private.is_circle_member(p_circle) then raise exception 'Groupe introuvable' using errcode = 'P0002'; end if;
  if p_mode not in ('nothing','participation','counter') then raise exception 'Mode inconnu' using errcode = '22023'; end if;
  insert into public.sharing_preferences as s (user_id, scope_type, circle_id, mode) values (me, 'circle', p_circle, p_mode)
    on conflict (user_id, family_id, circle_id) do update set mode = excluded.mode, updated_at = now();
end $$;

-- ---------------------------------------------------------------- 3. Appareils
-- L'identifiant est généré par l'appareil (UUID v4) au premier lancement et stocké AVEC son
-- compteur seq (voir client/counterQueue.ts). Le serveur refuse qu'un compte réutilise
-- l'identifiant d'un appareil appartenant à un autre compte.
create table public.devices (
  id uuid primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('phone','tablet','watch','ring','web')),
  label text not null default '' check (char_length(label) <= 60),
  attested_at timestamptz,        -- P4 : dernière attestation App Attest / Play Integrity vérifiée
  ring_cert_serial text check (char_length(ring_cert_serial) <= 64),  -- P5 : certificat de la bague
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index devices_user_idx on public.devices (user_id);

create or replace function private.register_device(p_id uuid, p_kind text, p_label text) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := (select auth.uid()); owner uuid;
begin
  if me is null then raise exception 'Connexion requise' using errcode = '42501'; end if;
  if p_id is null then raise exception 'Identifiant d''appareil manquant' using errcode = '22023'; end if;
  select user_id into owner from public.devices where id = p_id;
  if owner is not null and owner <> me then
    raise exception 'Identifiant d''appareil déjà utilisé' using errcode = '42501'; end if;
  if owner is null and (select count(*) from public.devices where user_id = me) >= 12 then
    raise exception 'Trop d''appareils (12 max) : retirez-en un dans les réglages' using errcode = 'check_violation'; end if;
  insert into public.devices (id, user_id, kind, label) values (p_id, me, p_kind, left(coalesce(p_label, ''), 60))
    on conflict (id) do update set kind = excluded.kind, label = excluded.label, last_seen_at = now();
end $$;

-- ---------------------------------------------------------------- 4. Événements de comptage
-- Un événement = « l'appareil D, dans son lot n° seq, a compté N pour l'objectif G ».
-- Clé primaire (device_id, seq, goal_id) : renvoyer le même lot (réseau coupé après
-- l'écriture, double tap sur « synchroniser », montre + téléphone qui relaient la même bague…)
-- ne compte JAMAIS deux fois. Un même seq peut viser plusieurs objectifs liés (fan-out).
-- Le total d'un objectif = somme sur les événements distincts = G-counter par appareil :
-- l'ordre d'arrivée n'a pas d'importance, la fusion est une union d'ensembles.
create table public.counter_events (
  device_id uuid not null references public.devices(id) on delete cascade,
  seq bigint not null check (seq between 1 and 9007199254740991),   -- Number.MAX_SAFE_INTEGER côté JS
  goal_id uuid not null references public.shared_goals(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  count int not null check (count between 1 and 1000),
  source text not null check (source in ('ecran','bague','montre','clavier','bluetooth')),
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  primary key (device_id, seq, goal_id)
);
create index counter_events_goal_idx on public.counter_events (goal_id);
create index counter_events_user_idx on public.counter_events (user_id);

-- Plausibilité : total compté par (appareil, objectif, minute d'occurrence).
create table private.counter_minute (
  device_id uuid not null,
  goal_id uuid not null,
  minute timestamptz not null,
  total int not null,
  primary key (device_id, goal_id, minute)
);

-- ---------------------------------------------------------------- 5. Ingestion idempotente
-- Entrée : p_events = [{"seq":1,"goal_id":"…","count":33,"at":"2026-10-29T18:00:00Z","source":"bague"}, …]
-- Sortie : {"accepted":n,"duplicates":n,"acked":[{seq,goal_id}…],"rejected":[{seq,goal_id,reason}…],"totals":{goal_id:total}}
--   acked    = à retirer de la file locale (nouveaux OU déjà connus du serveur)
--   rejected = à retirer aussi (définitif : format, horodatage, objectif fermé, cadence)
--   totals   = total serveur des objectifs touchés, pour un affichage sans double comptage
-- Une erreur levée (connexion, appareil, débit) = rien n'est écrit : la file réessaie plus tard.
create or replace function private.ingest_counter_events(p_device uuid, p_events jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  owner uuid;
  e jsonb; v_seq bigint; v_goal uuid; v_count int; v_at timestamptz; v_src text;
  n_acc int := 0; n_dup int := 0; ins int; m int;
  acked jsonb := '[]'::jsonb; rejected jsonb := '[]'::jsonb; goals uuid[] := '{}'; totals jsonb;
  max_per_minute constant int := 1200;          -- 20 par seconde : au-delà, ce n'est plus un dhikr humain
begin
  if me is null then raise exception 'Connexion requise' using errcode = '42501'; end if;
  select user_id into owner from public.devices where id = p_device;
  if owner is null or owner <> me then raise exception 'Appareil inconnu' using errcode = '42501'; end if;
  if p_events is null or jsonb_typeof(p_events) <> 'array' or jsonb_array_length(p_events) > 500 then
    raise exception 'Lot invalide (tableau de 500 événements au plus)' using errcode = '22023'; end if;
  perform private.hit('ingest', 240, 3600);     -- 240 lots par heure et par compte

  for e in select value from jsonb_array_elements(p_events) loop
    begin
      v_seq := (e->>'seq')::bigint; v_goal := (e->>'goal_id')::uuid; v_count := (e->>'count')::int;
      v_at := (e->>'at')::timestamptz; v_src := coalesce(e->>'source', 'ecran');
    exception when others then
      rejected := rejected || jsonb_build_object('seq', e->'seq', 'goal_id', e->'goal_id', 'reason', 'format');
      continue;
    end;
    if v_seq is null or v_goal is null or v_count is null or v_at is null
       or v_seq < 1 or v_count not between 1 and 1000 or v_src not in ('ecran','bague','montre','clavier','bluetooth') then
      rejected := rejected || jsonb_build_object('seq', v_seq, 'goal_id', v_goal, 'reason', 'format'); continue; end if;
    -- Hors-ligne toléré 30 jours ; horloge en avance tolérée 5 minutes.
    if v_at > now() + interval '5 minutes' or v_at < now() - interval '30 days' then
      rejected := rejected || jsonb_build_object('seq', v_seq, 'goal_id', v_goal, 'reason', 'horodatage'); continue; end if;
    -- Dédoublonnage AVANT le contrôle d'accès : un lot déjà enregistré reste « acquitté » même si
    -- l'objectif vient d'être atteint ou si l'on a quitté le groupe entre-temps.
    if exists (select 1 from public.counter_events where device_id = p_device and seq = v_seq and goal_id = v_goal) then
      n_dup := n_dup + 1; acked := acked || jsonb_build_object('seq', v_seq, 'goal_id', v_goal); continue; end if;
    if not private.can_contribute(v_goal, null) then
      rejected := rejected || jsonb_build_object('seq', v_seq, 'goal_id', v_goal, 'reason', 'objectif'); continue; end if;

    begin  -- sous-transaction : si la cadence est dépassée, tout ce bloc est annulé
      insert into public.counter_events (device_id, seq, goal_id, user_id, count, source, occurred_at)
        values (p_device, v_seq, v_goal, me, v_count, v_src, v_at)
        on conflict do nothing;                  -- course entre deux appels concurrents : l'un gagne
      get diagnostics ins = row_count;
      if ins = 0 then
        n_dup := n_dup + 1; acked := acked || jsonb_build_object('seq', v_seq, 'goal_id', v_goal); continue; end if;
      insert into private.counter_minute as cm (device_id, goal_id, minute, total)
        values (p_device, v_goal, date_trunc('minute', v_at), v_count)
        on conflict (device_id, goal_id, minute) do update set total = cm.total + excluded.total
        returning total into m;
      if m > max_per_minute then raise exception 'cadence' using errcode = 'P0422'; end if;
      -- Miroir dans goal_contributions : réutilise l'agrégation, la règle « objectif atteint »,
      -- goal_progress (confidentialité) et Realtime existants. client_id unique = 2e garde-fou.
      insert into public.goal_contributions (goal_id, user_id, count, source, client_id, created_at)
        values (v_goal, me, v_count,
                case v_src when 'bluetooth' then 'bluetooth' when 'clavier' then 'clavier' else v_src end,
                'ev:' || md5(p_device::text || ':' || v_seq::text || ':' || v_goal::text), least(v_at, now()));
      n_acc := n_acc + 1; acked := acked || jsonb_build_object('seq', v_seq, 'goal_id', v_goal);
      goals := goals || v_goal;
    exception when sqlstate 'P0422' then
      rejected := rejected || jsonb_build_object('seq', v_seq, 'goal_id', v_goal, 'reason', 'cadence');
    end;
  end loop;

  update public.devices set last_seen_at = now() where id = p_device;
  select coalesce(jsonb_object_agg(a.goal_id, a.total), '{}'::jsonb) into totals
    from public.aggregated_counters a
    where a.goal_id = any (array(select distinct (x->>'goal_id')::uuid from jsonb_array_elements(acked) x)) and a.day is null;
  return jsonb_build_object('accepted', n_acc, 'duplicates', n_dup, 'acked', acked, 'rejected', rejected, 'totals', totals);
end $$;

-- ---------------------------------------------------------------- 6. Realtime : broadcast privé
-- Chaque mise à jour du total d'un objectif est diffusée sur le topic privé « goal:<uuid> ».
-- Plus économe que postgres_changes (pas d'évaluation RLS par abonné et par ligne) ;
-- l'accès au topic est contrôlé par une politique RLS sur realtime.messages.
create or replace function private.can_read_goal_topic(t text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare g public.shared_goals;
begin
  if t is null or t !~ '^goal:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return false; end if;
  select * into g from public.shared_goals where id = substr(t, 6)::uuid;
  return found and private.scope_member(g.scope_type, g.family_id, g.circle_id);
end $$;

create or replace function private.broadcast_goal_total() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.goal_id is not null and new.day is null then
    begin
      perform realtime.send(
        jsonb_build_object('goal_id', new.goal_id, 'total', new.total, 'contributions', new.contributions, 'at', new.updated_at),
        'progress', 'goal:' || new.goal_id::text, true);
    exception when others then
      null;  -- le temps réel ne doit jamais bloquer l'enregistrement d'un dhikr
    end;
  end if;
  return null;
end $$;
create trigger aggregated_counters_broadcast after insert or update on public.aggregated_counters
  for each row execute function private.broadcast_goal_total();

-- Lecture seule pour les membres ; aucune politique INSERT : un client ne peut pas émettre
-- de faux totaux sur ce topic (seul le serveur publie, via realtime.send).
create policy zikru_goal_topic_read on realtime.messages for select to authenticated
  using (realtime.messages.extension = 'broadcast' and private.can_read_goal_topic((select realtime.topic())));

-- Présence pendant une séance en direct (topic « session:<uuid> ») : membres de la séance.
create or replace function private.can_join_session_topic(t text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
begin
  if t is null or t !~ '^session:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return false; end if;
  return private.session_live_and_visible(substr(t, 9)::uuid);
end $$;
create policy zikru_session_presence_read on realtime.messages for select to authenticated
  using (realtime.messages.extension = 'presence' and private.can_join_session_topic((select realtime.topic())));
create policy zikru_session_presence_write on realtime.messages for insert to authenticated
  with check (realtime.messages.extension = 'presence' and private.can_join_session_topic((select realtime.topic())));

-- ---------------------------------------------------------------- 7. Séances programmées
-- Les rappels sont planifiés EN LOCAL par chaque appareil (expo-notifications) à partir de ces
-- lignes : pas de serveur de push à exploiter, pas de jeton de notification à stocker en P1.
create table public.group_planned_sessions (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.circles(id) on delete cascade,
  goal_id uuid references public.shared_goals(id) on delete set null,
  title text not null check (char_length(title) between 1 and 80),
  formula text check (char_length(formula) <= 200),
  starts_at timestamptz not null,
  duration_minutes int not null default 30 check (duration_minutes between 5 and 240),
  recurrence text not null default 'none' check (recurrence in ('none','daily','weekly')),
  tz text not null default 'Europe/Zurich' check (char_length(tz) <= 64),   -- fuseau de référence de la récurrence
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index group_planned_sessions_circle_idx on public.group_planned_sessions (circle_id, starts_at);
create index group_planned_sessions_goal_idx on public.group_planned_sessions (goal_id);
create index group_planned_sessions_created_by_idx on public.group_planned_sessions (created_by);

-- ---------------------------------------------------------------- RLS
alter table public.group_invites enable row level security;
alter table public.group_invite_redemptions enable row level security;
alter table public.devices enable row level security;
alter table public.counter_events enable row level security;
alter table public.group_planned_sessions enable row level security;

-- Invitations : visibles par les responsables du groupe (sans le hash, voir droits de colonnes).
create policy group_invites_select on public.group_invites for select to authenticated
  using (private.is_circle_mod(circle_id));
create policy group_invite_redemptions_select on public.group_invite_redemptions for select to authenticated
  using (user_id = (select auth.uid())
         or exists (select 1 from public.group_invites i where i.id = invite_id and private.is_circle_mod(i.circle_id)));
-- Appareils : chacun voit et retire les siens. Création via register_device uniquement.
create policy devices_select on public.devices for select to authenticated using (user_id = (select auth.uid()));
create policy devices_delete on public.devices for delete to authenticated using (user_id = (select auth.uid()));
-- Événements bruts : seulement les siens (les autres membres voient les totaux, selon leur partage).
create policy counter_events_select on public.counter_events for select to authenticated using (user_id = (select auth.uid()));
-- Séances : membres en lecture, responsables en écriture.
create policy group_planned_sessions_select on public.group_planned_sessions for select to authenticated
  using (private.is_circle_member(circle_id));
create policy group_planned_sessions_insert on public.group_planned_sessions for insert to authenticated
  with check (private.is_circle_mod(circle_id) and created_by = (select auth.uid()));
create policy group_planned_sessions_update on public.group_planned_sessions for update to authenticated
  using (private.is_circle_mod(circle_id)) with check (private.is_circle_mod(circle_id));
create policy group_planned_sessions_delete on public.group_planned_sessions for delete to authenticated
  using (private.is_circle_mod(circle_id));

revoke all on public.group_invites, public.group_invite_redemptions, public.devices, public.counter_events,
  public.group_planned_sessions from anon, public;
revoke all on public.group_invites, public.group_invite_redemptions, public.devices, public.counter_events,
  public.group_planned_sessions from authenticated;
grant select (id, circle_id, role, max_uses, uses, expires_at, revoked_at, created_by, created_at)
  on public.group_invites to authenticated;
grant select on public.group_invite_redemptions, public.counter_events to authenticated;
grant select, delete on public.devices to authenticated;
grant select, insert, update, delete on public.group_planned_sessions to authenticated;
revoke all on private.rate_limits, private.counter_minute from public, anon, authenticated;

-- ---------------------------------------------------------------- 8. RPC publiques (enveloppes INVOKER)
create function public.create_group_invite(p_circle uuid, p_role text default 'member', p_max_uses int default 10, p_hours int default 48)
returns table (invite_id uuid, token text, expires_at timestamptz)
language sql security invoker set search_path = '' as $$ select * from private.create_group_invite(p_circle, p_role, p_max_uses, p_hours) $$;
create function public.preview_group_invite(p_token text) returns jsonb
language sql security invoker set search_path = '' as $$ select private.preview_group_invite(p_token) $$;
create function public.join_group(p_token text, p_display_name text, p_accept_rules boolean default false) returns jsonb
language sql security invoker set search_path = '' as $$ select private.join_group(p_token, p_display_name, p_accept_rules) $$;
create function public.revoke_group_invite(p_invite uuid) returns void
language sql security invoker set search_path = '' as $$ select private.revoke_group_invite(p_invite) $$;
create function public.leave_group(p_circle uuid) returns void
language sql security invoker set search_path = '' as $$ select private.leave_group(p_circle) $$;
create function public.remove_group_member(p_circle uuid, p_user uuid) returns void
language sql security invoker set search_path = '' as $$ select private.remove_group_member(p_circle, p_user) $$;
create function public.set_group_sharing(p_circle uuid, p_mode text) returns void
language sql security invoker set search_path = '' as $$ select private.set_group_sharing(p_circle, p_mode) $$;
create function public.register_device(p_id uuid, p_kind text, p_label text default '') returns void
language sql security invoker set search_path = '' as $$ select private.register_device(p_id, p_kind, p_label) $$;
create function public.ingest_counter_events(p_device uuid, p_events jsonb) returns jsonb
language sql security invoker set search_path = '' as $$ select private.ingest_counter_events(p_device, p_events) $$;

-- Droits : les fonctions internes (hit, b64url, can_*_topic, broadcast) ne sont pas appelables
-- directement ; seules les fonctions métier le sont, via les enveloppes publiques.
revoke all on function private.hit(text, int, int), private.b64url(bytea), private.broadcast_goal_total()
  from public, anon, authenticated;
revoke all on function private.create_group_invite(uuid, text, int, int), private.preview_group_invite(text),
  private.join_group(text, text, boolean), private.revoke_group_invite(uuid), private.leave_group(uuid),
  private.remove_group_member(uuid, uuid), private.set_group_sharing(uuid, text), private.register_device(uuid, text, text),
  private.ingest_counter_events(uuid, jsonb), private.can_read_goal_topic(text), private.can_join_session_topic(text)
  from public, anon;
grant execute on function private.create_group_invite(uuid, text, int, int), private.preview_group_invite(text),
  private.join_group(text, text, boolean), private.revoke_group_invite(uuid), private.leave_group(uuid),
  private.remove_group_member(uuid, uuid), private.set_group_sharing(uuid, text), private.register_device(uuid, text, text),
  private.ingest_counter_events(uuid, jsonb), private.can_read_goal_topic(text), private.can_join_session_topic(text)
  to authenticated;
revoke execute on function public.create_group_invite(uuid, text, int, int), public.preview_group_invite(text),
  public.join_group(text, text, boolean), public.revoke_group_invite(uuid), public.leave_group(uuid),
  public.remove_group_member(uuid, uuid), public.set_group_sharing(uuid, text), public.register_device(uuid, text, text),
  public.ingest_counter_events(uuid, jsonb) from public, anon;
grant execute on function public.create_group_invite(uuid, text, int, int), public.preview_group_invite(text),
  public.join_group(text, text, boolean), public.revoke_group_invite(uuid), public.leave_group(uuid),
  public.remove_group_member(uuid, uuid), public.set_group_sharing(uuid, text), public.register_device(uuid, text, text),
  public.ingest_counter_events(uuid, jsonb) to authenticated;

-- Séances programmées : changements visibles en direct pour les membres (filtré par RLS).
alter publication supabase_realtime add table public.group_planned_sessions;

-- ---------------------------------------------------------------- Maintenance (à activer après application)
-- Nécessite l'extension pg_cron (Dashboard > Integrations > Cron). Purge quotidienne :
-- select cron.schedule('zikru-purge-rate-limits', '17 3 * * *', $c$
--   delete from private.rate_limits where window_start < now() - interval '2 days';
--   delete from private.counter_minute where minute < now() - interval '31 days';
--   delete from public.group_invites where expires_at < now() - interval '30 days';
-- $c$);
