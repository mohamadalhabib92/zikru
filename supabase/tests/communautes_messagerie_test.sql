-- Tests lots A + B (messagerie, invitations, limite 4 personnes, blocage, signalement, filtre, purge).
-- Chaque ASSERT qui échoue lève une exception et arrête la suite. Lancer : npm run test:sql
-- Personnes : P parent, A adulte, G invité (famille), K enfant ; F fondateur, M modérateur, X, Y, Z membres de cercle.

create schema tests;
grant usage on schema tests to authenticated;
create table tests.ctx (k text primary key, v text not null);
grant select, insert, update, delete on tests.ctx to authenticated;
-- SQLSTATE levé par la requête, ou 'ok'.
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
  ('u_F', '20000000-0000-4000-8000-000000000001'), ('u_M', '20000000-0000-4000-8000-000000000002'),
  ('u_X', '20000000-0000-4000-8000-000000000003'), ('u_Y', '20000000-0000-4000-8000-000000000004'),
  ('u_Z', '20000000-0000-4000-8000-000000000005');
insert into auth.users (id, raw_user_meta_data) select v::uuid, jsonb_build_object('display_name', substr(k, 3)) from tests.ctx where k like 'u\_%';
-- Seuils de test plus bas (les valeurs réelles sont dans app_config).
update public.app_config set value = '{"max": 100, "window_s": 3600}' where key in ('rate.message', 'rate.message_burst');

-- ============================================================ Famille : contrôle parental
set role authenticated;
select tests.as_user('P');
insert into tests.ctx select 'fam', public.create_family('Famille test', 'Papa')::text;
insert into tests.ctx select 'inv_k', code from public.create_invitation('family', tests.get('fam')::uuid, 'child', 1, 7);
insert into tests.ctx select 'inv_a', code from public.create_invitation('family', tests.get('fam')::uuid, 'adult', 1, 7);
insert into tests.ctx select 'inv_g', code from public.create_invitation('family', tests.get('fam')::uuid, 'guest', 1, 7);
do $$ begin
  assert tests.state('select code from public.invitations') = '42703', 'plus de colonne code en clair';
  assert tests.state('select code_hash from public.invitations') = '42501', 'hash non lisible par le client';
  assert (select count(*) from public.invitations) = 3, 'le parent voit ses invitations';
end $$;
select tests.as_user('K'); select public.accept_invitation(tests.get('inv_k'), 'Kadi', false);
select tests.as_user('A'); select public.accept_invitation(lower(tests.get('inv_a')), 'Tata', false);   -- casse ignorée
select tests.as_user('G'); select public.accept_invitation(tests.get('inv_g'), 'Voisin', false);
do $$ begin
  assert (public.accept_invitation(tests.get('inv_g'), 'Voisin', false) ->> 'error') = 'invalid', 'code épuisé = invalid sans exception';
  assert (public.preview_invitation('XXXXXXXXXX') ->> 'valid')::boolean = false, 'code inconnu';
end $$;

reset role;
do $$ begin
  assert (select messaging from public.parental_controls pc join public.family_members m on m.id = pc.child_member_id
          where m.user_id = tests.get('u_K')::uuid) = 'parents', 'défaut parental = parents seulement';
end $$;
set role authenticated;

-- Défaut « parents » : K ↔ P oui ; K ↔ A, K ↔ G non.
reset role;
create function tests.send(fr text, dest text, body text default 'Bravo !') returns text language plpgsql as $$
begin
  perform tests.as_user(fr);
  return tests.state(format($q$insert into public.encouragements (scope_type, family_id, sender_id, recipient_id, kind, body)
    values ('family', %L, %L, %L, 'bravo', %L)$q$, tests.get('fam'), tests.get('u_' || fr), tests.get('u_' || dest), body));
end $$;
create function tests.csend(fr text, dest text, body text default 'Bravo !') returns text language plpgsql as $$
begin
  perform tests.as_user(fr);
  return tests.state(format($q$insert into public.encouragements (scope_type, circle_id, sender_id, recipient_id, kind, body)
    values ('circle', %L, %L, %L, 'bravo', %L)$q$, tests.get('circle'), tests.get('u_' || fr), tests.get('u_' || dest), body));
