-- Tests appels de groupe (migration 20261102100000_appels, non appliquée en ligne) : droits, mineurs, blocage, modération, notification.
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
update public.profiles set is_minor = true where id = tests.get('u_K')::uuid;
set role authenticated;

-- ============================================================ Interrupteur général (défaut : désactivé)
do $$ declare r jsonb; begin
  perform tests.as_user('X');
  r := public.call_rights('circle', tests.get('circle')::uuid);
  assert (r ->> 'member')::boolean and not (r ->> 'enabled')::boolean and r ->> 'reason' = 'disabled', 'désactivé par défaut : ' || r::text;
  assert public.call_join('circle', tests.get('circle')::uuid, true, '{}') ->> 'reason' = 'disabled', 'aucune entrée tant que désactivé';
  assert tests.state('select * from public.app_config') = '42501', 'réglages non lisibles par l''app (seulement via call_rights)';
end $$;
reset role;
update public.app_config set value = 'true' where key = 'calls.enabled';
set role authenticated;
do $$ declare r jsonb; begin
  perform tests.as_user('X');
  r := public.call_rights('circle', tests.get('circle')::uuid);
  assert not (r ->> 'enabled')::boolean and r ->> 'reason' = 'disabled', 'calls.enabled sans adresse de serveur : toujours fermé';
end $$;
reset role;
update public.app_config set value = '"wss://appels.test.invalid"' where key = 'calls.server_url';
update public.app_config set value = 'true' where key = 'calls.push';
insert into public.user_entitlements (user_id, plan_id, source, external_ref, note) values
  ('30000000-0000-4000-8000-000000000001', 'lifetime', 'manual', 'test:call-F', 'hôte Premium'),
  ('30000000-0000-4000-8000-000000000007', 'lifetime', 'manual', 'test:call-P', 'hôte Premium');
set role authenticated;

-- ============================================================ Cercle : membres, hôte, blocage, capacité
do $$ declare r jsonb; j jsonb; begin
  perform tests.as_user('X');
  r := public.call_rights('circle', tests.get('circle')::uuid);
  assert (r ->> 'can_join')::boolean and (r ->> 'video')::boolean and not (r ->> 'admin')::boolean and not (r ->> 'can_start')::boolean, 'membre : peut rejoindre, pas ouvrir : ' || r::text;
  assert (r ->> 'max_participants')::int = 4, 'capacité = taille du groupe (4)';
  j := public.call_join('circle', tests.get('circle')::uuid, true, '{}');
  assert j ->> 'reason' = 'premium_host', 'salle vide : un membre sans Premium n’ouvre pas';
  perform tests.as_user('M');
  assert (public.call_rights('circle', tests.get('circle')::uuid) ->> 'admin')::boolean and not (public.call_rights('circle', tests.get('circle')::uuid) ->> 'can_start')::boolean, 'modérateur sans Premium : hôte, mais n’ouvre pas';
  assert public.call_join('circle', tests.get('circle')::uuid, true, '{}') ->> 'reason' = 'premium_host', 'modérateur sans Premium : salle vide refusée';
  perform tests.as_user('F');
  assert (public.call_rights('circle', tests.get('circle')::uuid) ->> 'can_start')::boolean, 'fondatrice Premium : peut ouvrir';
  j := public.call_join('circle', tests.get('circle')::uuid, true, '{}');
  assert (j ->> 'ok')::boolean and j ->> 'room' = 'circle_' || tests.get('circle') and j ->> 'identity' = tests.get('u_F'), 'l’hôte Premium ouvre : ' || j::text;
  assert j ->> 'name' = 'Fatou' and (j ->> 'video')::boolean and (j ->> 'ring')::boolean, 'nom posé par le serveur, première personne : notification';
  j := public.call_join('circle', tests.get('circle')::uuid, false, '{}');
  assert not (j ->> 'video')::boolean and not (j ->> 'ring')::boolean, 'audio seul demandé ; pas de 2e notification dans le délai';
  perform tests.as_user('F');
  assert (public.call_rights('circle', tests.get('circle')::uuid) ->> 'admin')::boolean, 'fondatrice = hôte';
  perform tests.as_user('M');
  assert (public.call_rights('circle', tests.get('circle')::uuid) ->> 'admin')::boolean, 'modérateur = hôte';
  perform tests.as_user('Z');
  r := public.call_rights('circle', tests.get('circle')::uuid);
  assert not (r ->> 'member')::boolean and r - 'member' - 'enabled' = '{}'::jsonb, 'extérieur : rien n''est révélé';
  assert public.call_join('circle', tests.get('circle')::uuid, true, '{}') ->> 'reason' = 'not_member', 'extérieur refusé';
  perform tests.as_user('X');
  assert public.call_join('circle', tests.get('circle')::uuid, true,
    array[tests.get('u_F'), tests.get('u_M'), tests.get('u_Y'), tests.get('u_Z')]::uuid[]) ->> 'reason' = 'full', 'appel complet';
  perform tests.as_user('Y');
  perform public.block_user(tests.get('u_X')::uuid);
  assert public.call_join('circle', tests.get('circle')::uuid, true, array[tests.get('u_X')]::uuid[]) ->> 'reason' = 'pair', 'Y a bloqué X présent : refus';
  perform tests.as_user('X');
  assert public.call_join('circle', tests.get('circle')::uuid, true, array[tests.get('u_Y')]::uuid[]) ->> 'reason' = 'pair', 'blocage dans les deux sens';
  assert (public.call_join('circle', tests.get('circle')::uuid, true, array[tests.get('u_F')]::uuid[]) ->> 'ok')::boolean, 'X avec F : ok';
