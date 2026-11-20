-- Premium à vie : le verrou serveur est coupé par défaut. Une fois allumé, seuls
-- l’antériorité, le plan manuel/promo et (si payments_enabled) l’achat storekit créent un groupe.
-- Rejoindre reste possible sans Premium. Rien n’est effacé.
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
  ('u_N1', '31000000-0000-4000-8000-000000000001'),
  ('u_N2', '31000000-0000-4000-8000-000000000002'),
  ('u_N3', '31000000-0000-4000-8000-000000000003'),
  ('u_N4', '31000000-0000-4000-8000-000000000004');
insert into auth.users (id, raw_user_meta_data)
select v::uuid, jsonb_build_object('display_name', substr(k, 3)) from tests.ctx where k like 'u\_%';

-- Verrou coupé : la création reste possible, le créateur est parent.
set role authenticated;
select tests.as_user('N1');
insert into tests.ctx select 'f1', public.create_family('Famille déjà là', 'N1')::text;
do $$ begin
  assert (select role from public.family_members where family_id = tests.get('f1')::uuid and user_id = tests.get('u_N1')::uuid) = 'parent', 'le créateur est parent';
  assert (select name from public.families where id = tests.get('f1')::uuid) = 'Famille déjà là', 'nom conservé';
end $$;

select tests.as_user('N3');
insert into tests.ctx select 'f3', public.create_family('Famille antérieure', 'N3')::text;

-- Antériorité : ceux qui ont déjà créé, sans réécrire la famille.
reset role;
insert into public.user_entitlements (user_id, plan_id, source, external_ref, note)
select distinct s.u, 'lifetime', 'grandfather', 'grandfather:' || s.u::text, 'test antériorité'
from (select created_by as u from public.families where created_by is not null) s
on conflict (source, external_ref) do nothing;
update public.app_config set value = 'true' where key = 'premium_creation_gate';

set role authenticated;
do $$ begin
  perform tests.as_user('N3');
  assert tests.state($q$select public.create_family('Deuxième famille', 'N3')$q$) = 'ok', 'antériorité : peut encore créer';
  assert (select name from public.families where id = tests.get('f3')::uuid) = 'Famille antérieure', 'la première famille n’est pas réécrite';
  perform tests.as_user('N1');
  assert tests.state($q$select public.create_family('Encore', 'N1')$q$) = 'ok', 'N1 avait déjà créé : antériorité';
  update public.families set name = 'Famille déjà là' where id = tests.get('f1')::uuid;
end $$;

-- Quelqu’un qui n’a fait que rejoindre : pas de Premium, pas de création. L’invitation reste ouverte.
do $$ begin
  perform tests.as_user('N1');
  insert into tests.ctx select 'inv', code from public.create_invitation('family', tests.get('f1')::uuid, 'adult', 1, 7);
  perform tests.as_user('N4');
  perform public.accept_invitation(tests.get('inv'), 'N4', false);
  assert exists (select 1 from public.family_members where family_id = tests.get('f1')::uuid and user_id = tests.get('u_N4')::uuid), 'rejoindre sans Premium';
  assert tests.state($q$select public.create_family('Non', 'N4')$q$) = 'ZKP01', 'sans création antérieure : Premium requis';
  assert tests.state($q$select public.create_circle('Non', '', '', 'N4')$q$) = 'ZKP01', 'cercle aussi';
end $$;

-- storekit ignoré tant que payments_enabled = false, puis accepté.
reset role;
insert into public.user_entitlements (user_id, plan_id, source, external_ref)
values ('31000000-0000-4000-8000-000000000002', 'lifetime', 'storekit', 'txn-sandbox-1');
set role authenticated;
do $$ begin
  perform tests.as_user('N2');
  assert tests.state($q$select public.create_family('Achat inerte', 'N2')$q$) = 'ZKP01', 'storekit inerte si payments_enabled = false';
end $$;
reset role;
update public.app_config set value = 'true' where key = 'payments_enabled';
set role authenticated;
do $$ begin
  perform tests.as_user('N2');
  assert tests.state($q$select public.create_family('Achat vivant', 'N2')$q$) = 'ok', 'storekit compte quand payments_enabled = true';
end $$;

-- Renvoi du même programme : pas un second enregistrement, même si l’achat est retiré.
do $$ begin
  perform tests.as_user('N1');
  assert (public.create_group_program('c1000000-0000-4000-8000-000000000001', 'family', tests.get('f1')::uuid, 'Programme test', '[{"label":"Formule test","target":33}]'::jsonb) ->> 'created')::boolean, 'programme créé';
end $$;
reset role;
delete from public.user_entitlements where user_id = '31000000-0000-4000-8000-000000000001';
set role authenticated;
do $$ begin
  perform tests.as_user('N1');
  assert (public.create_group_program('c1000000-0000-4000-8000-000000000001', 'family', tests.get('f1')::uuid, 'Programme test', '[{"label":"Formule test","target":33}]'::jsonb) ->> 'created')::boolean = false, 'renvoi : pas de doublon, sans redemander l’achat';
  assert (select count(*) from public.group_programs where id = 'c1000000-0000-4000-8000-000000000001') = 1, 'un seul programme';
  assert (select count(*) from public.group_program_steps where program_id = 'c1000000-0000-4000-8000-000000000001') = 1, 'étapes non dupliquées';
  assert tests.state($q$select public.create_family('Après retrait', 'N1')$q$) = 'ZKP01', 'sans antériorité ni achat : création refusée';
end $$;
reset role;
