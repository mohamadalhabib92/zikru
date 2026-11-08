-- Tests Passe 5 : discussion de groupe (famille / cercle), règles enfant, blocage, signalement, suppression, non lus, purge.
-- Personnes : P parent, A adulte, G invité, K enfant, E1-E3 adultes (famille) ; F fondatrice, M modérateur, X, Y membres, Z extérieur.
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
-- Envoi par u dans la famille (f) ou le cercle (c) ; renvoie le SQLSTATE ou 'ok'.
create function tests.post(u text, sc text, body text, kind text default 'text', reply text default null) returns text language plpgsql as $$
begin
  perform tests.as_user(u);
  return tests.state(format('select public.post_group_message(%L, %L, %L, %L, %L, gen_random_uuid())',
    case sc when 'f' then 'family' else 'circle' end, tests.get(case sc when 'f' then 'fam' else 'circle' end), body, kind, reply));
end $$;
create function tests.seen(u text, sc text) returns int language plpgsql as $$
begin
  perform tests.as_user(u);
  return (select count(*) from public.group_messages where coalesce(family_id, circle_id) = tests.get(case sc when 'f' then 'fam' else 'circle' end)::uuid);
end $$;
grant execute on all functions in schema tests to authenticated;

insert into tests.ctx (k, v) values
  ('u_P', '10000000-0000-4000-8000-000000000001'), ('u_A', '10000000-0000-4000-8000-000000000002'),
  ('u_G', '10000000-0000-4000-8000-000000000003'), ('u_K', '10000000-0000-4000-8000-000000000004'),
  ('u_E1', '10000000-0000-4000-8000-000000000005'), ('u_E2', '10000000-0000-4000-8000-000000000006'),
  ('u_E3', '10000000-0000-4000-8000-000000000007'),
  ('u_F', '20000000-0000-4000-8000-000000000001'), ('u_M', '20000000-0000-4000-8000-000000000002'),
  ('u_X', '20000000-0000-4000-8000-000000000003'), ('u_Y', '20000000-0000-4000-8000-000000000004'),
  ('u_Z', '20000000-0000-4000-8000-000000000005');
insert into auth.users (id, raw_user_meta_data) select v::uuid, jsonb_build_object('display_name', substr(k, 3)) from tests.ctx where k like 'u\_%';

-- ============================================================ Famille (7 personnes : pas de limite pour les familles)
set role authenticated;
select tests.as_user('P');
insert into tests.ctx select 'fam', public.create_family('Famille test', 'Papa')::text;
insert into tests.ctx select 'inv_k', code from public.create_invitation('family', tests.get('fam')::uuid, 'child', 1, 7);
insert into tests.ctx select 'inv_a', code from public.create_invitation('family', tests.get('fam')::uuid, 'adult', 10, 7);
insert into tests.ctx select 'inv_g', code from public.create_invitation('family', tests.get('fam')::uuid, 'guest', 1, 7);
select tests.as_user('K'); select public.accept_invitation(tests.get('inv_k'), 'Kadi', false);
select tests.as_user('A'); select public.accept_invitation(tests.get('inv_a'), 'Tata', false);
select tests.as_user('G'); select public.accept_invitation(tests.get('inv_g'), 'Voisin', false);
select tests.as_user('E1'); select public.accept_invitation(tests.get('inv_a'), 'Oncle', false);
select tests.as_user('E2'); select public.accept_invitation(tests.get('inv_a'), 'Tante', false);
select tests.as_user('E3'); select public.accept_invitation(tests.get('inv_a'), 'Cousin', false);
do $$ begin
  perform tests.as_user('P');
  assert (select count(*) from public.family_members where family_id = tests.get('fam')::uuid) = 7, 'famille : 7 personnes acceptées (pas de limite à 4)';
end $$;

