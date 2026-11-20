-- Lecture partagée : drapeau fermé, RLS, enseignant seul pour les marques, élève seulement s’il a la main.
-- Le texte du Coran n’est pas en base. Les compteurs de dhikr ne bougent pas.
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
  ('u_A', '42000000-0000-4000-8000-000000000001'),
  ('u_T', '42000000-0000-4000-8000-000000000002'),
  ('u_S', '42000000-0000-4000-8000-000000000003');
insert into auth.users (id, raw_user_meta_data) select v::uuid, jsonb_build_object('display_name', substr(k, 3)) from tests.ctx where k like 'u\_%';
insert into private.app_roles (user_id, role) values ('42000000-0000-4000-8000-000000000001', 'admin');
insert into public.user_entitlements (user_id, plan_id, source, external_ref, note) values
  ('42000000-0000-4000-8000-000000000002', 'lifetime', 'manual', 'test:reading-T', 'test lecture'),
  ('42000000-0000-4000-8000-000000000003', 'lifetime', 'manual', 'test:reading-S', 'élève Premium');

do $$ begin
  assert not public.shared_reading_open(), 'drapeau fermé par défaut';
end $$;

set role authenticated;
select tests.as_user('A');
select public.grant_teacher('42000000-0000-4000-8000-000000000002', 'Bissabi');
select tests.as_user('T');
insert into tests.ctx select 'class', public.create_class('Hafs du matin', '', 'Ustadh')::text;
insert into tests.ctx select 'lesson', public.schedule_class_lesson(tests.get('class')::uuid, 'Al-Fātiḥa', now() + interval '1 day', 1, 1, 7)::text;
insert into tests.ctx select 'inv', code from public.create_invitation('circle', tests.get('class')::uuid, 'member', 5, 7);
select tests.as_user('S');
select public.accept_invitation(tests.get('inv'), 'Sara', true);

-- Fermé : même l’enseignant ne lit ni n’écrit. Personne n’insère dans la table.
select tests.as_user('T');
do $$ declare goals int; begin
  select count(*) into goals from public.goal_contributions;
  assert tests.state(format($q$select public.open_lesson_reading(%L, 1, 1, 7)$q$, tests.get('lesson'))) = 'ZKL01', 'fermé : pas d’ouverture';
  assert tests.state(format($q$select public.lesson_reading(%L)$q$, tests.get('lesson'))) = 'ZKL01', 'fermé : pas de lecture';
  assert (select count(*) from public.lesson_readings) = 0, 'fermé : aucune ligne visible';
  assert tests.state(format($q$insert into public.lesson_readings (lesson_id, surah, ayah_from, ayah_to, focus_ayah, updated_by) values (%L, 1, 1, 7, 1, %L)$q$, tests.get('lesson'), tests.get('u_T'))) = '42501', 'écriture directe refusée';
  assert (select count(*) from public.goal_contributions) = goals, 'les compteurs de dhikr ne bougent pas';
end $$;

reset role;
update public.app_config set value = 'true' where key = 'teaching.shared_reading';
set role authenticated;

select tests.as_user('A');
do $$ begin
  assert tests.state(format($q$select public.lesson_reading(%L)$q$, tests.get('lesson'))) = '42501', 'un admin hors classe ne lit pas';
  assert (select count(*) from public.lesson_readings) = 0, 'RLS : hors classe, rien';
  assert (select count(*) from public.lesson_marks) = 0, 'RLS marques : hors classe, rien';
end $$;

select tests.as_user('S');
do $$ begin
  assert tests.state(format($q$select public.open_lesson_reading(%L, 1, 1, 7)$q$, tests.get('lesson'))) = '42501', 'un élève n’ouvre pas le passage';
  assert public.lesson_reading(tests.get('lesson')::uuid) is null, 'élève : pas encore de position';
end $$;