end $$;
grant execute on all functions in schema tests to authenticated;
set role authenticated;
do $$ begin
  assert tests.send('K', 'P') = 'ok', 'enfant → parent';
  assert tests.send('P', 'K') = 'ok', 'parent → enfant';
  assert tests.send('K', 'A') = '42501', 'enfant → adulte refusé (parents)';
  assert tests.send('A', 'K') = '42501', 'adulte → enfant refusé (parents)';
  assert tests.send('G', 'K') = '42501', 'invité → enfant refusé';
  assert tests.send('A', 'G') = 'ok', 'adultes entre eux';
end $$;

-- « Famille » : K ↔ A oui, mais jamais avec l'invité.
select tests.as_user('P');
update public.parental_controls set messaging = 'family' where family_id = tests.get('fam')::uuid;
do $$ begin
  assert tests.send('A', 'K') = 'ok', 'adulte → enfant (famille)';
  assert tests.send('K', 'A') = 'ok', 'enfant → adulte (famille)';
  assert tests.send('G', 'K') = '42501', 'invité → enfant toujours refusé';
  assert tests.send('K', 'G') = '42501', 'enfant → invité toujours refusé';
end $$;

-- « Aucun » : ni envoi ni réception, même avec les parents ; l'enfant ne lit plus rien, le parent supervise.
select tests.as_user('P');
update public.parental_controls set messaging = 'none' where family_id = tests.get('fam')::uuid;
do $$ begin
  assert tests.send('K', 'P') = '42501', 'Aucun : enfant → parent refusé';
  assert tests.send('P', 'K') = '42501', 'Aucun : parent → enfant refusé';
  assert tests.send('A', 'K') = '42501', 'Aucun : adulte → enfant refusé';
  perform tests.as_user('K');
  assert (select count(*) from public.encouragements) = 0, 'Aucun : l''enfant ne voit plus aucun message';
  perform tests.as_user('P');
  assert (select count(*) from public.encouragements where sender_id = tests.get('u_K')::uuid or recipient_id = tests.get('u_K')::uuid) = 4,
    'le parent garde la supervision';
end $$;
-- Retour à « parents » : l'enfant revoit seulement ses échanges avec les parents.
update public.parental_controls set messaging = 'parents' where family_id = tests.get('fam')::uuid;
do $$ begin
  perform tests.as_user('K');
  assert (select count(*) from public.encouragements) = 2, 'parents : seulement les échanges avec P';
end $$;

-- ============================================================ Cercle : limite 4 personnes, invitations
select tests.as_user('F');
insert into tests.ctx select 'circle', public.create_circle('Halqa', 'Zikr du jeudi', null, 'Fatou')::text;
insert into tests.ctx select 'inv_c', code from public.create_invitation('circle', tests.get('circle')::uuid, 'member', 20, 7);
insert into tests.ctx select 'inv_m', code from public.create_invitation('circle', tests.get('circle')::uuid, 'moderator', 1, 7);
do $$ declare c jsonb; begin
  c := public.group_capacity(tests.get('circle')::uuid);
  assert (c ->> 'limit')::int = 4 and (c ->> 'members')::int = 1, 'gratuit : 4 personnes, créateur inclus';
end $$;
select tests.as_user('M'); select public.accept_invitation(tests.get('inv_m'), 'Moussa', false);
do $$ begin
  assert tests.state(format($q$select public.create_invitation('circle', %L, 'moderator', 1, 7)$q$, tests.get('circle'))) = '42501',
    'un modérateur ne crée pas d''invitation modérateur';
  assert tests.state(format($q$select public.create_invitation('circle', %L, 'member', 1, 7)$q$, tests.get('circle'))) = 'ok',
    'un modérateur invite des membres';
end $$;
select tests.as_user('X');
do $$ begin
  assert tests.state(format($q$select public.accept_invitation(%L, 'Moussa', false)$q$, tests.get('inv_c'))) = 'ZKN01', 'nom déjà pris dans le cercle';
  assert tests.state(format($q$select public.accept_invitation(%L, 'connard', false)$q$, tests.get('inv_c'))) = 'ZKF01', 'nom filtré';
