-- Tests P1 (SQL pur, ASSERT plpgsql). Chaque échec lève une exception et arrête l'exécution.
-- Lancer : node docs/p1-groups/sql/tests/run-pglite.mjs  (voir README)
-- Compatible pgTAP/« supabase test db » après adaptation : chaque ASSERT correspond à un ok().
-- Personnes : A = administrateur, B = membre, C = extérieur, K = compte enfant.

create schema tests;
grant usage on schema tests to authenticated;
create table tests.ctx (k text primary key, v text not null);
grant select, insert, update on tests.ctx to authenticated;
create function tests.throws(q text, needle text default null) returns boolean language plpgsql as $$
begin
  execute q; return false;
exception when others then
  if needle is null or sqlerrm ilike '%' || needle || '%' then return true; end if;
  raise notice 'erreur inattendue : %', sqlerrm; return false;
end $$;
grant execute on function tests.throws(text, text) to authenticated;
create function tests.get(key text) returns text language sql stable as $$ select v from tests.ctx where k = key $$;
grant execute on function tests.get(text) to authenticated;

insert into auth.users (id, raw_user_meta_data) values
  ('aaaaaaaa-0000-4000-8000-000000000001', '{"display_name":"Aïcha"}'),
  ('bbbbbbbb-0000-4000-8000-000000000002', '{"display_name":"Bilal"}'),
  ('cccccccc-0000-4000-8000-000000000003', '{"display_name":"Chérif"}'),
  ('dddddddd-0000-4000-8000-000000000004', '{"display_name":"Kadi"}');
update public.profiles set is_minor = true where id = 'dddddddd-0000-4000-8000-000000000004';

-- ===== A crée un groupe, un objectif et une invitation
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-8000-000000000001"}', false);
set role authenticated;
insert into tests.ctx select 'circle', public.create_circle('Halqa du jeudi', 'Zikr hebdomadaire', 'Bienveillance, pas de comparaison.', 'Aïcha')::text;
insert into public.shared_goals (scope_type, circle_id, title, target, created_by)
  values ('circle', tests.get('circle')::uuid, 'Salawat 1000', 1000, auth.uid());
insert into tests.ctx select 'goal', id::text from public.shared_goals where circle_id = tests.get('circle')::uuid;
insert into tests.ctx select 'token', token from public.create_group_invite(tests.get('circle')::uuid, 'member', 2, 24);
do $$ begin
  assert length(tests.get('token')) = 32, 'jeton de 32 caractères base64url';
  assert tests.get('token') ~ '^[A-Za-z0-9_-]+$', 'jeton URL-safe';
  -- Le jeton en clair n'est stocké nulle part ; le hash n'est pas lisible par le client.
  assert tests.throws('select token_hash from public.group_invites', 'permission denied'), 'hash non lisible';
  assert (select count(*) from public.group_invites) = 1, 'l''administrateur voit son invitation';
  assert tests.throws($q$select public.create_group_invite('00000000-0000-4000-8000-000000000000'::uuid)$q$, 'Réservé'), 'pas d''invitation pour un groupe étranger';
end $$;

-- ===== B prévisualise puis rejoint
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-4000-8000-000000000002"}', false);
do $$ declare p jsonb; begin
  p := public.preview_group_invite(tests.get('token'));
  assert (p->>'valid')::boolean and p->>'name' = 'Halqa du jeudi' and (p->>'members')::int = 1, 'aperçu valide';
  assert not (public.preview_group_invite('mauvais-jeton')->>'valid')::boolean, 'jeton inconnu = invalide';
  assert tests.throws($q$select public.join_group('$q$ || tests.get('token') || $q$', 'Bilal', false)$q$, 'règlement'), 'règlement obligatoire';
  assert (public.join_group(tests.get('token'), 'Bilal', true)->>'role') = 'member', 'B rejoint comme membre';
  assert tests.throws($q$select public.join_group('$q$ || tests.get('token') || $q$', 'Bilal', true)$q$, 'déjà membre'), 'pas deux fois';
  assert (select count(*) from public.group_invites) = 0, 'un simple membre ne voit pas les invitations';
  assert tests.throws($q$select public.create_group_invite('$q$ || tests.get('circle') || $q$'::uuid)$q$, 'Réservé'), 'un membre n''invite pas';
