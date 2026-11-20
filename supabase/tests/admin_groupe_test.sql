-- Administrateur = créateur (parent ou fondateur).
-- Un non-admin ne compose pas le zikr, ne retire pas un autre membre, ne supprime pas le groupe.
-- Rejoindre : invitation ou demande acceptée. Pas d’entrée directe.
-- Supprimer un groupe ne touche pas aux objectifs d’un autre groupe ni au profil.
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
  ('u_P', '32000000-0000-4000-8000-000000000001'),
  ('u_A', '32000000-0000-4000-8000-000000000002'),
  ('u_F', '32000000-0000-4000-8000-000000000003'),
  ('u_M', '32000000-0000-4000-8000-000000000004'),
  ('u_X', '32000000-0000-4000-8000-000000000005'),
  ('u_Z', '32000000-0000-4000-8000-000000000006');
insert into auth.users (id, raw_user_meta_data)
select v::uuid, jsonb_build_object('display_name', substr(k, 3)) from tests.ctx where k like 'u\_%';

set role authenticated;
select tests.as_user('P');
insert into tests.ctx select 'keep', public.create_family('Famille gardée', 'Parent')::text;
insert into tests.ctx select 'drop', public.create_family('Famille retirée', 'Parent')::text;
insert into tests.ctx select 'inv_a', code from public.create_invitation('family', tests.get('keep')::uuid, 'adult', 1, 7);
select tests.as_user('A');
select public.accept_invitation(tests.get('inv_a'), 'Adulte', false);
select tests.as_user('F');
insert into tests.ctx select 'cir', public.create_circle('Cercle test', '', 'Règles test', 'Fondateur')::text;
insert into tests.ctx select 'inv_m', code from public.create_invitation('circle', tests.get('cir')::uuid, 'moderator', 1, 7);
insert into tests.ctx select 'inv_x', code from public.create_invitation('circle', tests.get('cir')::uuid, 'member', 2, 7);
select tests.as_user('M');
select public.accept_invitation(tests.get('inv_m'), 'Modo', true);
select tests.as_user('X');
select public.accept_invitation(tests.get('inv_x'), 'Membre', true);

do $$ begin
  perform tests.as_user('P');
  assert (select role from public.family_members where family_id = tests.get('keep')::uuid and user_id = tests.get('u_P')::uuid) = 'parent', 'créateur famille = parent';
  perform tests.as_user('F');
  assert (select role from public.circle_members where circle_id = tests.get('cir')::uuid and user_id = tests.get('u_F')::uuid) = 'founder', 'créateur cercle = fondateur';
  perform tests.as_user('P');

  perform tests.as_user('P');
  insert into public.shared_goals (id, scope_type, family_id, created_by, title, formula, target)
    values ('a1000000-0000-4000-8000-000000000001', 'family', tests.get('keep')::uuid, tests.get('u_P')::uuid, 'Formule gardée', 'سبحان الله', 33);
  insert into public.shared_goals (id, scope_type, family_id, created_by, title, formula, target)
    values ('a1000000-0000-4000-8000-000000000002', 'family', tests.get('drop')::uuid, tests.get('u_P')::uuid, 'Formule retirée', 'سبحان الله', 33);
  insert into public.goal_contributions (goal_id, user_id, count) values
    ('a1000000-0000-4000-8000-000000000001', tests.get('u_P')::uuid, 5),
    ('a1000000-0000-4000-8000-000000000002', tests.get('u_P')::uuid, 7);

  perform tests.as_user('A');
  assert tests.state($q$insert into public.shared_goals (id, scope_type, family_id, created_by, title, formula, target)
    values ('a1000000-0000-4000-8000-000000000009', 'family', tests.get('keep')::uuid, tests.get('u_A')::uuid, 'Formule test', 'سبحان الله', 10)$q$) = '42501', 'adulte : pas de nouvel objectif';
  update public.shared_goals set target = 99 where id = 'a1000000-0000-4000-8000-000000000001';
  delete from public.shared_goals where id = 'a1000000-0000-4000-8000-000000000001';
  assert tests.state($q$select public.delete_group('family', tests.get('keep')::uuid)$q$) = '42501', 'adulte : ne supprime pas le groupe';
  assert tests.state(format($q$insert into public.zikr_sessions (scope_type, family_id, title, started_by) values ('family', %L, 'Session', %L)$q$, tests.get('keep'), tests.get('u_A'))) = '42501', 'adulte : ne compose pas la session';

  perform tests.as_user('P');
  assert (select target from public.shared_goals where id = 'a1000000-0000-4000-8000-000000000001') = 33, 'le nombre n’a pas bougé';
  assert (select count from public.goal_contributions where goal_id = 'a1000000-0000-4000-8000-000000000001') = 5, 'le compteur de cet objectif est intact';
  update public.shared_goals set target = 40, position = 1 where id = 'a1000000-0000-4000-8000-000000000001';
  assert (select target from public.shared_goals where id = 'a1000000-0000-4000-8000-000000000001') = 40, 'parent : adapte le nombre';
  assert (select count from public.goal_contributions where goal_id = 'a1000000-0000-4000-8000-000000000001') = 5, 'adapter le nombre ne réécrit pas le compteur';
  insert into public.zikr_sessions (scope_type, family_id, title, formula, target, started_by)
    values ('family', tests.get('keep')::uuid, 'Session', 'سبحان الله', 33, tests.get('u_P')::uuid);

  perform tests.as_user('M');
  assert tests.state($q$insert into public.shared_goals (id, scope_type, circle_id, created_by, title, formula, target)
    values ('b1000000-0000-4000-8000-000000000009', 'circle', tests.get('cir')::uuid, tests.get('u_M')::uuid, 'Formule test', 'سبحان الله', 10)$q$) = '42501', 'modérateur : pas d’objectif';
  delete from public.circle_members where circle_id = tests.get('cir')::uuid and user_id = tests.get('u_X')::uuid;
  assert exists (select 1 from public.circle_members where circle_id = tests.get('cir')::uuid and user_id = tests.get('u_X')::uuid), 'modérateur : ne retire pas un membre';
  assert tests.state(format($q$select public.create_invitation('circle', %L, 'member', 1, 7)$q$, tests.get('cir'))) = '42501', 'modérateur : n’invite pas';
  assert tests.state(format($q$select public.delete_group('circle', %L)$q$, tests.get('cir'))) = '42501', 'modérateur : ne supprime pas le cercle';

  perform tests.as_user('Z');
  assert (select count(*) from public.families where id = tests.get('keep')::uuid) = 0, 'extérieur : pas de lecture';
  assert tests.state(format($q$insert into public.family_members (family_id, user_id, display_name, role) values (%L, %L, 'Z', 'adult')$q$, tests.get('keep'), tests.get('u_Z'))) = '42501', 'pas d’entrée directe';
  assert tests.state(format($q$insert into public.circle_members (circle_id, user_id, display_name, role) values (%L, %L, 'Z', 'member')$q$, tests.get('cir'), tests.get('u_Z'))) = '42501', 'pas d’entrée directe au cercle';
  insert into tests.ctx select 'req', public.request_group_join('family', tests.get('keep')::uuid, 'Z', 'salam')::text;
  assert not exists (select 1 from public.family_members where family_id = tests.get('keep')::uuid and user_id = tests.get('u_Z')::uuid), 'une demande n’ajoute personne';

  perform tests.as_user('A');
  assert tests.state(format($q$select public.review_group_join_request(%L, true)$q$, tests.get('req'))) = '42501', 'un adulte n’accepte pas la demande';

  perform tests.as_user('P');
  perform public.review_group_join_request(tests.get('req')::uuid, true);
  assert (select role from public.family_members where family_id = tests.get('keep')::uuid and user_id = tests.get('u_Z')::uuid) = 'adult', 'demande acceptée : membre, sans devenir admin';
  assert (select count from public.goal_contributions where goal_id = 'a1000000-0000-4000-8000-000000000001') = 5, 'accepter une demande ne touche pas aux compteurs';
