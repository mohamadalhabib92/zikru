-- Programmes de groupe (migration 20261102152251) : étapes ordonnées, avancée par membre, droits, idempotence,
-- mineurs, suspension, filtre, version, masquage selon les préférences de partage.
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
reset role;
insert into private.blocked_terms (term) values ('motinterdit');

-- Étapes de test : textes factices (aucun texte religieux inventé).
insert into tests.ctx values ('steps', '[{"label":"Formule test A","arabic":"سبحان الله","translit":"subhana llah","target":3,"verification":"catalogue","source_ref":"Catalogue Zikru"},
  {"label":"Formule test B","arabic":"نص تجريبي","target":2},{"label":"Formule test C","translit":"texte test","target":1,"verification":"unverified"}]');
create function tests.mk(pid text, scope text, sid text, title text) returns text language sql as $$
  select format('select public.create_group_program(%L, %L, %L, %L, %L::jsonb)', pid, scope, sid, title, tests.get('steps')) $$;
grant execute on function tests.mk(text, text, text, text) to authenticated;
set role authenticated;

do $$
declare r jsonb; v jsonb; s1 uuid; s2 uuid;
begin
  -- Création : parent, idempotente.
  perform tests.as_user('P');
  r := public.create_group_program('c0000000-0000-4000-8000-000000000001', 'family', tests.get('fam')::uuid, 'Programme test', tests.get('steps')::jsonb);
  assert (r ->> 'created')::boolean, 'parent : programme créé';
  r := public.create_group_program('c0000000-0000-4000-8000-000000000001', 'family', tests.get('fam')::uuid, 'Programme test', tests.get('steps')::jsonb);
  assert not (r ->> 'created')::boolean, 'renvoi : même programme, pas de doublon';
  assert (select count(*) from public.group_programs) = 1 and (select count(*) from public.group_program_steps) = 3, '1 programme, 3 étapes';
  assert (select string_agg(label, '|' order by position) from public.group_program_steps) = 'Formule test A|Formule test B|Formule test C', 'ordre des étapes conservé';
  assert (select arabic from public.group_program_steps where position = 1) = 'سبحان الله', 'texte arabe intact';
  assert (select verification from public.group_program_steps where position = 2) = 'unverified', 'non vérifié par défaut';
  assert tests.state('insert into public.group_programs (id, scope_type, family_id, title) values (gen_random_uuid(), ''family'', ''' || tests.get('fam') || ''', ''x'')') = '42501', 'écriture directe interdite';
  assert tests.state('update public.group_program_steps set label = ''x''') = '42501', 'modification directe interdite';
  assert tests.state(format('select public.create_group_program(gen_random_uuid(), %L, %L, %L, %L::jsonb)', 'family', tests.get('fam'), 'x', '[{"label":"x","target":1,"verification":"validé"}]')) = '23514', 'statut « validé » impossible';
  assert tests.state(format('select public.create_group_program(gen_random_uuid(), %L, %L, %L, %L::jsonb)', 'family', tests.get('fam'), 'x', '[]')) = '22023', 'au moins une étape';
  assert tests.state(format('select public.create_group_program(gen_random_uuid(), %L, %L, %L, %L::jsonb)', 'family', tests.get('fam'), 'x', '[{"label":"motinterdit","target":1}]')) = 'ZKF01', 'filtre de termes';
  assert (select count(*) from public.group_programs) = 1, 'aucun programme partiel après un refus';
  -- Rôles.
  perform tests.as_user('A');
  assert tests.state(tests.mk('c0000000-0000-4000-8000-000000000002', 'family', tests.get('fam'), 'Programme adulte')) = 'ok', 'adulte : autorisé';
  assert tests.state(tests.mk('c0000000-0000-4000-8000-000000000001', 'family', tests.get('fam'), 'Programme test')) = '23505', 'identifiant d''un autre : refusé';
  perform tests.as_user('G');
  assert tests.state(tests.mk('c0000000-0000-4000-8000-000000000003', 'family', tests.get('fam'), 'x')) = '42501', 'invité : refusé';
  assert (select count(*) from public.group_programs) = 2, 'invité : voit les programmes';
  perform tests.as_user('K');
  assert tests.state(tests.mk('c0000000-0000-4000-8000-000000000004', 'family', tests.get('fam'), 'x')) = '42501', 'enfant : refusé';
  perform tests.as_user('X');
  assert tests.state(tests.mk('c0000000-0000-4000-8000-000000000005', 'circle', tests.get('cir'), 'x')) = '42501', 'membre de cercle : refusé';
  assert tests.state(tests.mk('c0000000-0000-4000-8000-000000000006', 'family', tests.get('fam'), 'x')) = '42501', 'hors groupe : refusé';
  assert (select count(*) from public.group_programs) = 0, 'hors groupe : ne voit rien';
  assert tests.state('select public.group_program_view(''c0000000-0000-4000-8000-000000000001'')') = 'P0002', 'hors groupe : vue refusée';
  perform tests.as_user('F');
  assert tests.state(tests.mk('c0000000-0000-4000-8000-000000000007', 'circle', tests.get('cir'), 'Programme cercle')) = 'ok', 'fondateur : autorisé';