end $$;

-- ===== K (enfant) ne peut pas rejoindre ; C : jeton expiré / révoqué
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-4000-8000-000000000004"}', false);
do $$ begin
  assert tests.throws($q$select public.join_group('$q$ || tests.get('token') || $q$', 'Kadi', true)$q$, 'enfants'), 'mineur refusé';
end $$;
reset role;
update public.group_invites set created_at = now() - interval '1 hour', expires_at = now() - interval '1 second';
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-4000-8000-000000000003"}', false);
do $$ begin
  assert tests.throws($q$select public.join_group('$q$ || tests.get('token') || $q$', 'Chérif', true)$q$, 'expirée'), 'jeton expiré refusé';
end $$;

-- ===== Appareils
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-4000-8000-000000000002"}', false);
select public.register_device('b0000000-0000-4000-8000-00000000d001', 'phone', 'iPhone de Bilal');
select public.register_device('b0000000-0000-4000-8000-00000000d002', 'ring', 'ZKR-R1');
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-4000-8000-000000000003"}', false);
do $$ begin
  assert tests.throws($q$select public.register_device('b0000000-0000-4000-8000-00000000d001', 'phone', 'vol')$q$, 'déjà utilisé'), 'pas de vol d''identifiant';
  assert tests.throws($q$select public.ingest_counter_events('b0000000-0000-4000-8000-00000000d001', '[]')$q$, 'Appareil inconnu'), 'pas d''envoi au nom d''un autre';
  assert (select count(*) from public.devices) = 0, 'C ne voit pas les appareils de B';
end $$;