select tests.as_user('T');
do $$ declare r jsonb; begin
  r := public.open_lesson_reading(tests.get('lesson')::uuid, 1, 1, 7);
  assert (r ->> 'surah')::int = 1 and (r ->> 'ayah_from')::int = 1 and (r ->> 'ayah_to')::int = 7, 'passage ouvert';
  assert (r ->> 'focus_ayah')::int = 1 and r -> 'focus_word' = 'null'::jsonb and r -> 'driver_id' = 'null'::jsonb, 'curseur au début, enseignant';
  assert (r ->> 'revision')::int = 1 and r -> 'marks' = '[]'::jsonb, 'première révision, sans marque';
  assert tests.state(format($q$select public.open_lesson_reading(%L, 1, 1, 8)$q$, tests.get('lesson'))) = '22023', 'verset hors sourate refusé';
  assert tests.state(format($q$select public.set_reading_focus(%L, 8, 0)$q$, tests.get('lesson'))) = '22023', 'verset hors passage refusé';
  assert tests.state(format($q$select public.set_reading_focus(%L, 2, 401)$q$, tests.get('lesson'))) = '22023', 'index de mot refusé';
  r := public.set_reading_focus(tests.get('lesson')::uuid, 2, 0);
  assert (r ->> 'focus_ayah')::int = 2 and (r ->> 'focus_word')::int = 0 and (r ->> 'revision')::int = 2, 'l’enseignant avance le mot';
end $$;

select tests.as_user('S');
do $$ begin
  assert (select count(*) from public.lesson_readings) = 1, 'l’élève voit la position';
  assert tests.state(format($q$select public.set_reading_focus(%L, 3, null)$q$, tests.get('lesson'))) = '42501', 'sans la main, l’élève ne déplace pas';
  assert tests.state(format($q$select public.add_lesson_mark(%L, 2, 0, 'tajweed', '')$q$, tests.get('lesson'))) = '42501', 'un élève ne marque pas';
  assert tests.state(format($q$select public.hand_reading(%L, %L)$q$, tests.get('lesson'), tests.get('u_T'))) = '42501', 'un élève ne donne pas la main';
end $$;

select tests.as_user('T');
do $$ declare r jsonb; begin
  assert tests.state(format($q$select public.hand_reading(%L, '42000000-0000-4000-8000-000000000099')$q$, tests.get('lesson'))) = '42501', 'main : seulement un membre';
  r := public.hand_reading(tests.get('lesson')::uuid, tests.get('u_S')::uuid);
  assert r ->> 'driver_id' = tests.get('u_S'), 'la main passe à l’élève';
  assert tests.state(format($q$select public.set_reading_focus(%L, 4, null)$q$, tests.get('lesson'))) = '42501', 'l’enseignant ne déplace plus tant que l’élève a la main';
end $$;

select tests.as_user('S');
do $$ declare r jsonb; begin
  r := public.set_reading_focus(tests.get('lesson')::uuid, 3, 1);
  assert (r ->> 'focus_ayah')::int = 3 and (r ->> 'focus_word')::int = 1, 'l’élève conduit';
  assert tests.state(format($q$select public.open_lesson_reading(%L, 1, 1, 3)$q$, tests.get('lesson'))) = '42501', 'l’élève ne change pas le passage';
end $$;

