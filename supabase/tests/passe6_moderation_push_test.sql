-- Tests Passe 6 : file de modération plateforme (rôle serveur), jetons push et destinataires d'un message de groupe.
-- Personnes : F fondatrice, M modérateur du cercle, X, Y membres, Z extérieur, O modératrice plateforme ;
-- famille : P parent, K enfant, G invité.
create schema tests;
grant usage on schema tests to authenticated, service_role;
create table tests.ctx (k text primary key, v text not null);
grant select, insert, update, delete on tests.ctx to authenticated, service_role;
create function tests.state(q text) returns text language plpgsql as $$
begin execute q; return 'ok';
exception when others then return sqlstate; end $$;
create function tests.get(key text) returns text language sql stable as $$ select v from tests.ctx where k = key $$;
create function tests.as_user(u text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', (select v from tests.ctx where k = 'u_' || u))::text, false) $$;
create function tests.tok(u text) returns text language sql immutable as $$ select 'ExponentPushToken[test-' || lower(u) || '-0123456789]' $$;
grant execute on all functions in schema tests to authenticated, service_role;

insert into tests.ctx (k, v) values
  ('u_F', '30000000-0000-4000-8000-000000000001'), ('u_M', '30000000-0000-4000-8000-000000000002'),
  ('u_X', '30000000-0000-4000-8000-000000000003'), ('u_Y', '30000000-0000-4000-8000-000000000004'),
  ('u_Z', '30000000-0000-4000-8000-000000000005'), ('u_O', '30000000-0000-4000-8000-000000000006'),
  ('u_P', '30000000-0000-4000-8000-000000000007'), ('u_K', '30000000-0000-4000-8000-000000000008'),
  ('u_G', '30000000-0000-4000-8000-000000000009');
insert into auth.users (id, raw_user_meta_data) select v::uuid, jsonb_build_object('display_name', substr(k, 3)) from tests.ctx where k like 'u\_%';

set role authenticated;
select tests.as_user('F');
insert into tests.ctx select 'circle', public.create_circle('Halqa', 'Zikr du jeudi', null, 'Fatou')::text;
insert into tests.ctx select 'inv_c', code from public.create_invitation('circle', tests.get('circle')::uuid, 'member', 20, 7);
insert into tests.ctx select 'inv_m', code from public.create_invitation('circle', tests.get('circle')::uuid, 'moderator', 1, 7);
select tests.as_user('M'); select public.accept_invitation(tests.get('inv_m'), 'Moussa', false);
select tests.as_user('X'); select public.accept_invitation(tests.get('inv_c'), 'Xavier', false);
select tests.as_user('Y'); select public.accept_invitation(tests.get('inv_c'), 'Yacine', false);
select tests.as_user('P');
insert into tests.ctx select 'fam', public.create_family('Famille test', 'Papa')::text;
insert into tests.ctx select 'inv_k', code from public.create_invitation('family', tests.get('fam')::uuid, 'child', 1, 7);
insert into tests.ctx select 'inv_g', code from public.create_invitation('family', tests.get('fam')::uuid, 'guest', 1, 7);
select tests.as_user('K'); select public.accept_invitation(tests.get('inv_k'), 'Kadi', false);
select tests.as_user('G'); select public.accept_invitation(tests.get('inv_g'), 'Voisin', false);
reset role;
update public.circle_members set joined_at = now() - interval '1 day';
update public.family_members set joined_at = now() - interval '1 day';
set role authenticated;

-- ============================================================ Jetons push
do $$ begin
  perform tests.as_user('X');
  assert tests.state(format('select public.register_push_token(%L, %L, %L)', tests.tok('X'), 'ios', 'fr')) = 'ok', 'X enregistre son jeton';
  assert tests.state(format('select public.register_push_token(%L, %L, %L)', tests.tok('X'), 'ios', 'de')) = 'ok', 'ré-enregistrement idempotent';
  assert tests.state($q$select public.register_push_token('pas-un-jeton-expo', 'ios', 'fr')$q$) = '23514', 'jeton invalide refusé';
  assert tests.state(format('select public.register_push_token(%L, %L, %L)', tests.tok('X'), 'web', 'fr')) = '23514', 'plateforme inconnue refusée';
  assert (select count(*) from public.device_push_tokens) = 1, 'X voit sa seule ligne';
  assert (select lang from public.device_push_tokens) = 'de', 'langue mise à jour';
  assert tests.state('select token from public.device_push_tokens') = '42501', 'le jeton lui-même n''est pas relisible';
  assert tests.state(format($q$insert into public.device_push_tokens (user_id, token, platform) values (auth.uid(), %L, 'ios')$q$, tests.tok('X2'))) = '42501', 'insert direct refusé';
  assert tests.state(format('select public.group_push_recipients(%L)', gen_random_uuid())) = '42501', 'destinataires : pas pour l''app';
  assert tests.state(format('select public.disable_push_token(%L)', tests.tok('X'))) = '42501', 'désactivation : pas pour l''app';
  perform tests.as_user('Z');
  assert (select count(*) from public.device_push_tokens) = 0, 'Z ne voit pas le jeton de X';
  assert tests.state(format('select public.unregister_push_token(%L)', tests.tok('X'))) = 'ok', 'Z ne peut pas supprimer le jeton de X (sans effet)';
end $$;
select tests.as_user('F'); select public.register_push_token(tests.tok('F'), 'android', 'fr');
select tests.as_user('M'); select public.register_push_token(tests.tok('M'), 'ios', 'en');
select tests.as_user('Y'); select public.register_push_token(tests.tok('Y'), 'ios', 'ar');
select tests.as_user('Z'); select public.register_push_token(tests.tok('Z'), 'ios', 'fr');
select tests.as_user('P'); select public.register_push_token(tests.tok('P'), 'ios', 'fr');
select tests.as_user('K'); select public.register_push_token(tests.tok('K'), 'ios', 'fr');
select tests.as_user('G'); select public.register_push_token(tests.tok('G'), 'ios', 'fr');

select tests.as_user('X');
select public.post_group_message('circle', tests.get('circle')::uuid, 'Salam le cercle', 'text', null, gen_random_uuid());
insert into tests.ctx select 'msg_x', id::text from public.group_messages where sender_id = auth.uid() limit 1;
select tests.as_user('P');
select public.post_group_message('family', tests.get('fam')::uuid, 'Bonne nuit', 'text', null, gen_random_uuid());
insert into tests.ctx select 'msg_p', id::text from public.group_messages where sender_id = auth.uid() limit 1;
select tests.as_user('G');
select public.post_group_message('family', tests.get('fam')::uuid, 'Merci', 'text', null, gen_random_uuid());
insert into tests.ctx select 'msg_g', id::text from public.group_messages where sender_id = auth.uid() limit 1;

reset role;
set role service_role;
do $$ declare t text[]; begin
  select array_agg(token order by token) into t from public.group_push_recipients(tests.get('msg_x')::uuid);
  assert t = array[tests.tok('F'), tests.tok('M'), tests.tok('Y')], 'cercle : membres sauf l''auteur et l''extérieur, obtenu ' || t::text;
  assert (select group_name from public.group_push_recipients(tests.get('msg_x')::uuid) limit 1) = 'Halqa', 'nom du groupe';
  select array_agg(token order by token) into t from public.group_push_recipients(tests.get('msg_p')::uuid);
  assert t = array[tests.tok('G'), tests.tok('K')], 'famille : le parent notifie enfant et invité, obtenu ' || t::text;
  select array_agg(token order by token) into t from public.group_push_recipients(tests.get('msg_g')::uuid);
  assert t = array[tests.tok('P')], 'invité : jamais l''enfant, obtenu ' || t::text;
end $$;
reset role;
set role authenticated;
select tests.as_user('M'); select public.set_group_muted('circle', tests.get('circle')::uuid, true);
select tests.as_user('Y'); select public.block_user(tests.get('u_X')::uuid);
reset role;
set role service_role;
do $$ declare t text[]; begin
  select array_agg(token order by token) into t from public.group_push_recipients(tests.get('msg_x')::uuid);
  assert t = array[tests.tok('F')], 'sourdine et blocage respectés, obtenu ' || t::text;
  perform public.disable_push_token(tests.tok('F'));
  assert (select count(*) from public.group_push_recipients(tests.get('msg_x')::uuid)) = 0, 'jeton désactivé exclu';
end $$;
reset role;
update public.parental_controls set messaging = 'none' where family_id = tests.get('fam')::uuid;
set role service_role;
do $$ begin
  assert not exists (select 1 from public.group_push_recipients(tests.get('msg_p')::uuid) where token = tests.tok('K')), 'enfant « Aucun » : pas de notification';
end $$;
reset role;

-- ============================================================ File de modération plateforme
set role authenticated;
select tests.as_user('Y');
insert into tests.ctx select 'rep', public.report_content('group_message', tests.get('msg_x')::uuid, 'harassment', 'Insistant', null, null, false)::text;
do $$ begin
  perform tests.as_user('M');   -- modérateur du cercle, PAS modérateur plateforme
  assert tests.state('select * from public.moderation_queue_list()') = '42501', 'file réservée au rôle serveur';
  assert tests.state(format($q$select public.moderation_set_status(%L, 'dismissed')$q$, tests.get('rep'))) = '42501', 'statut : réservé';
  assert tests.state(format('select public.platform_delete_group_message(%L)', tests.get('rep'))) = '42501', 'suppression plateforme : réservée';
end $$;
reset role;
insert into private.app_roles (user_id, role) values (tests.get('u_O')::uuid, 'moderator');
set role authenticated;
do $$ declare r record; begin
  perform tests.as_user('O');
  assert (select count(*) from public.moderation_queue_list()) = 1, 'O voit 1 signalement en attente';
  select * into r from public.moderation_queue_list() limit 1;
  assert r.reason = 'harassment' and r.target_type = 'group_message' and r.target_user_id = tests.get('u_X')::uuid, 'contenu de la ligne';
  assert (r.snapshot ->> 'body') = 'Salam le cercle', 'instantané du message';
  assert tests.state($q$select reporter_id from public.moderation_queue_list()$q$) = '42703', 'identité de la personne qui signale jamais renvoyée';
  assert tests.state($q$select * from public.moderation_queue_list('inconnu')$q$) = '23514', 'statut de filtre inconnu refusé';
  perform public.moderation_set_status(tests.get('rep')::uuid, 'reviewing', null);
  perform public.platform_delete_group_message(tests.get('rep')::uuid);
  perform public.moderation_set_status(tests.get('rep')::uuid, 'actioned', 'Message supprimé');
  assert (select count(*) from public.moderation_queue_list()) = 0, 'plus rien en attente';
  assert (select count(*) from public.moderation_queue_list('actioned')) = 1, 'traité';
  assert (select resolution from public.moderation_queue_list('actioned')) = 'Message supprimé', 'résolution enregistrée';
end $$;
reset role;
do $$ begin
  assert (select deleted_at is not null and body = '' from public.group_messages where id = tests.get('msg_x')::uuid), 'message effacé pour tous';
  assert (select count(*) from private.moderation_actions where report_id = tests.get('rep')::uuid) = 3, 'journal : 2 statuts + 1 suppression';
  assert (select snapshot ->> 'body' from private.moderation_actions where action = 'platform_delete_group_message') = 'Salam le cercle', 'copie au journal';
  -- Conservation : jeton non revu depuis 90 jours supprimé.
  update public.device_push_tokens set last_seen_at = now() - interval '91 days' where token = tests.tok('Z');
  assert private.purge_push_tokens() = 1, 'purge des jetons anciens';
end $$;