-- ===== Ingestion idempotente
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-4000-8000-000000000002"}', false);
do $$ declare r jsonb; g text := tests.get('goal'); batch jsonb; begin
  batch := jsonb_build_array(
    jsonb_build_object('seq', 1, 'goal_id', g, 'count', 33, 'at', now() - interval '3 minutes', 'source', 'ecran'),
    jsonb_build_object('seq', 2, 'goal_id', g, 'count', 33, 'at', now() - interval '2 minutes', 'source', 'ecran'),
    jsonb_build_object('seq', 3, 'goal_id', g, 'count', 34, 'at', now() - interval '1 minute', 'source', 'ecran'));
  r := public.ingest_counter_events('b0000000-0000-4000-8000-00000000d001', batch);
  assert (r->>'accepted')::int = 3 and (r->>'duplicates')::int = 0, 'premier envoi : 3 acceptés';
  assert (r->'totals'->>g)::int = 100, 'total renvoyé = 100';
  -- Renvoi du même lot (réponse perdue côté réseau) : rien ne change.
  r := public.ingest_counter_events('b0000000-0000-4000-8000-00000000d001', batch);
  assert (r->>'accepted')::int = 0 and (r->>'duplicates')::int = 3 and jsonb_array_length(r->'acked') = 3, 'renvoi = 3 doublons acquittés';
  assert (r->'totals'->>g)::int = 100, 'toujours 100 après renvoi';
  -- Désordre + même seq sur un autre appareil (la bague) : compte séparément.
  r := public.ingest_counter_events('b0000000-0000-4000-8000-00000000d002', jsonb_build_array(
    jsonb_build_object('seq', 9, 'goal_id', g, 'count', 10, 'at', now(), 'source', 'bague'),
    jsonb_build_object('seq', 1, 'goal_id', g, 'count', 5, 'at', now(), 'source', 'bague')));
  assert (r->>'accepted')::int = 2 and (r->'totals'->>g)::int = 115, 'G-counter : appareils indépendants, ordre libre';
  -- Rejets définitifs
  r := public.ingest_counter_events('b0000000-0000-4000-8000-00000000d001', jsonb_build_array(
    jsonb_build_object('seq', 4, 'goal_id', g, 'count', 5000, 'at', now()),
    jsonb_build_object('seq', 5, 'goal_id', g, 'count', 1, 'at', now() + interval '1 hour'),
    jsonb_build_object('seq', 'x', 'goal_id', g, 'count', 1, 'at', now()),
    jsonb_build_object('seq', 6, 'goal_id', '00000000-0000-4000-8000-000000000000', 'count', 1, 'at', now())));
  assert (r->>'accepted')::int = 0 and jsonb_array_length(r->'rejected') = 4, '4 rejets';
  assert (select array_agg(x->>'reason' order by x->>'reason') from jsonb_array_elements(r->'rejected') x)
         = array['format','format','horodatage','objectif'], 'motifs de rejet';
  -- Cadence impossible : 1300 dans la même minute → le 2e lot est refusé, le 1er reste.
  r := public.ingest_counter_events('b0000000-0000-4000-8000-00000000d001', jsonb_build_array(
    jsonb_build_object('seq', 10, 'goal_id', g, 'count', 700, 'at', date_trunc('minute', now()) - interval '10 minutes'),
    jsonb_build_object('seq', 11, 'goal_id', g, 'count', 600, 'at', date_trunc('minute', now()) - interval '10 minutes' + interval '20 seconds')));
  assert (r->>'accepted')::int = 1 and (r->'rejected'->0->>'reason') = 'cadence', 'cadence plafonnée';
  assert (r->'totals'->>g)::int = 815, 'total = 115 + 700';
  assert (select count(*) from public.counter_events where seq = 11) = 0, 'événement refusé annulé (sous-transaction)';
  assert tests.throws($q$select public.ingest_counter_events('b0000000-0000-4000-8000-00000000d001', (select jsonb_agg(jsonb_build_object('seq', i, 'goal_id', 'x', 'count', 1, 'at', now())) from generate_series(1, 501) i))$q$, '500'), 'lot de 501 refusé';
end $$;

-- ===== Objectif atteint (1000) : statut done, nouveaux envois refusés, renvois acquittés
do $$ declare r jsonb; g text := tests.get('goal'); begin
  r := public.ingest_counter_events('b0000000-0000-4000-8000-00000000d001',
    jsonb_build_array(jsonb_build_object('seq', 13, 'goal_id', g, 'count', 200, 'at', now())));
  assert (r->'totals'->>g)::int = 1015, 'total 1015';
  assert (select status from public.shared_goals where id = g::uuid) = 'done', 'objectif atteint automatiquement';
  r := public.ingest_counter_events('b0000000-0000-4000-8000-00000000d001', jsonb_build_array(
    jsonb_build_object('seq', 12, 'goal_id', g, 'count', 1, 'at', now()),
    jsonb_build_object('seq', 10, 'goal_id', g, 'count', 700, 'at', date_trunc('minute', now()) - interval '10 minutes')));
  assert (r->'rejected'->0->>'reason') = 'objectif' and (r->>'duplicates')::int = 1, 'fermé : nouveau refusé, renvoi acquitté';
end $$;

-- ===== Confidentialité de la progression
reset role;
insert into public.shared_goals (scope_type, circle_id, title, target, created_by)
  values ('circle', (select v::uuid from tests.ctx where k = 'circle'), 'Istighfar', 100000, 'aaaaaaaa-0000-4000-8000-000000000001');