end $$;

-- Refus d’une demande : personne n’est ajouté. Programme : nombre et ordre sans effacer l’avancée.
do $$ begin
  perform tests.as_user('Z');
  insert into tests.ctx select 'req2', public.request_group_join('circle', tests.get('cir')::uuid, 'Z', null)::text;
  perform tests.as_user('F');
  perform public.review_group_join_request(tests.get('req2')::uuid, false);
  assert not exists (select 1 from public.circle_members where circle_id = tests.get('cir')::uuid and user_id = tests.get('u_Z')::uuid), 'demande refusée : pas membre';
  perform tests.as_user('M');
  assert tests.state(format($q$select public.review_group_join_request(%L, true)$q$, tests.get('req2'))) = 'P0002', 'déjà traitée, et un modérateur ne la rouvre pas';
end $$;

do $$ begin
  perform tests.as_user('P');
  assert (public.create_group_program('c2000000-0000-4000-8000-000000000001', 'family', tests.get('keep')::uuid, 'Programme test',
    '[{"label":"Un","target":10},{"label":"Deux","target":20}]'::jsonb) ->> 'created')::boolean;
  perform tests.as_user('A');
  assert tests.state($q$select public.set_program_step_target((select id from public.group_program_steps where program_id = 'c2000000-0000-4000-8000-000000000001' and position = 1), 12)$q$) = '42501', 'adulte : ne change pas le nombre d’une étape';
  perform tests.as_user('P');
  perform public.set_program_progress((select id from public.group_program_steps where program_id = 'c2000000-0000-4000-8000-000000000001' and position = 1), 4);
  perform public.set_program_step_target((select id from public.group_program_steps where program_id = 'c2000000-0000-4000-8000-000000000001' and position = 1), 12);
  assert (select count from public.group_program_progress p join public.group_program_steps s on s.id = p.step_id
    where s.program_id = 'c2000000-0000-4000-8000-000000000001' and s.position = 1 and p.user_id = tests.get('u_P')::uuid) = 4, 'changer le nombre ne réécrit pas l’avancée';
  perform public.move_program_step((select id from public.group_program_steps where program_id = 'c2000000-0000-4000-8000-000000000001' and position = 1), 1);
  assert (select label from public.group_program_steps where program_id = 'c2000000-0000-4000-8000-000000000001' and position = 2) = 'Un', 'l’étape a changé de place';
  assert (select p.count from public.group_program_progress p join public.group_program_steps s on s.id = p.step_id
    where s.label = 'Un' and p.user_id = tests.get('u_P')::uuid) = 4, 'l’avancée suit l’étape, pas la place';

  perform public.delete_group('family', tests.get('drop')::uuid);
  assert not exists (select 1 from public.families where id = tests.get('drop')::uuid), 'groupe supprimé';
  assert not exists (select 1 from public.shared_goals where id = 'a1000000-0000-4000-8000-000000000002'), 'objectifs de CE groupe retirés';
  assert (select count from public.goal_contributions where goal_id = 'a1000000-0000-4000-8000-000000000001') = 5, 'compteur d’un autre objectif intact';
  assert exists (select 1 from public.families where id = tests.get('keep')::uuid), 'l’autre famille reste';
  assert exists (select 1 from public.profiles where id = tests.get('u_P')::uuid), 'le profil reste';
  assert exists (select 1 from public.family_members where family_id = tests.get('keep')::uuid and user_id = tests.get('u_P')::uuid), 'les autres appartenances restent';
end $$;
reset role;