end $$;

-- Suspension : plus de création ni de modification.
reset role;
insert into private.user_suspensions (user_id, reason) values (tests.get('u_P')::uuid, 'test');
set role authenticated;
do $$ begin
  perform tests.as_user('P');
  assert tests.state(tests.mk('c0000000-0000-4000-8000-000000000008', 'family', tests.get('fam'), 'x')) = '42501', 'suspendu : création refusée';
  assert tests.state(format('select public.update_group_program(%L, 1, %L, %L::jsonb)', 'c0000000-0000-4000-8000-000000000001', 'x', tests.get('steps'))) = '42501', 'suspendu : modification refusée';
end $$;
reset role;
delete from private.user_suspensions;
set role authenticated;

-- Avancée par membre, enchaînement des étapes, masquage, version.
do $$
declare v jsonb; s1 uuid; s3 uuid; pid uuid := 'c0000000-0000-4000-8000-000000000001';
begin
  perform tests.as_user('P');
  select id into s1 from public.group_program_steps where program_id = pid and position = 1;
  select id into s3 from public.group_program_steps where program_id = pid and position = 3;
  assert public.set_program_progress(s1, 99) = 3, 'avancée bornée au nombre de l''étape';
  perform tests.as_user('K');
  assert public.set_program_progress(s1, 1) = 1, 'enfant : peut compter (membre)';
  perform tests.as_user('G');
  assert (select count(*) from public.group_program_progress) = 0, 'avancée d''autrui non lisible en direct';
  perform tests.as_user('X');
  assert tests.state(format('select public.set_program_progress(%L, 1)', s1)) = '42501', 'hors groupe : pas d''avancée';
  perform tests.as_user('P');
  v := public.group_program_view(pid);
  assert jsonb_array_length(v -> 'steps') = 3 and (v -> 'steps' -> 0 ->> 'total')::int = 4 and (v -> 'steps' -> 0 ->> 'done_by')::int = 1, 'totaux par étape';
  assert (v -> 'steps' -> 0 ->> 'mine')::int = 3, 'ma propre avancée';
  assert (v ->> 'can_admin')::boolean, 'parent : peut administrer';
  assert (select (m -> 'counts' ->> '1')::int from jsonb_array_elements(v -> 'members') m where m ->> 'name' = 'Kadi') = 1, 'famille : compteur visible par défaut';
  -- Cercle : « participation » par défaut → nombres masqués pour les autres, visibles pour soi.
  perform tests.as_user('X');
  perform public.set_program_progress((select id from public.group_program_steps where program_id = 'c0000000-0000-4000-8000-000000000007' and position = 1), 2);
  v := public.group_program_view('c0000000-0000-4000-8000-000000000007');
  assert not (v ->> 'can_admin')::boolean, 'membre : pas d''administration';
  assert (select m -> 'counts' from jsonb_array_elements(v -> 'members') m where (m ->> 'me')::boolean) is not null, 'je vois mes nombres';
  perform tests.as_user('F');
  v := public.group_program_view('c0000000-0000-4000-8000-000000000007');
  assert (select jsonb_typeof(m -> 'counts') from jsonb_array_elements(v -> 'members') m where m ->> 'name' = 'Xavier') = 'null', 'cercle : nombres masqués par défaut';
  assert (select (m ->> 'participated')::boolean from jsonb_array_elements(v -> 'members') m where m ->> 'name' = 'Xavier'), 'cercle : participation visible';
  -- Nouvelle version : contrôle de concurrence, avancées remises à zéro.
  perform tests.as_user('A');
  assert public.update_group_program(pid, 1, 'Programme test v2', '[{"label":"Formule test A","target":5}]'::jsonb) = 2, 'adulte : nouvelle version';
  assert tests.state(format('select public.update_group_program(%L, 1, %L, %L::jsonb)', pid, 'x', '[{"label":"x","target":1}]')) = '40001', 'version périmée refusée';
  assert (select count(*) from public.group_program_steps where program_id = pid) = 1, 'étapes remplacées';
  perform tests.as_user('P');
  assert (select count(*) from public.group_program_progress where program_id = pid) = 0, 'avancées de l''ancienne version effacées';
  -- Archivage : admin seulement, plus d'avancée ensuite.
  perform tests.as_user('G');
  assert tests.state(format('select public.set_group_program_status(%L, %L)', pid, 'archived')) = '42501', 'invité : pas d''archivage';
  perform tests.as_user('P');
  perform public.set_group_program_status(pid, 'archived');
  assert tests.state(format('select public.set_program_progress(%L, 1)', (select id from public.group_program_steps where program_id = pid))) = '22023', 'archivé : plus d''avancée';
end $$;

-- Un compte mineur reste exclu même si un rôle adulte lui était attribué par erreur.
reset role;
update public.profiles set is_minor = true where id = tests.get('u_A')::uuid;
set role authenticated;
do $$ begin
  perform tests.as_user('A');
  assert tests.state(tests.mk('c0000000-0000-4000-8000-000000000009', 'family', tests.get('fam'), 'x')) = '42501', 'mineur : refusé';
end $$;
reset role;