do $$ begin
  assert tests.post('P', 'f', 'Salam à tous') = 'ok', 'parent écrit';
  assert tests.post('A', 'f', 'Bonne soirée') = 'ok', 'adulte écrit';
  assert tests.post('G', 'f', 'Merci pour l''accueil') = 'ok', 'invité écrit';
  assert tests.post('K', 'f', 'Coucou papa', 'salam') = 'ok', 'enfant (défaut Parents) écrit';
  -- Défaut « Parents » : l'enfant ne lit que ses parents ; seuls les parents le lisent.
  assert tests.seen('K', 'f') = 2, 'enfant : son message + celui du parent, obtenu ' || tests.seen('K', 'f');
  assert tests.seen('P', 'f') = 4, 'parent : tout';
  assert tests.seen('A', 'f') = 3, 'adulte : pas le message de l''enfant';
  assert tests.seen('G', 'f') = 3, 'invité : jamais un enfant';
  perform tests.as_user('K');
  assert (public.group_chat_rights('family', tests.get('fam')::uuid) ->> 'audience') = 'parents', 'droits : public = parents';
  assert (select sender_name from public.group_messages where sender_id = auth.uid()) = 'Kadi', 'nom posé par le serveur';
end $$;

-- Écriture directe interdite (seulement par la fonction contrôlée).
do $$ begin
  perform tests.as_user('A');
  assert tests.state(format($q$insert into public.group_messages (scope_type, family_id, sender_id, body, client_id)
    values ('family', %L, auth.uid(), 'x', gen_random_uuid())$q$, tests.get('fam'))) = '42501', 'insert direct refusé';
  assert tests.state($q$update public.group_messages set body = 'modifié'$q$) = '42501', 'update direct refusé';
  assert tests.state($q$select deleted_by from public.group_messages$q$) = '42501', 'auteur d''une suppression non lisible';
end $$;

-- « Famille » : adultes ↔ enfant oui, invité ↔ enfant jamais.
reset role;
update public.parental_controls set messaging = 'family' where family_id = tests.get('fam')::uuid;
set role authenticated;
do $$ begin
  assert tests.seen('A', 'f') = 4, 'famille : l''adulte lit l''enfant';
  assert tests.seen('G', 'f') = 3, 'famille : l''invité ne lit toujours pas l''enfant';
  assert tests.seen('K', 'f') = 3, 'famille : l''enfant lit P, A et lui-même, pas l''invité';
end $$;

-- « Aucun » : l'enfant ne lit ni n'écrit plus rien.
reset role;
update public.parental_controls set messaging = 'none' where family_id = tests.get('fam')::uuid;
set role authenticated;
do $$ begin
  assert tests.post('K', 'f', 'Encore moi') = '42501', 'Aucun : enfant ne peut plus écrire';
  assert tests.seen('K', 'f') = 0, 'Aucun : l''enfant ne voit rien';
  perform tests.as_user('K');
  assert not (public.group_chat_rights('family', tests.get('fam')::uuid) ->> 'can_post')::boolean, 'droits : can_post = false';
  assert tests.seen('A', 'f') = 3, 'Aucun : les messages de l''enfant ne sont plus lus par les adultes';
  assert tests.seen('P', 'f') = 3, 'Aucun : ni par le parent (couper = couper)';
end $$;
reset role;
update public.parental_controls set messaging = 'parents' where family_id = tests.get('fam')::uuid;
set role authenticated;

-- Filtre et liens : refusés dans une famille avec un enfant (défaut filter.group_links = minors).
do $$ begin
  assert tests.post('A', 'f', 'Espèce de connard') = 'ZKF01', 'terme interdit';
  assert tests.post('A', 'f', 'Regarde https://exemple.com') = 'ZKF01', 'lien refusé (famille avec enfant)';
  assert tests.post('A', 'f', '') = '23514', 'message vide refusé';
  assert tests.post('A', 'f', repeat('a', 2001)) = '23514', 'message trop long refusé';
  assert tests.post('A', 'f', 'x', 'pub') = '23514', 'type inconnu refusé';
end $$;

