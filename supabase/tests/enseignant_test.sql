-- Classes : validation Bissabi + Premium, mineurs, vidéo mixte fermée, leçon et récitation.
-- Les compteurs de dhikr ne sont pas touchés.
create schema tests;
grant usage on schema tests to authenticated, service_role;
create table tests.ctx (k text primary key, v text not null);
grant select, insert, update, delete on tests.ctx to authenticated, service_role;
create function tests.state(q text) returns text language plpgsql as $$
begin execute q; return sqlstate; exception when others then return sqlstate; end $$;
create function tests.get(key text) returns text language sql stable as $$ select v from tests.ctx where k = key $$;
create function tests.as_user(u text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', (select v from tests.ctx where k = 'u_' || u))::text, false) $$;
grant execute on all functions in schema tests to authenticated, service_role;

insert into tests.ctx (k, v) values
  ('u_A', '41000000-0000-4000-8000-000000000001'),
  ('u_T', '41000000-0000-4000-8000-000000000002'),
  ('u_S', '41000000-0000-4000-8000-000000000003'),
  ('u_P', '41000000-0000-4000-8000-000000000004'),
  ('u_K', '41000000-0000-4000-8000-000000000005');
insert into auth.users (id, raw_user_meta_data) select v::uuid, jsonb_build_object('display_name', substr(k, 3)) from tests.ctx where k like 'u\_%';
insert into private.app_roles (user_id, role) values ('41000000-0000-4000-8000-000000000001', 'admin');
insert into public.user_entitlements (user_id, plan_id, source, external_ref, note)
  values ('41000000-0000-4000-8000-000000000002', 'lifetime', 'manual', 'test:teacher-T', 'test enseignant');
update public.app_config set value = 'true' where key = 'calls.enabled';
update public.app_config set value = '"wss://appels.test.invalid"' where key = 'calls.server_url';

-- Personne seule : pas de rôle, pas d’écriture dans la table.
set role authenticated;
select tests.as_user('T');
do $$ begin
  assert not public.am_i_teacher(), 'sans validation : pas enseignant';
  assert tests.state($q$insert into private.teacher_grants (user_id) values ('41000000-0000-4000-8000-000000000002')$q$) = '42501', 'table illisible et non modifiable';
  assert tests.state($q$select public.grant_teacher('41000000-0000-4000-8000-000000000003', 'moi')$q$) = '42501', 'un membre ne valide personne';
  assert tests.state($q$select public.create_class('Coran', '', 'T')$q$) = 'ZKT01', 'création refusée sans validation';
end $$;
select tests.as_user('A');
do $$ begin
  assert tests.state($q$select public.grant_teacher('41000000-0000-4000-8000-000000000001', 'soi')$q$) = '42501', 'un admin ne se valide pas lui-même';
  perform public.grant_teacher('41000000-0000-4000-8000-000000000003', 'élève');
end $$;
select tests.as_user('S');
do $$ begin
  assert not public.am_i_teacher(), 'validé sans Premium : pas enseignant';
  assert tests.state($q$select public.create_class('Coran', '', 'S')$q$) = 'ZKP01', 'Premium exigé';
end $$;
select tests.as_user('A');
select public.revoke_teacher('41000000-0000-4000-8000-000000000003');
select public.grant_teacher('41000000-0000-4000-8000-000000000002', 'Bissabi');
select tests.as_user('T');
do $$ begin
  assert public.am_i_teacher(), 'validation + Premium';
end $$;
insert into tests.ctx select 'class', public.create_class('Tajwīd du jeudi', 'Hafs', 'Ustadh')::text;
do $$ declare c public.circles; r jsonb; begin
  select * into c from public.circles where id = tests.get('class')::uuid;
  assert c.kind = 'class' and not c.allow_minors and not c.allow_mixed_video and c.max_members = 12, 'classe fermée aux mineurs et à la vidéo mixte';
  assert (select role from public.circle_members where circle_id = c.id and user_id = tests.get('u_T')::uuid) = 'founder', 'l’enseignant administre la classe';
  assert tests.state($q$select public.set_class_options('41000000-0000-4000-8000-000000000099', true, true)$q$) = '42501', 'options : seulement sa classe';
  r := public.call_rights('circle', tests.get('class')::uuid);
  assert (r ->> 'can_join')::boolean and not (r ->> 'video')::boolean and (r ->> 'mixed_closed')::boolean, 'vidéo mixte fermée : ' || r::text;
end $$;

select tests.as_user('T');
do $$ declare r jsonb; lid uuid; aid uuid; goals int; begin
  perform public.set_class_options(tests.get('class')::uuid, false, true);
  r := public.call_rights('circle', tests.get('class')::uuid);
  assert (r ->> 'video')::boolean and not (r ->> 'mixed_closed')::boolean, 'l’enseignant ouvre la vidéo';
  perform public.set_class_options(tests.get('class')::uuid, false, false);
  select count(*) into goals from public.goal_contributions;
  lid := public.schedule_class_lesson(tests.get('class')::uuid, 'Al-Fātiḥa', now() + interval '1 day', 1, 1, 7);
  assert tests.state(format($q$select public.schedule_class_lesson(%L, 'trop', now() + interval '1 day', 1, 1, 8)$q$, tests.get('class'))) = '22023', 'verset hors sourate refusé';
  aid := public.assign_recitation(tests.get('class')::uuid, 1, 1, 4, 'À voix haute, sans note automatique');
  perform public.mark_recitation_done(aid);
  assert (select count(*) from public.class_assignment_acks where assignment_id = aid) = 1, 'accusé de récitation';
  assert (select count(*) from public.goal_contributions) = goals, 'les compteurs de dhikr ne bougent pas';
  insert into tests.ctx select 'inv', code from public.create_invitation('circle', tests.get('class')::uuid, 'member', 5, 7);
  insert into tests.ctx select 'lesson', lid::text;
  insert into tests.ctx select 'duty', aid::text;
end $$;

select tests.as_user('S');
select public.accept_invitation(tests.get('inv'), 'Sara', true);
do $$ begin
  perform public.mark_recitation_done(tests.get('duty')::uuid);
  assert tests.state(format($q$select public.assign_recitation(%L, 1, 1, 2, '')$q$, tests.get('class'))) = '42501', 'un élève n’assigne pas';
  assert tests.state(format($q$select public.end_group_call('circle', %L)$q$, tests.get('class'))) = '42501', 'un élève ne termine pas l’appel';
end $$;
select tests.as_user('T');
do $$ begin assert public.end_group_call('circle', tests.get('class')::uuid), 'l’enseignant termine l’appel'; end $$;

-- Mineur : invitation refusée tant que la classe et un parent n’ont pas ouvert.
reset role;
update public.profiles set is_minor = true where id = tests.get('u_K')::uuid;
set role authenticated;
select tests.as_user('P');
insert into tests.ctx select 'fam', public.create_family('Famille', 'Parent')::text;
insert into tests.ctx select 'invk', code from public.create_invitation('family', tests.get('fam')::uuid, 'child', 1, 7);
select tests.as_user('K');
select public.accept_invitation(tests.get('invk'), 'Kadi', false);
select tests.as_user('T');
insert into tests.ctx select 'invc', code from public.create_invitation('circle', tests.get('class')::uuid, 'member', 2, 7);
select tests.as_user('K');
do $$ begin
  assert tests.state(format($q$select public.accept_invitation(%L, 'Kadi', true)$q$, tests.get('invc'))) = '42501', 'mineur : classe fermée';
end $$;
select tests.as_user('T');
select public.set_class_options(tests.get('class')::uuid, true, false);
select tests.as_user('K');
do $$ begin
  assert tests.state(format($q$select public.accept_invitation(%L, 'Kadi', true)$q$, tests.get('invc'))) = '42501', 'mineur : parent n’a pas autorisé';
end $$;
reset role;
update public.parental_controls set allow_classes = true
 where child_member_id = (select id from public.family_members where user_id = tests.get('u_K')::uuid);
set role authenticated;
select tests.as_user('K');
select public.accept_invitation(tests.get('invc'), 'Kadi', true);
do $$ declare r jsonb; begin
  r := public.call_rights('circle', tests.get('class')::uuid);
  assert not (r ->> 'can_join')::boolean and r ->> 'reason' = 'premium_required', 'mineur sans Premium : pas d’appel : ' || r::text;
end $$;
reset role;
insert into public.user_entitlements (user_id, plan_id, source, external_ref, note)
  values (tests.get('u_K')::uuid, 'lifetime', 'manual', 'test:class-K', 'élève Premium');
set role authenticated;
select tests.as_user('K');
do $$ declare r jsonb; begin
  r := public.call_rights('circle', tests.get('class')::uuid);
  assert (r ->> 'can_join')::boolean and not (r ->> 'video')::boolean, 'mineur Premium dans la classe, sans vidéo : ' || r::text;
  assert (select count(*) from public.goal_contributions) = 0, 'toujours aucun compteur de dhikr';
end $$;

reset role;
do $$ begin
  assert (select value from public.app_config where key = 'teaching.payments_enabled') = 'false'::jsonb, 'paiements éteints';
  assert (select value from public.app_config where key = 'teaching.commission_bps') = '500'::jsonb, 'taux par défaut 5 %';
  assert private.teaching_commission_bps() = 500, '500 dix-millièmes';
  assert not private.teaching_payments_open(), 'le taux seul n’ouvre pas l’encaissement';
  assert private.teaching_commission_cents(10000, 0) = 500, 'Stripe : 5 CHF sur un cours à 100 CHF';
  assert private.teaching_commission_cents(10000, 1500) = 425, 'Apple 15 % : 5 % des 85 CHF reçus';
  assert (select value from public.app_config where key = 'donations.enabled') = 'false'::jsonb, 'dons éteints';
  assert not private.donations_open();
  update public.app_config set value = 'null' where key = 'teaching.commission_bps';
  update public.app_config set value = 'true' where key = 'teaching.payments_enabled';
  assert not private.teaching_payments_open(), 'sans taux, l’interrupteur ne suffit pas';
  update public.app_config set value = '500' where key = 'teaching.commission_bps';
  assert private.teaching_payments_open(), 'taux 5 % et interrupteur : ouvert';
  update public.app_config set value = 'false' where key = 'teaching.payments_enabled';
end $$;