end $$;

-- ============================================================ Modération pendant l'appel
do $$ begin
  perform tests.as_user('X');
  assert tests.state(format($q$select public.call_moderate('circle', %L, 'call_mute', %L)$q$, tests.get('circle'), tests.get('u_Y'))) = '42501', 'membre : pas de modération';
  perform tests.as_user('M');
  assert tests.state(format($q$select public.call_moderate('circle', %L, 'call_remove', %L)$q$, tests.get('circle'), tests.get('u_F'))) = '42501', 'modérateur ne retire pas la fondatrice';
  assert tests.state(format($q$select public.call_moderate('circle', %L, 'call_record', %L)$q$, tests.get('circle'), tests.get('u_X'))) = '23514', 'action inconnue (pas d''enregistrement)';
  assert public.call_moderate('circle', tests.get('circle')::uuid, 'call_mute', tests.get('u_X')::uuid), 'modérateur coupe le micro de X';
  perform tests.as_user('F');
  assert public.call_moderate('circle', tests.get('circle')::uuid, 'call_remove', tests.get('u_M')::uuid), 'fondatrice retire le modérateur';
  assert tests.state(format($q$select public.call_moderate('circle', %L, 'call_mute', %L)$q$, tests.get('circle'), tests.get('u_F'))) = '42501', 'pas soi-même';
  perform tests.as_user('X');
  assert tests.state(format($q$select public.end_group_call('circle', %L)$q$, tests.get('circle'))) = '42501', 'un membre ne termine pas l’appel';
  perform tests.as_user('F');
  assert public.end_group_call('circle', tests.get('circle')::uuid), 'l’hôte termine l’appel';
end $$;
reset role;
do $$ begin
  assert (select count(*) from private.moderation_actions where action in ('call_mute', 'call_remove')) = 2, 'actions journalisées';
  assert (select count(*) from private.moderation_actions where action = 'call_end') = 1, 'fin d’appel journalisée';
  assert (select count(*) from private.call_joins) = 3, 'journal des entrées (refus non journalisés)';
end $$;
set role authenticated;

-- ============================================================ Famille : enfant, invité, consentement vidéo
do $$ declare r jsonb; j jsonb; begin
  perform tests.as_user('K');
  r := public.call_rights('family', tests.get('fam')::uuid);
  assert (r ->> 'can_join')::boolean and not (r ->> 'video')::boolean and (r ->> 'video_needs_consent')::boolean and not (r ->> 'can_start')::boolean, 'enfant : rejoint, n’ouvre pas : ' || r::text;
  j := public.call_join('family', tests.get('fam')::uuid, true, '{}');
  assert j ->> 'reason' = 'premium_host', 'enfant : n’ouvre pas la salle vide';
  perform tests.as_user('P');
  j := public.call_join('family', tests.get('fam')::uuid, true, '{}');
  assert (j ->> 'ok')::boolean and (j ->> 'video')::boolean, 'parent Premium ouvre';
  perform tests.as_user('K');
  j := public.call_join('family', tests.get('fam')::uuid, true, array[tests.get('u_P')]::uuid[]);
  assert (j ->> 'ok')::boolean and not (j ->> 'video')::boolean, 'enfant rejoint sans Premium ; vidéo refusée par le serveur';
  assert public.call_join('family', tests.get('fam')::uuid, false, array[tests.get('u_G')]::uuid[]) ->> 'reason' = 'pair', 'enfant : jamais avec un invité';
  assert (public.call_join('family', tests.get('fam')::uuid, false, array[tests.get('u_P')]::uuid[]) ->> 'ok')::boolean, 'enfant avec son parent : ok';
  perform tests.as_user('G');
  assert public.call_join('family', tests.get('fam')::uuid, true, array[tests.get('u_K')]::uuid[]) ->> 'reason' = 'pair', 'invité : jamais avec l''enfant';
  assert (public.call_join('family', tests.get('fam')::uuid, true, array[tests.get('u_P')]::uuid[]) ->> 'ok')::boolean, 'invité avec le parent : ok';
  assert not (public.call_rights('family', tests.get('fam')::uuid) ->> 'admin')::boolean, 'invité : pas hôte';
  perform tests.as_user('P');
  r := public.call_rights('family', tests.get('fam')::uuid);
  assert (r ->> 'admin')::boolean and (r ->> 'video')::boolean, 'parent = hôte, vidéo';
  assert public.call_moderate('family', tests.get('fam')::uuid, 'call_remove', tests.get('u_G')::uuid), 'parent retire l''invité';
  -- Consentement vidéo : le parent seul peut le donner (RLS existante de parental_controls).
  update public.parental_controls set allow_video_calls = true where family_id = tests.get('fam')::uuid;
  perform tests.as_user('K');
  update public.parental_controls set allow_video_calls = false where family_id = tests.get('fam')::uuid;
  r := public.call_rights('family', tests.get('fam')::uuid);
  assert (r ->> 'video')::boolean, 'consentement du parent : vidéo (l''enfant ne peut pas le retirer lui-même)';
  assert tests.state(format($q$select public.call_moderate('family', %L, 'call_mute', %L)$q$, tests.get('fam'), tests.get('u_P'))) = '42501', 'enfant : pas de modération';
