-- Tests P1a — droits gratuit/premium et limite de membres (SQL pur, ASSERT plpgsql).
-- Lancer : voir docs/entitlements/README.md (base PGlite neuve, migrations existantes + P1a + P1).
-- Personnes : O = propriétaire gratuit, M2…M6 = membres, P = propriétaire premium (manuel),
--             Q = « acheteur » storekit (inerte tant que les paiements sont désactivés).

create schema tests;
grant usage on schema tests to authenticated;
create table tests.ctx (k text primary key, v text not null);
grant select, insert, update on tests.ctx to authenticated;
create function tests.get(key text) returns text language sql stable as $$ select v from tests.ctx where k = key $$;
-- Renvoie le SQLSTATE levé par la requête (ou 'ok').
create function tests.state(q text) returns text language plpgsql as $$
begin execute q; return 'ok';
exception when others then return sqlstate; end $$;
create function tests.as_user(u text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', u)::text, false) $$;
create function tests.join(u text, name text) returns text language plpgsql as $$
begin
  perform tests.as_user(u);
  return tests.state(format('select public.join_group(%L, %L, true)', tests.get('token'), name));
end $$;
create function tests.n(circle text) returns int language sql stable security definer as $$
  select count(*)::int from public.circle_members where circle_id = circle::uuid $$;
grant execute on all functions in schema tests to authenticated;

insert into auth.users (id, raw_user_meta_data) values
  ('00000000-0000-4000-8000-000000000001', '{"display_name":"Omar"}'),
  ('00000000-0000-4000-8000-000000000002', '{"display_name":"Maryam"}'),
  ('00000000-0000-4000-8000-000000000003', '{"display_name":"Moussa"}'),
  ('00000000-0000-4000-8000-000000000004', '{"display_name":"Mariama"}'),
  ('00000000-0000-4000-8000-000000000005', '{"display_name":"Malik"}'),
  ('00000000-0000-4000-8000-000000000006', '{"display_name":"Mounira"}'),
  ('00000000-0000-4000-8000-000000000007', '{"display_name":"Penda"}'),
  ('00000000-0000-4000-8000-000000000008', '{"display_name":"Quentin"}');

-- ===== 1. Plan gratuit : 4 membres créateur inclus
set role authenticated;
select tests.as_user('00000000-0000-4000-8000-000000000001');
insert into tests.ctx select 'g', public.create_circle('Halqa', null, null, 'Omar')::text;
insert into tests.ctx select 'token', token from public.create_group_invite(tests.get('g')::uuid, 'member', 20, 24);
do $$
declare e jsonb := public.get_my_entitlements();
begin
  assert e->>'plan' = 'free', 'plan gratuit par défaut';
  assert (e->'limits'->>'max_group_members_created')::int = 4, 'limite lue sur le serveur : 4';
  assert (e->'limits'->>'bilal_daily_quota')::int = 30, 'quota Bilal gratuit : 30';
  assert (e->>'payments_enabled')::boolean = false, 'paiements désactivés';
  assert e ? 'config_version', 'version de configuration pour le cache client';
  assert (public.group_capacity(tests.get('g')::uuid)->>'limit')::int = 4, 'capacité du groupe : 4';
end $$;
do $$ begin
  assert tests.join('00000000-0000-4000-8000-000000000002', 'Maryam') = 'ok', '2e membre';
  assert tests.join('00000000-0000-4000-8000-000000000003', 'Moussa') = 'ok', '3e membre';
  assert tests.join('00000000-0000-4000-8000-000000000004', 'Mariama') = 'ok', '4e membre accepté (créateur inclus)';
  assert tests.n(tests.get('g')) = 4, '4 membres';
  perform tests.as_user('00000000-0000-4000-8000-000000000005');
  assert (public.preview_group_invite(tests.get('token'))->>'full')::boolean, 'aperçu : groupe complet';
  assert (public.preview_group_invite(tests.get('token'))->>'max_members')::int = 4, 'aperçu : capacité effective';
  assert tests.join('00000000-0000-4000-8000-000000000005', 'Malik') = 'ZKG01', '5e membre refusé avec le code ZKG01';
  assert tests.n(tests.get('g')) = 4, 'toujours 4 membres';
end $$;
-- Le chemin historique (codes d'invitation) est soumis à la même règle.
select tests.as_user('00000000-0000-4000-8000-000000000001');
insert into tests.ctx select 'code', code from public.create_invitation('circle', tests.get('g')::uuid, 'member', 5, 7);
do $$ begin
  perform tests.as_user('00000000-0000-4000-8000-000000000005');
  assert tests.state(format('select public.accept_invitation(%L, %L, true)', tests.get('code'), 'Malik')) = 'ZKG01',
    'accept_invitation : même limite';
  assert (public.preview_invitation(tests.get('code'))->>'full')::boolean, 'aperçu du code : complet';
end $$;

-- ===== 2. Hausse de la limite par app_config, sans nouvelle version de l'app
reset role;
insert into public.app_config (key, value) values ('limits.free.max_group_members_created', '5');
set role authenticated;
do $$ begin
  assert tests.join('00000000-0000-4000-8000-000000000005', 'Malik') = 'ok', '5e membre accepté après hausse (app_config)';
  assert tests.join('00000000-0000-4000-8000-000000000006', 'Mounira') = 'ZKG01', '6e refusé (limite 5)';
  perform tests.as_user('00000000-0000-4000-8000-000000000002');
  assert (public.get_my_entitlements()->'limits'->>'max_group_members_created')::int = 5, 'le client lit la nouvelle limite';
end $$;

-- ===== 3. Antériorité : baisser la limite ne retire personne
reset role;
update public.app_config set value = '3' where key = 'limits.free.max_group_members_created';
set role authenticated;
do $$
declare cap jsonb;
begin
  perform tests.as_user('00000000-0000-4000-8000-000000000001');
  assert tests.n(tests.get('g')) = 5, 'les 5 membres restent';
  cap := public.group_capacity(tests.get('g')::uuid);
  assert (cap->>'over_limit')::boolean and (cap->>'limit')::int = 3, 'groupe signalé au-dessus de la limite';
  assert tests.join('00000000-0000-4000-8000-000000000006', 'Mounira') = 'ZKG01', 'aucune nouvelle entrée';
  perform tests.as_user('00000000-0000-4000-8000-000000000005');
  perform public.leave_group(tests.get('g')::uuid);
  assert tests.join('00000000-0000-4000-8000-000000000006', 'Mounira') = 'ZKG01', 'un départ ne suffit pas : 4 > 3';
  -- Le membre parti ne peut pas revenir non plus : la règle vaut pour toute nouvelle entrée.
end $$;

-- ===== 4. Hausse par plan_limits (sans surcharge) : app_config est prioritaire, plan_limits sert sinon
reset role;
delete from public.app_config where key = 'limits.free.max_group_members_created';
update public.plan_limits set value = '6' where plan_id = 'free' and key = 'max_group_members_created';
set role authenticated;
do $$ begin
  assert tests.join('00000000-0000-4000-8000-000000000006', 'Mounira') = 'ok', 'entrée acceptée après hausse (plan_limits)';
  assert tests.n(tests.get('g')) = 5, '5 membres';
end $$;
reset role;
update public.plan_limits set value = '4' where plan_id = 'free' and key = 'max_group_members_created';
insert into public.app_config (key, value) values ('limits.free.max_group_members_created', '2');
set role authenticated;
do $$ begin
  perform tests.as_user('00000000-0000-4000-8000-000000000001');
  assert (public.group_capacity(tests.get('g')::uuid)->>'limit')::int = 2, 'app_config prime sur plan_limits';
end $$;
reset role;
delete from public.app_config where key = 'limits.free.max_group_members_created';

-- ===== 5. Premium attribué manuellement (seule source active avant les paiements)
insert into public.user_entitlements (user_id, plan_id, source, note)
  values ('00000000-0000-4000-8000-000000000007', 'premium', 'manual', 'test');
set role authenticated;
select tests.as_user('00000000-0000-4000-8000-000000000007');
insert into tests.ctx select 'h', public.create_circle('Grand cercle', null, null, 'Penda')::text;
update tests.ctx set v = (select token from public.create_group_invite(tests.get('h')::uuid, 'member', 20, 24)) where k = 'token';
do $$
declare e jsonb;
begin
  perform tests.as_user('00000000-0000-4000-8000-000000000007');
  e := public.get_my_entitlements();
  assert e->>'plan' = 'premium' and e->>'source' = 'manual', 'premium manuel actif';
  assert jsonb_typeof(e->'limits'->'bilal_daily_quota') = 'null', 'Bilal illimité en premium (null)';
  assert (e->'limits'->>'max_group_members_created')::int = 50, 'grands groupes en premium';
  assert tests.join('00000000-0000-4000-8000-000000000002', 'Maryam') = 'ok', 'premium : 2';
  assert tests.join('00000000-0000-4000-8000-000000000003', 'Moussa') = 'ok', 'premium : 3';
  assert tests.join('00000000-0000-4000-8000-000000000004', 'Mariama') = 'ok', 'premium : 4';
  assert tests.join('00000000-0000-4000-8000-000000000005', 'Malik') = 'ok', 'premium : 5e membre accepté';
  -- Un membre gratuit dans un groupe premium ne « consomme » rien : c'est le plan du propriétaire qui compte.
  perform tests.as_user('00000000-0000-4000-8000-000000000005');
  assert public.get_my_entitlements()->>'plan' = 'free', 'le membre reste gratuit';
end $$;
-- Fin du premium : les 5 membres restent (antériorité), les nouvelles entrées sont refusées.
reset role;
update public.user_entitlements set valid_until = now() - interval '1 second' where user_id = '00000000-0000-4000-8000-000000000007';
set role authenticated;
do $$ begin
  perform tests.as_user('00000000-0000-4000-8000-000000000007');
  assert public.get_my_entitlements()->>'plan' = 'free', 'premium expiré → gratuit';
  assert tests.n(tests.get('h')) = 5, 'personne n''est retiré à l''expiration';
  assert tests.join('00000000-0000-4000-8000-000000000006', 'Mounira') = 'ZKG01', 'nouvelle entrée refusée après expiration';
end $$;

-- ===== 6. Droits de magasin inertes tant que payments_enabled = false
reset role;
insert into public.user_entitlements (user_id, plan_id, source, external_ref)
  values ('00000000-0000-4000-8000-000000000008', 'premium', 'storekit', 'YOUR_ORIGINAL_TRANSACTION_ID');
set role authenticated;
do $$ begin
  perform tests.as_user('00000000-0000-4000-8000-000000000008');
  assert public.get_my_entitlements()->>'plan' = 'free', 'storekit ignoré : paiements désactivés';
end $$;
reset role;
update public.app_config set value = 'true' where key = 'payments_enabled';
set role authenticated;
do $$ begin
  perform tests.as_user('00000000-0000-4000-8000-000000000008');
  assert public.get_my_entitlements()->>'plan' = 'premium', 'storekit pris en compte une fois les paiements activés';
end $$;
reset role;
update public.app_config set value = 'false' where key = 'payments_enabled';

-- ===== 7. Quota Bilal lu dans le plan (même RPC bilal_consume() : la fonction Edge ne change pas)
insert into public.app_config (key, value) values ('limits.free.bilal_daily_quota', '2');
set role authenticated;
do $$ begin
  perform tests.as_user('00000000-0000-4000-8000-000000000003');
  assert public.bilal_consume() = 1, 'quota 2 : reste 1';
  assert public.bilal_consume() = 0, 'reste 0';
  assert public.bilal_consume() = -1, 'épuisé : -1 → la fonction Edge répond 429';
  perform tests.as_user('00000000-0000-4000-8000-000000000008');
  assert public.bilal_consume() = 1, 'storekit inerte : quota gratuit';
end $$;
reset role;
insert into public.user_entitlements (user_id, plan_id, source, valid_until)
  values ('00000000-0000-4000-8000-000000000003', 'premium', 'promo', now() + interval '30 days');
set role authenticated;
do $$ begin
  perform tests.as_user('00000000-0000-4000-8000-000000000003');
  assert public.bilal_consume() > 1000000, 'promo premium : illimité';
end $$;

-- ===== 8. Nombre de groupes créés, lu dans le plan
reset role;
insert into public.app_config (key, value) values ('limits.free.max_groups_created', '1');
set role authenticated;
do $$ begin
  perform tests.as_user('00000000-0000-4000-8000-000000000001');
  assert tests.state($q$select public.create_circle('Deuxième', null, null, 'Omar')$q$) = 'ZKG02', '2e groupe refusé (limite 1)';
end $$;

-- ===== 9. Cloisonnement
do $$ begin
  perform tests.as_user('00000000-0000-4000-8000-000000000001');
  assert tests.state('select * from public.app_config') = '42501', 'app_config illisible par les clients';
  assert tests.state($q$insert into public.user_entitlements (user_id, plan_id, source) values (auth.uid(), 'premium', 'manual')$q$) = '42501',
    'impossible de s''attribuer premium';
  assert tests.state($q$update public.plan_limits set value = '999'$q$) = '42501', 'impossible de modifier les limites';
  assert (select count(*) from public.user_entitlements) = 0, 'Omar ne voit pas les droits des autres';
  assert (select count(*) from public.plans) = 2, 'plans lisibles';
  assert tests.state('select private.group_member_cap(gen_random_uuid())') = '42501', 'fonctions internes non exposées';
  assert tests.state(format('select public.group_capacity(%L)', tests.get('h'))) = '42501', 'capacité réservée aux membres';
end $$;
reset role;
select 'P1a : tous les tests passent' as resultat;