-- Renvoi hors ligne : même client_id = même message.
do $$ declare a jsonb; b jsonb; begin
  perform tests.as_user('A');
  a := public.post_group_message('family', tests.get('fam')::uuid, 'Renvoi', 'text', null, '30000000-0000-4000-8000-0000000000aa');
  b := public.post_group_message('family', tests.get('fam')::uuid, 'Renvoi', 'text', null, '30000000-0000-4000-8000-0000000000aa');
  assert a ->> 'id' = b ->> 'id', 'idempotent';
  assert (select count(*) from public.group_messages where body = 'Renvoi') = 1, 'un seul message';
  assert not (a ? 'deleted_by'), 'deleted_by jamais renvoyé';
end $$;

-- ============================================================ Cercle
select tests.as_user('F');
insert into tests.ctx select 'circle', public.create_circle('Halqa', 'Zikr du jeudi', null, 'Fatou')::text;
insert into tests.ctx select 'inv_c', code from public.create_invitation('circle', tests.get('circle')::uuid, 'member', 20, 7);
insert into tests.ctx select 'inv_m', code from public.create_invitation('circle', tests.get('circle')::uuid, 'moderator', 1, 7);
select tests.as_user('M'); select public.accept_invitation(tests.get('inv_m'), 'Moussa', false);
select tests.as_user('X'); select public.accept_invitation(tests.get('inv_c'), 'Xavier', false);
select tests.as_user('Y'); select public.accept_invitation(tests.get('inv_c'), 'Yacine', false);
reset role;
update public.circle_members set joined_at = now() - interval '1 day';   -- même transaction de test : arrivée avant les messages
set role authenticated;
do $$ begin
  assert tests.post('X', 'c', 'Salam le cercle') = 'ok', 'X écrit';
  assert tests.post('Y', 'c', 'wa alaykum salam') = 'ok', 'Y écrit';
  assert tests.post('F', 'c', 'Lien utile : https://exemple.org') = 'ok', 'lien permis dans un cercle d''adultes (mode minors)';
  assert tests.post('Z', 'c', 'intrus') = '42501', 'non-membre : pas d''envoi';
  assert tests.seen('Z', 'c') = 0, 'non-membre : rien de visible';
  assert tests.seen('M', 'c') = 3, 'membre : tout le fil';
  -- Citation : seulement un message du même groupe.
  perform tests.as_user('X');
  insert into tests.ctx select 'msg_x', id::text from public.group_messages where sender_id = auth.uid() limit 1;
  assert tests.post('Y', 'c', 'Amin', 'text', tests.get('msg_x')) = 'ok', 'réponse à X';
  perform tests.as_user('A');
  insert into tests.ctx select 'msg_a', id::text from public.group_messages where sender_id = auth.uid() limit 1;
  assert tests.post('X', 'c', 'citation d''ailleurs', 'text', tests.get('msg_a')) = '42501', 'citation d''un autre groupe refusée';
end $$;

-- Non lus et sourdine.
do $$ declare n int; begin
  perform tests.as_user('M');
  select unread into n from public.group_unread() where scope_id = tests.get('circle')::uuid;
  assert n = 4, 'M : 4 non lus, obtenu ' || n;
  perform public.mark_group_read('circle', tests.get('circle')::uuid);
  select unread into n from public.group_unread() where scope_id = tests.get('circle')::uuid;
  assert n = 0, 'lu → 0';
  perform public.set_group_muted('circle', tests.get('circle')::uuid, true);
  assert (select muted from public.group_unread() where scope_id = tests.get('circle')::uuid), 'sourdine enregistrée';
  assert (select count(*) from public.group_prefs) = 1, 'M ne voit que ses préférences';
  perform tests.as_user('X');
  select unread into n from public.group_unread() where scope_id = tests.get('circle')::uuid;
  assert n = 3, 'X : ses propres messages ne comptent pas ; écrire vaut lecture, obtenu ' || n;
  assert tests.state(format($q$select public.mark_group_read('circle', %L)$q$, tests.get('fam'))) = '42501', 'pas de préférence hors de ses groupes';
end $$;