end $$;
select public.accept_invitation(tests.get('inv_c'), 'Xavier', false);
select tests.as_user('Y'); select public.accept_invitation(tests.get('inv_c'), 'Yacine', false);
select tests.as_user('Z');
do $$ declare p jsonb; begin
  p := public.preview_invitation(tests.get('inv_c'));
  assert (p ->> 'full')::boolean and (p ->> 'max_members')::int = 4, 'aperçu : complet à 4';
  assert tests.state(format($q$select public.accept_invitation(%L, 'Zakaria', false)$q$, tests.get('inv_c'))) = 'ZKG01', '5e personne refusée (ZKG01)';
end $$;

-- Limite configurable côté serveur, sans publier l'app.
reset role;
insert into public.app_config (key, value) values ('limits.free.max_group_members_created', '5');
set role authenticated;
select tests.as_user('Z');
do $$ begin
  assert tests.state(format($q$select public.accept_invitation(%L, 'Zakaria', false)$q$, tests.get('inv_c'))) = 'ok', 'limite relevée à 5 par app_config';
end $$;
reset role;
delete from public.app_config where key = 'limits.free.max_group_members_created';
set role authenticated;

-- Révocation définitive.
select tests.as_user('F');
insert into tests.ctx select 'inv_r', id::text from public.invitations where circle_id = tests.get('circle')::uuid and role = 'member' and created_by = auth.uid();
update public.invitations set revoked_at = now() where id = tests.get('inv_r')::uuid;
do $$ begin
  assert tests.state(format($q$update public.invitations set revoked_at = null where id = %L$q$, tests.get('inv_r'))) = '42501', 'pas de « dé-révocation »';
  assert (public.preview_invitation(tests.get('inv_c')) ->> 'valid')::boolean = false, 'code révoqué invalide';
end $$;

-- ============================================================ Zikr en direct : nom serveur, cadence
select tests.as_user('X');
with s as (insert into public.zikr_sessions (scope_type, circle_id, started_by, title)
  values ('circle', tests.get('circle')::uuid, auth.uid(), 'Zikr du soir') returning id)
insert into tests.ctx select 'ses', id::text from s;
insert into public.zikr_session_counts (session_id, user_id, display_name, count)
  values (tests.get('ses')::uuid, auth.uid(), 'Fatou (fondatrice)', 999999);
do $$ declare r public.zikr_session_counts; begin
  select * into r from public.zikr_session_counts where session_id = tests.get('ses')::uuid and user_id = auth.uid();
  assert r.display_name = 'Xavier', 'nom posé par le serveur (pas d''usurpation)';
  assert r.count <= 300, 'compteur borné à une cadence humaine : ' || r.count;
  assert tests.state(format($q$update public.zikr_session_counts set count = 50 where session_id = %L$q$, tests.get('ses'))) = 'ok', 'baisse permise';
end $$;

-- ============================================================ Blocage, signalement, filtre
do $$ begin
  assert tests.csend('X', 'Y') = 'ok', 'X → Y';
  assert tests.csend('Y', 'X') = 'ok', 'Y → X';
  assert tests.csend('X', 'Y', 'Va voir https://exemple.com') = 'ZKF01', 'lien refusé';
  assert tests.csend('X', 'Y', 'Espèce de Connard !') = 'ZKF01', 'terme interdit (casse, ponctuation)';
  assert tests.csend('X', 'Y', 'Bravo, tu es constant') = 'ok', 'pas de faux positif sur un mot qui contient « con »';
