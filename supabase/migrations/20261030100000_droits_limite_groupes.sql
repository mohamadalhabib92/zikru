-- Droits gratuit / premium côté serveur + limite « 4 personnes » des groupes gratuits (créateur inclus).
-- Décision du 30.10.2026 : version gratuite = 4 personnes par groupe (cercle), dès le lancement.
-- Repris tel quel de docs/entitlements/sql/20261029110000_p1a_droits.sql (brouillon testé).
-- Dépend de : 20261027220000_communautes_famille_proches.sql, 20261027230000_bilal_usage_quota.sql.
-- La limite se change sans publier l'app : update public.plan_limits ... ou app_config 'limits.free.max_group_members_created'.
--
-- Principes :
--  * Zikru est gratuite. Aucun paiement n'est actif : les droits issus de 'storekit' / 'play' restent
--    inertes tant que app_config.payments_enabled = false. Seuls 'manual' et 'promo' comptent.
--  * Toutes les limites vivent dans la base (plan_limits + app_config). On les change sans publier l'app.
--  * Valeur JSON null = illimité. Clé absente = valeur du plan par défaut (free).
--  * Antériorité (grandfathering) : une limite n'est vérifiée qu'à l'entrée d'un nouveau membre.
--    Baisser une limite ne retire jamais personne ; seules les nouvelles entrées sont refusées.
--  * Code d'erreur stable « groupe complet » : SQLSTATE ZKG01 (le client ne parse pas le message).

-- ===== Tables
create table public.plans (
  id text primary key check (id ~ '^[a-z][a-z0-9_]{1,30}$'),
  name text not null,
  rank int not null unique,                 -- le plan actif de rang le plus élevé gagne
  is_default boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index plans_one_default on public.plans (is_default) where is_default;

create table public.plan_limits (
  plan_id text not null references public.plans(id) on delete cascade,
  key text not null check (key ~ '^[a-z][a-z0-9_]{1,60}$'),
  value jsonb not null,                     -- nombre, booléen, ou null (= illimité)
  updated_at timestamptz not null default now(),
  primary key (plan_id, key)
);

-- Réglages globaux. Les surcharges de limites suivent la convention 'limits.<plan>.<clé>'.
create table public.app_config (
  key text primary key check (char_length(key) between 1 and 120),
  value jsonb not null,
  description text,
  updated_at timestamptz not null default now()
);

create table public.user_entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,   -- suit delete_my_account
  plan_id text not null references public.plans(id),
  source text not null check (source in ('manual', 'storekit', 'play', 'promo')),
  external_ref text check (char_length(external_ref) <= 200),         -- futur : originalTransactionId / hash du purchaseToken
  valid_from timestamptz not null default now(),
  valid_until timestamptz,                                             -- null = sans échéance
  revoked_at timestamptz,
  note text check (char_length(note) <= 500),
  created_at timestamptz not null default now(),
  unique (source, external_ref)
);
create index user_entitlements_user_idx on public.user_entitlements (user_id);

create or replace function private.touch_cfg() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;
create trigger plan_limits_touch before update on public.plan_limits for each row execute function private.touch_cfg();
create trigger app_config_touch before update on public.app_config for each row execute function private.touch_cfg();