-- Signalement + blocage : Y signale le message de X et bloque X.
select tests.as_user('Y');
insert into tests.ctx select 'rep', public.report_content('group_message', tests.get('msg_x')::uuid, 'harassment', 'Insistant', null, null, true)::text;
do $$ begin
  assert public.report_content('group_message', tests.get('msg_x')::uuid, 'harassment') = tests.get('rep')::uuid, 'pas de doublon';
  assert (select count(*) from public.group_messages where sender_id = tests.get('u_X')::uuid) = 0, 'bloqué : X masqué pour Y';
  perform tests.as_user('X');
  assert (select count(*) from public.group_messages where sender_id = tests.get('u_Y')::uuid) = 0, 'masqué dans les deux sens';
  perform tests.as_user('Z');
  assert tests.state(format($q$select public.report_content('group_message', %L, 'spam')$q$, tests.get('msg_x'))) = '42501', 'pas de signalement hors du groupe';
end $$;
reset role;
do $$ begin
  assert (select snapshot ->> 'body' from public.reports where id = tests.get('rep')::uuid) = 'Salam le cercle', 'instantané conservé';
  assert (select target_user_id from public.reports where id = tests.get('rep')::uuid) = tests.get('u_X')::uuid, 'auteur identifié';
end $$;
set role authenticated;

-- Supprimer pour tous : auteur ou modération ; journal côté équipe pour la modération.
do $$ begin
  perform tests.as_user('M');
  insert into tests.ctx select 'msg_y', id::text from public.group_messages where sender_id = tests.get('u_Y')::uuid and reply_to is null limit 1;
  perform tests.as_user('X');
  assert tests.state(format('select public.delete_group_message(%L)', tests.get('msg_y'))) = '42501', 'X ne supprime pas le message de Y';
  perform tests.as_user('M');
  assert tests.state(format('select public.delete_group_message(%L)', tests.get('msg_y'))) = 'ok', 'le modérateur supprime';
  assert (select body = '' and deleted_at is not null from public.group_messages where id = tests.get('msg_y')::uuid), 'texte effacé pour tous';
  perform tests.as_user('X');
  assert tests.state(format('select public.delete_group_message(%L)', tests.get('msg_x'))) = 'ok', 'X supprime son message';
end $$;
reset role;
do $$ begin
  assert (select count(*) from private.moderation_actions) = 1, 'une seule action de modération journalisée (pas l''auto-suppression)';
  assert (select snapshot ->> 'body' from private.moderation_actions) = 'wa alaykum salam', 'copie gardée pour l''équipe';
end $$;

-- Suspension.
insert into private.user_suspensions (user_id, reason) values (tests.get('u_F')::uuid, 'test');
set role authenticated;
do $$ begin assert tests.post('F', 'c', 'test') = '42501', 'compte suspendu : envoi refusé'; end $$;
reset role;
delete from private.user_suspensions;

-- Débit.
update public.app_config set value = '{"max": 2, "window_s": 60}' where key = 'rate.group_message_burst';
delete from private.rate_counters;
set role authenticated;
do $$ declare s text; begin
  perform tests.post('M', 'c', 'un'); perform tests.post('M', 'c', 'deux');
  s := tests.post('M', 'c', 'trois');
  assert s = 'ZKR01', 'débit dépassé (ZKR01), obtenu ' || s;
end $$;

-- Conservation 365 jours.
reset role;
update public.group_messages set created_at = now() - interval '400 days' where sender_id = tests.get('u_P')::uuid;
do $$ declare r jsonb; begin
  r := private.purge_expired();
  assert (r ->> 'group_messages')::int = 1, 'messages de plus de 365 jours purgés';
  assert (select count(*) from public.group_messages where sender_id = tests.get('u_A')::uuid) >= 1, 'messages récents gardés';
end $$;
-- Suppression de compte : ses messages partent avec lui.
delete from auth.users where id = tests.get('u_A')::uuid;
do $$ begin
  assert (select count(*) from public.group_messages where sender_id = tests.get('u_A')::uuid) = 0, 'messages supprimés avec le compte';
end $$;
