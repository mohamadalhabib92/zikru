-- Import d'un programme dans un groupe (sans migration) : vérifie que les règles EXISTANTES suffisent.
-- Un objectif par étape, identifiant choisi par l'app (idempotence : un renvoi lève 23505, jamais de doublon).
-- Personnes : P parent, A adulte, G invité, K enfant (famille) ; F fondateur, X membre (cercle).
create schema tests;
grant usage on schema tests to authenticated;
create table tests.ctx (k text primary key, v text not null);
grant select, insert, update, delete on tests.ctx to authenticated;
create function tests.state(q text) returns text language plpgsql as $$
begin execute q; return 'ok';
exception when others then return sqlstate; end $$;
create function tests.get(key text) returns text language sql stable as $$ select v from tests.ctx where k = key $$;
create function tests.as_user(u text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', (select v from tests.ctx where k = 'u_' || u))::text, false) $$;
create function tests.goal(scope text, gid text, uid text, title text) returns text language sql as $$
  select format('insert into public.shared_goals (id, scope_type, %s, created_by, title, formula, target) values (%L, %L, %L, %L, %L, %L, 33)',
    case scope when 'family' then 'family_id' else 'circle_id' end, gid, scope, tests.get(case scope when 'family' then 'fam' else 'cir' end), uid, title, 'سبحان الله') $$;
grant execute on all functions in schema tests to authenticated;

insert into tests.ctx (k, v) values
  ('u_P', '10000000-0000-4000-8000-000000000001'), ('u_A', '10000000-0000-4000-8000-000000000002'),
  ('u_G', '10000000-0000-4000-8000-000000000003'), ('u_K', '10000000-0000-4000-8000-000000000004'),
  ('u_F', '20000000-0000-4000-8000-000000000001'), ('u_X', '20000000-0000-4000-8000-000000000003');
insert into auth.users (id, raw_user_meta_data) select v::uuid, jsonb_build_object('display_name', substr(k, 3)) from tests.ctx where k like 'u\_%';

set role authenticated;
select tests.as_user('P');
insert into tests.ctx select 'fam', public.create_family('Famille test', 'Papa')::text;
insert into tests.ctx select 'inv_k', code from public.create_invitation('family', tests.get('fam')::uuid, 'child', 1, 7);
insert into tests.ctx select 'inv_a', code from public.create_invitation('family', tests.get('fam')::uuid, 'adult', 1, 7);
insert into tests.ctx select 'inv_g', code from public.create_invitation('family', tests.get('fam')::uuid, 'guest', 1, 7);
select tests.as_user('K'); select public.accept_invitation(tests.get('inv_k'), 'Kadi', false);
select tests.as_user('A'); select public.accept_invitation(tests.get('inv_a'), 'Tata', false);
select tests.as_user('G'); select public.accept_invitation(tests.get('inv_g'), 'Voisin', false);
select tests.as_user('F');
insert into tests.ctx select 'cir', public.create_circle('Cercle test', '', 'Règles test', 'Fondateur')::text;
insert into tests.ctx select 'inv_x', code from public.create_invitation('circle', tests.get('cir')::uuid, 'member', 1, 7);
select tests.as_user('X'); select public.accept_invitation(tests.get('inv_x'), 'Xavier', true);
do $$ begin assert private.is_circle_member(tests.get('cir')::uuid), 'X est membre du cercle'; end $$;

do $$ begin
  -- Famille : parent et adulte peuvent ajouter les étapes ; invité et enfant non.
  perform tests.as_user('P');
  assert tests.state(tests.goal('family', 'a0000000-0000-4000-8000-000000000001', tests.get('u_P'), '1. Formule test')) = 'ok', 'parent : étape ajoutée';
  assert tests.state(tests.goal('family', 'a0000000-0000-4000-8000-000000000001', tests.get('u_P'), '1. Formule test')) = '23505', 'renvoi du même lot : refusé (pas de doublon)';
  perform tests.as_user('A');
  assert tests.state(tests.goal('family', 'a0000000-0000-4000-8000-000000000002', tests.get('u_A'), '2. Formule test')) = 'ok', 'adulte : étape ajoutée';
  assert tests.state(tests.goal('family', 'a0000000-0000-4000-8000-000000000003', tests.get('u_P'), 'usurpation')) = '42501', 'created_by doit être soi';
  perform tests.as_user('G');
  assert tests.state(tests.goal('family', 'a0000000-0000-4000-8000-000000000004', tests.get('u_G'), 'x')) = '42501', 'invité : refusé';
  assert (select count(*) from public.shared_goals where family_id = tests.get('fam')::uuid) = 2, 'les membres voient les étapes';
  perform tests.as_user('K');
  assert tests.state(tests.goal('family', 'a0000000-0000-4000-8000-000000000005', tests.get('u_K'), 'x')) = '42501', 'enfant : refusé';
  -- Wird familial : seul un parent le modifie.
  perform tests.as_user('A');
  update public.families set wird = 'Programme test : 1. Formule test × 33' where id = tests.get('fam')::uuid;
  perform tests.as_user('P');
  assert (select wird from public.families where id = tests.get('fam')::uuid) is null, 'adulte : wird inchangé';
  update public.families set wird = 'Programme test : 1. Formule test × 33' where id = tests.get('fam')::uuid;
  assert (select wird from public.families where id = tests.get('fam')::uuid) = 'Programme test : 1. Formule test × 33', 'parent : wird mis à jour';
  assert tests.state(format('update public.families set wird = %L where id = %L', repeat('x', 501), tests.get('fam'))) = '23514', 'wird > 500 refusé';
  -- Cercle : fondateur oui, membre non ; hors groupe : refusé.
  perform tests.as_user('F');
  assert tests.state(tests.goal('circle', 'b0000000-0000-4000-8000-000000000001', tests.get('u_F'), '1. Formule test')) = 'ok', 'fondateur : étape ajoutée';
  perform tests.as_user('X');
  assert tests.state(tests.goal('circle', 'b0000000-0000-4000-8000-000000000002', tests.get('u_X'), 'x')) = '42501', 'membre de cercle : refusé';
  assert tests.state(tests.goal('family', 'b0000000-0000-4000-8000-000000000003', tests.get('u_X'), 'x')) = '42501', 'hors famille : refusé';
  -- Limites du schéma (le client coupe avant et prévient) : titre ≤ 80, formule ≤ 200.
  perform tests.as_user('F');
  assert tests.state(tests.goal('circle', 'b0000000-0000-4000-8000-000000000004', tests.get('u_F'), repeat('x', 81))) = '23514', 'titre > 80 refusé';
end $$;
reset role;