-- ===== Données initiales (décision du 29.10.2026)
insert into public.plans (id, name, rank, is_default) values ('free', 'Gratuit', 0, true), ('premium', 'Premium', 10, false);
insert into public.plan_limits (plan_id, key, value) values
  ('free',    'max_group_members_created', '4'),     -- créateur inclus
  ('free',    'max_groups_created',        '20'),    -- reprend la limite anti-abus existante
  ('free',    'bilal_daily_quota',         '30'),    -- reprend le quota existant (jour UTC)
  ('free',    'advanced_admin_tools',      'false'),
  ('free',    'detailed_stats',            'false'),
  ('free',    'themes',                    'false'),
  ('premium', 'max_group_members_created', '50'),    -- provisoire : « grands groupes », à fixer avant le lancement premium
  ('premium', 'max_groups_created',        '50'),
  ('premium', 'bilal_daily_quota',         'null'),  -- illimité (sous réserve d'un garde-fou de coût, cf. doc)
  ('premium', 'advanced_admin_tools',      'true'),
  ('premium', 'detailed_stats',            'true'),
  ('premium', 'themes',                    'true');
insert into public.app_config (key, value, description) values
  ('payments_enabled', 'false', 'Tant que false, les droits storekit/play sont ignorés. Aucun paiement actif.'),
  ('max_group_members_hard', '500', 'Plafond technique absolu (temps réel, MLS), quel que soit le plan.');

-- ===== Droits d'accès : lecture des plans publique pour les comptes connectés ; app_config non exposée.
alter table public.plans enable row level security;
alter table public.plan_limits enable row level security;
alter table public.app_config enable row level security;
alter table public.user_entitlements enable row level security;
revoke all on public.plans, public.plan_limits, public.app_config, public.user_entitlements from anon, authenticated;
create policy plans_read on public.plans for select to authenticated using (true);
create policy plan_limits_read on public.plan_limits for select to authenticated using (true);
create policy user_entitlements_read_own on public.user_entitlements for select to authenticated using (user_id = (select auth.uid()));
grant select on public.plans, public.plan_limits, public.user_entitlements to authenticated;
-- Aucune écriture côté client : les droits sont posés par l'admin (SQL) ou, plus tard, par les webhooks
-- App Store Server Notifications / Play RTDN exécutés côté serveur.

-- ===== Résolution des droits
create or replace function private.config(p_key text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select value from public.app_config where key = p_key $$;

create or replace function private.effective_entitlement(p_user uuid)
returns table (plan_id text, source text, valid_until timestamptz)
language sql stable security definer set search_path = '' as $$
  select e.plan_id, e.source, e.valid_until
  from public.user_entitlements e join public.plans p on p.id = e.plan_id
  where e.user_id = p_user and e.revoked_at is null and p.active
    and e.valid_from <= now() and (e.valid_until is null or e.valid_until > now())
    and (e.source in ('manual', 'promo') or coalesce((private.config('payments_enabled'))::text = 'true', false))
  order by p.rank desc, e.valid_until desc nulls first
  limit 1 $$;

create or replace function private.effective_plan(p_user uuid) returns text
language sql stable security definer set search_path = '' as $$
  select coalesce((select plan_id from private.effective_entitlement(p_user)),
                  (select id from public.plans where is_default), 'free') $$;

-- Valeur d'une limite pour un plan : surcharge app_config > plan_limits du plan > plan par défaut.
-- Retourne NULL SQL si la clé n'existe nulle part, et 'null'::jsonb si elle vaut « illimité ».
create or replace function private.plan_limit(p_plan text, p_key text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v jsonb;
begin
  select value into v from public.app_config where key = 'limits.' || p_plan || '.' || p_key;
  if found then return v; end if;
  select value into v from public.plan_limits where plan_id = p_plan and key = p_key;
  if found then return v; end if;
  select l.value into v from public.plan_limits l join public.plans p on p.id = l.plan_id where p.is_default and l.key = p_key;
  if found then return v; end if;
  return null;
end $$;

-- Limite entière d'un utilisateur. NULL = illimité. p_missing sert seulement si la clé n'existe nulle part.
create or replace function private.user_limit_int(p_user uuid, p_key text, p_missing int) returns int
language plpgsql stable security definer set search_path = '' as $$
declare v jsonb := private.plan_limit(private.effective_plan(p_user), p_key);
begin
  if v is null then return p_missing; end if;
  if jsonb_typeof(v) = 'null' then return null; end if;
  return (v #>> '{}')::int;
end $$;

-- Capacité effective d'un groupe = limite du plan de son propriétaire (fondateur actuel, sinon créateur),
-- bornée par circles.max_members si le fondateur l'a réduite, et par le plafond technique.
create or replace function private.group_member_cap(p_circle uuid) returns int
language plpgsql stable security definer set search_path = '' as $$
declare owner uuid; own_cap int; c public.circles; hard int;
begin
  select * into c from public.circles where id = p_circle;
  if not found then return 0; end if;
  select user_id into owner from public.circle_members where circle_id = p_circle and role = 'founder' order by joined_at limit 1;
  owner := coalesce(owner, c.created_by);
  own_cap := private.user_limit_int(owner, 'max_group_members_created', 2);  -- 2 : repli prudent si la config manque
  hard := coalesce((private.config('max_group_members_hard') #>> '{}')::int, 500);
  return least(coalesce(own_cap, hard), coalesce(c.max_members, hard), hard);
end $$;

-- ===== circles.max_members devient une réduction facultative (null = le plan décide).
-- Toutes les lignes existantes ont la valeur par défaut 50 (create_circle ne la fixait pas).
alter table public.circles drop constraint if exists circles_max_members_check;
alter table public.circles alter column max_members drop not null, alter column max_members drop default;
update public.circles set max_members = null where max_members = 50;
alter table public.circles add constraint circles_max_members_check check (max_members is null or max_members between 2 and 10000);

-- ===== Application de la limite : à l'insertion seulement (antériorité), ligne du groupe verrouillée.
-- Couvre tous les chemins d'entrée : accept_invitation (codes), join_group (liens P1), create_circle.
create or replace function private.circle_members_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare cap int; n int;
begin
  -- Verrou : deux entrées simultanées sur la dernière place sont sérialisées ; la seconde recompte
  -- (READ COMMITTED : nouvel instantané à l'instruction suivante) et voit la première.
  perform 1 from public.circles where id = new.circle_id for update;
  cap := private.group_member_cap(new.circle_id);
  select count(*) into n from public.circle_members where circle_id = new.circle_id;
  if n >= cap then
    raise exception 'Ce groupe est complet (% membres maximum, créateur inclus)', cap
      using errcode = 'ZKG01',
            detail = jsonb_build_object('reason', 'group_full', 'limit_key', 'max_group_members_created', 'limit', cap, 'members', n)::text,
            hint = 'Le propriétaire du groupe peut retirer un membre, ou la limite pourra évoluer.';
  end if;
  if private.is_minor(new.user_id) then
    raise exception 'Les comptes enfants restent dans leur famille' using errcode = 'check_violation';
  end if;
  return new;
end $$;

-- Nombre de groupes créés : lu dans le plan (remplace la constante 20).
create or replace function private.create_circle(p_name text, p_description text, p_rules text, p_display_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare me uuid := (select auth.uid()); cid uuid; lim int;
begin
  if me is null then raise exception 'Connexion requise' using errcode = '42501'; end if;
  if private.is_minor(me) then raise exception 'Les comptes enfants restent dans leur famille' using errcode = '42501'; end if;
  lim := private.user_limit_int(me, 'max_groups_created', 20);
  if lim is not null and (select count(*) from public.circles where created_by = me) >= lim then
    raise exception 'Limite de % groupes créés atteinte', lim using errcode = 'ZKG02',
      detail = jsonb_build_object('reason', 'groups_created_limit', 'limit_key', 'max_groups_created', 'limit', lim)::text; end if;
  insert into public.circles (name, description, rules, created_by)
    values (trim(p_name), nullif(trim(p_description), ''), nullif(trim(p_rules), ''), me) returning id into cid;
  insert into public.circle_members (circle_id, user_id, display_name, role, rules_accepted_at) values (cid, me, trim(p_display_name), 'founder', now());
  insert into public.sharing_preferences (user_id, scope_type, circle_id, mode) values (me, 'circle', cid, 'participation');
  return cid;
end $$;

-- Aperçu d'invitation (codes existants) : capacité effective + indicateur « complet ».
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
    select c.name, c.rules into n, rules from public.circles c where id = i.circle_id;
    select count(*) into cnt from public.circle_members where circle_id = i.circle_id;
    cap := private.group_member_cap(i.circle_id);
  end if;
  return jsonb_build_object('valid', true, 'scope_type', i.scope_type, 'name', n, 'role', i.role,
    'rules', rules, 'members', cnt, 'max_members', cap, 'full', cap is not null and cnt >= cap, 'expires_at', i.expires_at);
end $$;

-- Capacité d'un groupe, pour ses membres (affichage « 3 / 4 », bouton d'invitation).
create or replace function private.group_capacity(p_circle uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare cap int; n int;
begin
  if not private.is_circle_member(p_circle) then raise exception 'Réservé aux membres du groupe' using errcode = '42501'; end if;
  cap := private.group_member_cap(p_circle);
  select count(*) into n from public.circle_members where circle_id = p_circle;
  return jsonb_build_object('limit', cap, 'members', n, 'full', n >= cap, 'over_limit', n > cap);
end $$;

-- Mes droits effectifs (le client les met en cache ; le serveur reste seul juge).
create or replace function private.get_my_entitlements() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare me uuid := (select auth.uid()); e record; p text; lim jsonb;
begin
  if me is null then raise exception 'Connexion requise' using errcode = '42501'; end if;
  select * into e from private.effective_entitlement(me);
  p := private.effective_plan(me);
  select coalesce(jsonb_object_agg(k, private.plan_limit(p, k)), '{}'::jsonb) into lim
    from (select distinct key as k from public.plan_limits) keys;
  return jsonb_build_object(
    'plan', p,
    'source', e.source,
    'valid_until', e.valid_until,
    'payments_enabled', coalesce((private.config('payments_enabled'))::text = 'true', false),
    'limits', lim,
    'config_version', (select extract(epoch from greatest(
        (select max(updated_at) from public.plan_limits), (select max(updated_at) from public.app_config)))::bigint),
    'server_time', now());
end $$;

-- El Ghaly Bilal : quota quotidien lu dans le plan. null = illimité (renvoie un grand nombre pour garder
-- le contrat de la fonction Edge actuelle : < 0 = quota épuisé). La fonction Edge n'a pas à changer.
create or replace function private.bilal_consume_plan() returns int
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); q int; c int;
begin
  if uid is null then raise exception 'auth required' using errcode = '28000'; end if;
  q := private.user_limit_int(uid, 'bilal_daily_quota', 30);
  insert into public.bilal_usage(user_id, day, count) values (uid, (now() at time zone 'utc')::date, 1)
  on conflict (user_id, day) do update set count = public.bilal_usage.count + 1
  returning count into c;
  delete from public.bilal_usage where user_id = uid and day < (now() at time zone 'utc')::date - 7;
  if q is null then return 2147483647; end if;
  return greatest(q - c, -1);
end $$;

-- ===== Façades publiques (SECURITY INVOKER) et droits d'exécution
create or replace function public.get_my_entitlements() returns jsonb
language sql stable security invoker set search_path = '' as $$ select private.get_my_entitlements() $$;
create or replace function public.group_capacity(p_circle uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$ select private.group_capacity(p_circle) $$;
create or replace function public.bilal_consume() returns int
language sql security invoker set search_path = '' as $$ select private.bilal_consume_plan() $$;

revoke all on function private.config(text), private.effective_entitlement(uuid), private.effective_plan(uuid),
  private.plan_limit(text, text), private.user_limit_int(uuid, text, int), private.group_member_cap(uuid),
  private.group_capacity(uuid), private.get_my_entitlements(), private.bilal_consume_plan(), private.touch_cfg()
  from public, anon;
grant execute on function private.group_capacity(uuid), private.get_my_entitlements(), private.bilal_consume_plan()
  to authenticated;
revoke all on function public.get_my_entitlements(), public.group_capacity(uuid), public.bilal_consume() from public, anon;
grant execute on function public.get_my_entitlements(), public.group_capacity(uuid), public.bilal_consume() to authenticated;
