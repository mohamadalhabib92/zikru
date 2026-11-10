-- Premium à vie : création de zikrs personnels (locale, non couverte ici) et création de groupes.
-- NON APPLIQUÉE au projet Supabase hébergé. Ne pas lancer ce fichier sur la production.
-- Aucune ligne de zikr, de famille, de cercle ou de compteur n’est supprimée ni réécrite.
--
-- Le verrou serveur est COUPÉ par défaut (app_config.premium_creation_gate = false).
-- L’app refuse déjà la création côté client. Le serveur ne bloque qu’après :
--   update public.app_config set value = 'true' where key = 'premium_creation_gate';
-- et seulement quand un achat vérifié peut écrire user_entitlements (clé App Store côté serveur,
-- jamais dans l’app). Tant que payments_enabled reste false, une ligne source 'storekit' ne compte pas.
-- L’antériorité (source 'grandfather') compte tout de suite, même si le verrou est encore coupé.

-- Le plan « lifetime » ne reprend pas les anciens bonus (50 membres, Bilal illimité).
-- Les autres limites retombent sur le plan gratuit. Le plan « premium » manuel existant reste au-dessus.
insert into public.plans (id, name, rank, is_default)
values ('lifetime', 'Premium à vie', 5, false)
on conflict (id) do nothing;

insert into public.plan_limits (plan_id, key, value) values
  ('free', 'can_create_groups', 'false'),
  ('lifetime', 'can_create_groups', 'true'),
  ('premium', 'can_create_groups', 'true')
on conflict (plan_id, key) do nothing;

insert into public.app_config (key, value, description) values
  ('premium_creation_gate', 'false', 'Tant que false, create_family / create_circle / create_group_program ne vérifient pas Premium. Le client applique le verrou. Passer à true seulement quand les achats vérifiés écrivent user_entitlements.'),
  ('premium_product_id', '"com.vibecode.zikru-76mpdv.premium.lifetime"', 'Identifiant d’achat unique, aligné sur le bundle iOS com.vibecode.zikru-76mpdv.')
on conflict (key) do nothing;

alter table public.user_entitlements drop constraint if exists user_entitlements_source_check;
alter table public.user_entitlements add constraint user_entitlements_source_check
  check (source in ('manual', 'storekit', 'play', 'promo', 'grandfather'));

-- storekit / play restent ignorés tant que payments_enabled = false. grandfather compte toujours.
create or replace function private.effective_entitlement(p_user uuid)
returns table (plan_id text, source text, valid_until timestamptz)
language sql stable security definer set search_path = '' as $$
  select e.plan_id, e.source, e.valid_until
  from public.user_entitlements e join public.plans p on p.id = e.plan_id
  where e.user_id = p_user and e.revoked_at is null and p.active
    and e.valid_from <= now() and (e.valid_until is null or e.valid_until > now())
    and (e.source in ('manual', 'promo', 'grandfather') or coalesce((private.config('payments_enabled'))::text = 'true', false))
  order by p.rank desc, e.valid_until desc nulls first
  limit 1 $$;

create or replace function private.may_create_groups(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(private.plan_limit(private.effective_plan(p_user), 'can_create_groups') = 'true'::jsonb, false) $$;

create or replace function private.assert_may_create_group() returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := (select auth.uid());
begin
  if not coalesce(private.config('premium_creation_gate') = 'true'::jsonb, false) then return; end if;
  if me is not null and private.may_create_groups(me) then return; end if;
  raise exception 'Créer un groupe est réservé à Zikru Premium' using errcode = 'ZKP01',
    detail = jsonb_build_object('reason', 'premium_required', 'product', 'com.vibecode.zikru-76mpdv.premium.lifetime')::text;
end $$;

-- Antériorité : qui avait déjà créé une famille, un cercle ou un programme. N’altère pas ces lignes.
insert into public.user_entitlements (user_id, plan_id, source, external_ref, note)
select distinct s.u, 'lifetime', 'grandfather', 'grandfather:' || s.u::text,
  'Antériorité : création déjà faite avant Premium. Aucune donnée de groupe n’est réécrite.'
from (
  select created_by as u from public.families where created_by is not null
  union
  select created_by from public.circles where created_by is not null
  union
  select created_by from public.group_programs where created_by is not null
) s
where s.u is not null
on conflict (source, external_ref) do nothing;

create or replace function private.create_family(p_name text, p_display_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare me uuid := (select auth.uid()); fid uuid;
begin
  if me is null then raise exception 'Connexion requise' using errcode = '42501'; end if;
  if private.is_minor(me) then raise exception 'Un compte enfant ne peut pas créer de famille' using errcode = '42501'; end if;
  perform private.assert_may_create_group();
  if (select count(*) from public.family_members where user_id = me) >= 10 then
    raise exception 'Limite de 10 familles atteinte' using errcode = 'check_violation'; end if;
  insert into public.families (name, created_by) values (trim(p_name), me) returning id into fid;
  insert into public.family_members (family_id, user_id, display_name, role) values (fid, me, trim(p_display_name), 'parent');
  insert into public.sharing_preferences (user_id, scope_type, family_id, mode) values (me, 'family', fid, 'counter');
  return fid;
end $$;

create or replace function private.create_circle(p_name text, p_description text, p_rules text, p_display_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare me uuid := (select auth.uid()); cid uuid; lim int;
begin
  if me is null then raise exception 'Connexion requise' using errcode = '42501'; end if;
  if private.is_minor(me) then raise exception 'Les comptes enfants restent dans leur famille' using errcode = '42501'; end if;
  perform private.assert_may_create_group();
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

-- Le renvoi du même identifiant (coupure réseau) ne redemande pas Premium et ne duplique pas le programme.
create or replace function public.create_group_program(p_id uuid, p_scope text, p_scope_id uuid, p_title text,
  p_steps jsonb, p_description text default null, p_source_note text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := (select auth.uid()); fid uuid; cid uuid; g public.group_programs;
begin
  if p_scope not in ('family','circle') then raise exception 'Groupe invalide' using errcode = '22023'; end if;
  fid := case when p_scope = 'family' then p_scope_id end;
  cid := case when p_scope = 'circle' then p_scope_id end;
  perform private.program_admin_check(p_scope, fid, cid);
  select * into g from public.group_programs where id = p_id;
  if found then
    if g.created_by is distinct from me or g.scope_type <> p_scope or coalesce(g.family_id, g.circle_id) <> p_scope_id then
      raise exception 'Identifiant déjà utilisé' using errcode = '23505'; end if;
    return jsonb_build_object('id', g.id, 'created', false, 'version', g.version);
  end if;
  perform private.assert_may_create_group();
  perform private.rate_hit('group_program', 20, 3600);
  insert into public.group_programs (id, scope_type, family_id, circle_id, title, description, source_note, created_by)
    values (p_id, p_scope, fid, cid, trim(p_title), nullif(trim(p_description), ''), nullif(trim(p_source_note), ''), me);
  perform private.program_insert_steps(p_id, p_steps);
  return jsonb_build_object('id', p_id, 'created', true, 'version', 1);
end $$;