select tests.as_user('T');
do $$ declare r jsonb; mid uuid; begin
  r := public.add_lesson_mark(tests.get('lesson')::uuid, 2, 0, 'tajweed', 'ghunna');
  assert jsonb_array_length(r -> 'marks') = 1 and r -> 'marks' -> 0 ->> 'kind' = 'tajweed' and r -> 'marks' -> 0 ->> 'comment' = 'ghunna', 'marque de tajwīd';
  assert tests.state(format($q$select public.add_lesson_mark(%L, 2, 0, 'comment', '')$q$, tests.get('lesson'))) = '22023', 'commentaire vide refusé';
  assert tests.state(format($q$select public.add_lesson_mark(%L, 2, 0, 'comment', %L)$q$, tests.get('lesson'), repeat('a', 281))) = '22023', 'commentaire trop long refusé';
  assert tests.state(format($q$select public.add_lesson_mark(%L, 2, 0, 'note', 'x')$q$, tests.get('lesson'))) = '22023', 'sorte inconnue refusée';
  r := public.add_lesson_mark(tests.get('lesson')::uuid, 3, null, 'comment', 'reprendre le madd');
  mid := (r -> 'marks' -> 1 ->> 'id')::uuid;
  r := public.remove_lesson_mark(mid);
  assert jsonb_array_length(r -> 'marks') = 1 and r -> 'marks' -> 0 ->> 'kind' = 'tajweed', 'la marque retirée n’est plus dans la leçon';
  assert (select count(*) from public.lesson_marks where removed_at is null) = 1, 'une marque reste pour la relecture';
  r := public.open_lesson_reading(tests.get('lesson')::uuid, 1, 5, 7);
  assert (r ->> 'focus_ayah')::int = 5 and r -> 'driver_id' = 'null'::jsonb, 'changer de passage rend la main à l’enseignant';
  assert jsonb_array_length(r -> 'marks') = 1, 'la marque reste rangée avec la leçon';
end $$;

select tests.as_user('S');
do $$ declare r jsonb; begin
  r := public.lesson_reading(tests.get('lesson')::uuid);
  assert (r ->> 'ayah_from')::int = 5 and jsonb_array_length(r -> 'marks') = 1, 'l’élève reçoit la même position et la marque';
  assert tests.state(format($q$select public.set_reading_focus(%L, 6, null)$q$, tests.get('lesson'))) = '42501', 'la main est revenue à l’enseignant';
end $$;

reset role;
delete from public.user_entitlements where user_id = tests.get('u_S')::uuid;
set role authenticated;
select tests.as_user('S');
do $$ begin
  assert tests.state(format($q$select public.lesson_reading(%L)$q$, tests.get('lesson'))) = 'ZKP01', 'élève sans Premium : lecture refusée';
  assert (select count(*) from public.lesson_readings) = 0, 'RLS : sans Premium, la position est invisible';
end $$;
reset role;
insert into public.user_entitlements (user_id, plan_id, source, external_ref, note)
  values (tests.get('u_S')::uuid, 'lifetime', 'manual', 'test:reading-S2', 'élève rétabli');
delete from public.user_entitlements where user_id = tests.get('u_T')::uuid;
set role authenticated;
select tests.as_user('S');
do $$ declare r jsonb; begin
  r := public.lesson_reading(tests.get('lesson')::uuid);
  assert r is not null and (r ->> 'ayah_from')::int = 5, 'élève Premium lit encore si l’enseignant perd Premium';
end $$;
select tests.as_user('T');
do $$ begin
  assert not public.am_i_teacher(), 'sans Premium : plus enseignant';
  assert tests.state(format($q$select public.open_lesson_reading(%L, 1, 1, 7)$q$, tests.get('lesson'))) = 'ZKP01', 'conduire la lecture exige Premium';
end $$;
reset role;
insert into public.user_entitlements (user_id, plan_id, source, external_ref, note)
  values (tests.get('u_T')::uuid, 'lifetime', 'manual', 'test:reading-T-restore', 'restauré pour clore la leçon');
set role authenticated;
select tests.as_user('T');
select public.cancel_class_lesson(tests.get('lesson')::uuid);
do $$ begin
  assert tests.state(format($q$select public.lesson_reading(%L)$q$, tests.get('lesson'))) = '42501', 'leçon annulée : plus de lecture';
end $$;

reset role;
update public.app_config set value = 'false' where key = 'teaching.shared_reading';
set role authenticated;
select tests.as_user('S');
do $$ begin
  assert not public.shared_reading_open(), 'refermé';
  assert (select count(*) from public.lesson_readings) = 0, 'refermé : la position n’est plus lisible';
  assert tests.state(format($q$select public.lesson_reading(%L)$q$, tests.get('lesson'))) = 'ZKL01', 'refermé : la fonction refuse';
end $$;