insert into tests.ctx select 'goal2', id::text from public.shared_goals where title = 'Istighfar';
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-4000-8000-000000000002"}', false);
select public.ingest_counter_events('b0000000-0000-4000-8000-00000000d001',
  jsonb_build_array(jsonb_build_object('seq', 20, 'goal_id', tests.get('goal2'), 'count', 70, 'at', now())));
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-8000-000000000001"}', false);
do $$ declare p jsonb; b jsonb; begin
  p := public.goal_progress(tests.get('goal2')::uuid);
  select x into b from jsonb_array_elements(p->'members') x where x->>'name' = 'Bilal';
  assert (p->>'total')::int = 70, 'total du groupe visible';
  assert (b->>'participated')::boolean and b->'count' = 'null'::jsonb, 'défaut participation : nombre masqué';
end $$;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-4000-8000-000000000002"}', false);
select public.set_group_sharing(tests.get('circle')::uuid, 'counter');
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-8000-000000000001"}', false);
do $$ declare b jsonb; begin
  select x into b from jsonb_array_elements(public.goal_progress(tests.get('goal2')::uuid)->'members') x where x->>'name' = 'Bilal';
  assert (b->>'count')::int = 70, 'mode counter : nombre visible';
end $$;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-4000-8000-000000000002"}', false);
select public.set_group_sharing(tests.get('circle')::uuid, 'nothing');
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-8000-000000000001"}', false);
do $$ begin
  assert not exists (select 1 from jsonb_array_elements(public.goal_progress(tests.get('goal2')::uuid)->'members') x where x->>'name' = 'Bilal'),
    'mode nothing : B absent de la liste';
end $$;

-- ===== RLS : événements bruts et topics Realtime
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-8000-000000000001"}', false);
do $$ begin
  assert (select count(*) from public.counter_events) = 0, 'A ne voit pas les événements bruts de B';
  assert private.can_read_goal_topic('goal:' || tests.get('goal2')), 'membre : topic lisible';
  assert not private.can_read_goal_topic('goal:pas-un-uuid'), 'topic malformé refusé';
end $$;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-4000-8000-000000000003"}', false);
do $$ begin
  assert not private.can_read_goal_topic('goal:' || tests.get('goal2')), 'extérieur : topic refusé';
  perform set_config('realtime.topic', 'goal:' || tests.get('goal2'), false);
  assert (select count(*) from realtime.messages) = 0, 'extérieur : aucun message Realtime visible';
end $$;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-4000-8000-000000000002"}', false);
do $$ begin
  perform set_config('realtime.topic', 'goal:' || tests.get('goal2'), false);
  assert (select count(*) from realtime.messages where event = 'progress') >= 1, 'membre : diffusion du total reçue';
  assert (select (payload->>'total')::int from realtime.messages where topic = 'goal:' || tests.get('goal2') order by id desc limit 1) = 70, 'payload = total';
  assert tests.throws($q$insert into realtime.messages (topic, extension, event, payload) values ('goal:$q$ || tests.get('goal2') || $q$', 'broadcast', 'progress', '{"total":999999}')$q$, 'row-level security'), 'faux total impossible';
  assert (select count(*) from public.counter_events) = 8, 'B voit ses 8 événements acceptés';
end $$;

-- ===== Quitter le groupe : plus d'envoi possible, l'historique reste dans le total
do $$ declare r jsonb; begin
  perform public.leave_group(tests.get('circle')::uuid);
  r := public.ingest_counter_events('b0000000-0000-4000-8000-00000000d001',
    jsonb_build_array(jsonb_build_object('seq', 30, 'goal_id', tests.get('goal2'), 'count', 1, 'at', now())));
  assert (r->'rejected'->0->>'reason') = 'objectif', 'ancien membre refusé';
end $$;

-- ===== Suppression de compte : appareils et événements effacés en cascade
do $$ begin perform public.delete_my_account(); end $$;
reset role;
do $$ begin
  assert (select count(*) from public.devices where user_id = 'bbbbbbbb-0000-4000-8000-000000000002') = 0, 'appareils supprimés';
  assert (select count(*) from public.counter_events where user_id = 'bbbbbbbb-0000-4000-8000-000000000002') = 0, 'événements supprimés';
  raise notice 'P1 : tous les tests SQL sont passés';
end $$;
