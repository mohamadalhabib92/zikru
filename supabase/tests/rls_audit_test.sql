-- Audit RLS automatique (Passe 1) : s'applique à TOUTES les tables, y compris celles ajoutées plus tard.
-- 1. RLS activée sur 100 % des tables de public et private.
-- 2. Aucune policy d'écriture (INSERT/UPDATE/DELETE/ALL) dont USING ou WITH CHECK vaut « true ».
-- 3. Toute fonction SECURITY DEFINER de public/private a un search_path fixé.
-- 4. Le rôle anon n'a aucun droit d'écriture sur les tables de public, ni aucun accès au schéma private.
-- 5. Rôles serveur : table illisible et non modifiable par le client, has_role/my_app_roles ne révèlent que soi.

do $$
declare r record; n int := 0;
begin
  for r in select n.nspname, c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where c.relkind in ('r', 'p') and n.nspname in ('public', 'private') and not c.relrowsecurity loop
    raise warning 'RLS désactivée : %.%', r.nspname, r.relname; n := n + 1;
  end loop;
  assert n = 0, 'RLS doit être activée sur 100 % des tables';
  assert (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
          where c.relkind = 'r' and n.nspname in ('public', 'private')) >= 27, 'inventaire : au moins 27 tables attendues';
end $$;

do $$
declare r record; n int := 0;
begin
  for r in select tablename, policyname, cmd, qual, with_check from pg_policies
           where schemaname in ('public', 'private') and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
             and (coalesce(trim(qual), '') in ('true', '(true)') or coalesce(trim(with_check), '') in ('true', '(true)')) loop
    raise warning 'Policy d''écriture ouverte : % / % (%)', r.tablename, r.policyname, r.cmd; n := n + 1;
  end loop;
  assert n = 0, 'aucune policy d''écriture using(true) / with check(true)';
end $$;

do $$
declare r record; n int := 0;
begin
  for r in select n.nspname, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname in ('public', 'private') and p.prosecdef
             and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%') loop
    raise warning 'SECURITY DEFINER sans search_path : %.%', r.nspname, r.proname; n := n + 1;
  end loop;
  assert n = 0, 'toute fonction SECURITY DEFINER doit fixer search_path';
end $$;

do $$
declare r record; n int := 0;
begin
  for r in select c.relname, p.priv from pg_class c join pg_namespace ns on ns.oid = c.relnamespace,
           unnest(array['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) p(priv)
           where c.relkind = 'r' and ns.nspname = 'public' and has_table_privilege('anon', c.oid, p.priv) loop
    raise warning 'anon peut % sur public.%', r.priv, r.relname; n := n + 1;
  end loop;
  assert n = 0, 'anon : aucune écriture sur public';
  assert not has_schema_privilege('anon', 'private', 'USAGE'), 'anon : aucun accès au schéma private';
end $$;

-- ============================================================ Rôles serveur
insert into auth.users (id) values ('30000000-0000-4000-8000-000000000001'), ('30000000-0000-4000-8000-000000000002');
insert into private.app_roles (user_id, role) values ('30000000-0000-4000-8000-000000000001', 'scholar');
create function pg_temp.state(q text) returns text language plpgsql as $$
begin execute q; return 'ok'; exception when others then return sqlstate; end $$;
grant execute on function pg_temp.state(text) to authenticated;
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"30000000-0000-4000-8000-000000000002"}', false);
do $$ begin
  assert pg_temp.state('select * from private.app_roles') = '42501', 'table des rôles illisible par le client';
  assert pg_temp.state($q$insert into private.app_roles (user_id, role) values ('30000000-0000-4000-8000-000000000002', 'admin')$q$) = '42501', 'auto-attribution impossible';
  assert pg_temp.state($q$update private.app_roles set user_id = '30000000-0000-4000-8000-000000000002'$q$) = '42501', 'détournement impossible';
  assert not private.has_role('scholar'), 'B n''est pas savant';
  assert public.my_app_roles() = '{}', 'B : aucun rôle';
end $$;
select set_config('request.jwt.claims', '{"sub":"30000000-0000-4000-8000-000000000001"}', false);
do $$ begin
  assert private.has_role('scholar') and not private.has_role('admin'), 'A : savant seulement';
  assert public.my_app_roles() = '{scholar}', 'A voit son propre rôle';
end $$;
reset role;
set role anon;
do $$ begin
  assert pg_temp.state('select public.my_app_roles()') = '42501', 'anon : pas d''accès aux rôles';
end $$;
reset role;