end $$;
reset role;
update public.parental_controls set messaging = 'none' where family_id = tests.get('fam')::uuid;
set role authenticated;
do $$ begin
  perform tests.as_user('K');
  assert public.call_rights('family', tests.get('fam')::uuid) ->> 'reason' = 'parental', 'réglage « Aucun » : pas d''appel';
  assert not (public.call_rights('family', tests.get('fam')::uuid) ->> 'video')::boolean, 'ni vidéo';
end $$;
reset role;
update public.parental_controls set messaging = 'parents' where family_id = tests.get('fam')::uuid;

-- Mineur dans un cercle : impossible aujourd'hui (déclencheur circle_members_guard : « Les comptes enfants restent dans
-- leur famille »). call_rights exige en plus le consentement « cercles » d'un parent (défense en profondeur).
reset role;
do $$ begin
  assert tests.state(format($q$insert into public.circle_members (circle_id, user_id, display_name) values (%L, %L, 'Kadi')$q$,
    tests.get('circle'), tests.get('u_K'))) <> 'ok', 'mineur : toujours refusé dans un cercle';
end $$;

-- ============================================================ Suspension
insert into private.user_suspensions (user_id, reason) values (tests.get('u_F')::uuid, 'test');
set role authenticated;
do $$ declare r jsonb; begin
  perform tests.as_user('F');
  r := public.call_rights('circle', tests.get('circle')::uuid);
  assert r ->> 'reason' = 'suspended' and not (r ->> 'admin')::boolean, 'compte suspendu : ni appel ni modération';
end $$;
reset role;
delete from private.user_suspensions;

-- ============================================================ Notification « appel en cours » (rôle service)
set role authenticated;
do $$ begin
  perform tests.as_user('X');
  assert tests.state(format('select * from public.call_push_recipients(%L, %L, %L)', 'circle', tests.get('circle'), tests.get('u_X'))) = '42501', 'pas pour l''app';
end $$;
reset role;
set role anon;
do $$ begin
  begin
    perform public.call_rights('circle', gen_random_uuid());
    raise exception 'anonyme : call_rights devrait être refusé';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
set role authenticated;
select tests.as_user('F'); select public.register_push_token(tests.tok('F'), 'android', 'fr');
select tests.as_user('M'); select public.register_push_token(tests.tok('M'), 'ios', 'en');
select tests.as_user('Y'); select public.register_push_token(tests.tok('Y'), 'ios', 'ar');
select tests.as_user('Z'); select public.register_push_token(tests.tok('Z'), 'ios', 'fr');
select tests.as_user('P'); select public.register_push_token(tests.tok('P'), 'ios', 'fr');
select tests.as_user('K'); select public.register_push_token(tests.tok('K'), 'ios', 'fr');
select tests.as_user('G'); select public.register_push_token(tests.tok('G'), 'ios', 'fr');
reset role;
set role service_role;
do $$ declare t text[]; begin
  select array_agg(token order by token) into t from public.call_push_recipients('circle', tests.get('circle')::uuid, tests.get('u_X')::uuid);
  assert t = array[tests.tok('F'), tests.tok('M')], 'cercle : sauf l''appelant, l''extérieur et Y (blocage), obtenu ' || t::text;
  assert (select group_name from public.call_push_recipients('circle', tests.get('circle')::uuid, tests.get('u_X')::uuid) limit 1) = 'Halqa', 'nom du groupe seulement';
  select array_agg(token order by token) into t from public.call_push_recipients('family', tests.get('fam')::uuid, tests.get('u_G')::uuid);
  assert t = array[tests.tok('P')], 'appel lancé par l''invité : jamais l''enfant, obtenu ' || t::text;
  select array_agg(token order by token) into t from public.call_push_recipients('family', tests.get('fam')::uuid, tests.get('u_P')::uuid);
  assert t = array[tests.tok('G'), tests.tok('K')], 'appel lancé par le parent, obtenu ' || t::text;
end $$;
reset role;
-- Suppression du compte : le journal des entrées d'appel part avec lui.
do $$ declare u uuid; begin
  select user_id into u from private.call_joins limit 1;
  assert u is not null, 'au moins une entrée journalisée';
  delete from public.profiles where id = u;
  assert not exists (select 1 from private.call_joins where user_id = u), 'call_joins effacé avec le compte';
end $$;