end $$;
select tests.as_user('Y');
insert into tests.ctx select 'msg', id::text from public.encouragements where sender_id = tests.get('u_X')::uuid limit 1;
insert into tests.ctx select 'rep', public.report_content('message', tests.get('msg')::uuid, 'harassment', 'Insistant', null, null, true)::text;
do $$ begin
  assert public.report_content('message', tests.get('msg')::uuid, 'harassment') = tests.get('rep')::uuid, 'pas de doublon de signalement';
  assert (select count(*) from public.reports) = 1, 'le signaleur voit son signalement';
  assert tests.state('select snapshot from public.reports') = '42501', 'l''instantané reste côté modération';
  assert (select count(*) from public.blocks) = 1 and (select blocked_name from public.blocks) = 'X', 'blocage créé avec le signalement';
  assert (select count(*) from public.encouragements) = 0, 'bloqué : messages masqués pour Y';
  assert tests.csend('X', 'Y') = '42501', 'bloqué : X ne peut plus écrire à Y';
  assert tests.csend('Y', 'X') = '42501', 'bloqué : Y ne peut plus écrire à X';
  perform tests.as_user('X');
  assert (select count(*) from public.encouragements where recipient_id = tests.get('u_Y')::uuid or sender_id = tests.get('u_Y')::uuid) = 0, 'masqué dans les deux sens';
  assert (select count(*) from public.blocks) = 0, 'X ne voit pas qu''il est bloqué';
  assert (select count(*) from public.reports) = 0, 'X ne voit pas le signalement';
  assert tests.state(format($q$select public.report_content('message', %L, 'nope')$q$, tests.get('msg'))) = '23514', 'motif inconnu refusé';
  perform tests.as_user('Z');
  assert tests.state(format($q$select public.report_content('message', %L, 'spam')$q$, tests.get('msg'))) = '42501', 'pas de signalement d''un message non visible';
  assert tests.state(format($q$select public.block_user(%L)$q$, tests.get('u_K'))) = '42501', 'pas de blocage d''un inconnu';
end $$;
select tests.as_user('Y');
delete from public.blocks where blocked_id = tests.get('u_X')::uuid;
do $$ begin
  assert tests.csend('Y', 'X') = 'ok', 'débloqué';
  assert (select count(*) from public.encouragements where sender_id = tests.get('u_X')::uuid) >= 1, 'messages à nouveau visibles';
end $$;

-- Suspension par la modération.
reset role;
insert into private.user_suspensions (user_id, reason) values (tests.get('u_X')::uuid, 'test');
set role authenticated;
do $$ begin assert tests.csend('X', 'Y') = '42501', 'compte suspendu : envoi refusé'; end $$;
reset role;
delete from private.user_suspensions;

-- ============================================================ Débit
update public.app_config set value = '{"max": 2, "window_s": 60}' where key = 'rate.message_burst';
set role authenticated;
do $$ declare s text; begin
  perform tests.csend('M', 'F', 'Salam 1'); perform tests.csend('M', 'F', 'Salam 2');
  s := tests.csend('M', 'F', 'Salam 3');
  assert s = 'ZKR01', 'débit dépassé (ZKR01), obtenu ' || s;
end $$;
reset role;
update public.app_config set value = '{"max": 3, "window_s": 3600}' where key = 'rate.invite_attempt';
delete from private.rate_counters where action = 'invite_attempt';
set role authenticated;
select tests.as_user('Z');
do $$ declare s text; begin
  perform public.preview_invitation('AAAAAAAAAA'); perform public.preview_invitation('BBBBBBBBBB');
  assert (public.accept_invitation('CCCCCCCCCC', 'Z', false) ->> 'error') = 'invalid', '3e essai compté';
  s := tests.state($q$select public.preview_invitation('DDDDDDDDDD')$q$);
  assert s = 'ZKR01', 'force brute bloquée, obtenu ' || s;
end $$;

-- ============================================================ Purge
reset role;
update public.encouragements set created_at = now() - interval '400 days' where sender_id = tests.get('u_M')::uuid;
update public.zikr_sessions set started_at = now() - interval '2 days';
do $$ declare r jsonb; begin
  r := private.purge_expired();
  assert (r ->> 'messages')::int >= 1, 'messages anciens purgés';
  assert (r ->> 'live_closed')::int = 1, 'session oubliée terminée';
  assert (select status from public.zikr_sessions limit 1) = 'ended', 'session terminée';
  assert tests.state('set role authenticated; select private.purge_expired()') = '42501', 'purge réservée au serveur';
end $$;
reset role;
-- Suppression de compte : les données liées suivent (cascade), y compris blocages et signalements.
delete from auth.users where id = tests.get('u_Y')::uuid;
do $$ begin
  assert (select count(*) from public.blocks where blocker_id = tests.get('u_Y')::uuid) = 0, 'blocages supprimés avec le compte';
  assert (select reporter_id from public.reports limit 1) is null, 'signalement anonymisé à la suppression du compte';
end $$;
