-- Audit Passe 1 : RLS sur toutes les tables public/private, aucune écriture « using (true) »,
-- fonctions SECURITY DEFINER avec search_path fixé, rôles serveur illisibles par le client.

do $$
declare n int; bad text;
begin
  select count(*) into n
  from pg_class c
  join pg_namespace ns on ns.oid = c.relnamespace
  where ns.nspname in ('public', 'private') and c.relkind = 'r' and not c.relrowsecurity;
  assert n = 0, 'tables sans RLS : ' || n;

  select string_agg(ns.nspname || '.' || c.relname || '.' || p.polname, ', ')
  into bad
  from pg_policy p
  join pg_class c on c.oid = p.polrelid
  join pg_namespace ns on ns.oid = c.relnamespace
  where ns.nspname in ('public', 'private')
    and p.polcmd::text in ('a', 'w', 'd', '*')
    and (
      pg_get_expr(p.polqual, p.polrelid) = 'true'
      or pg_get_expr(p.polwithcheck, p.polrelid) = 'true'
    );
  assert bad is null, 'policy d''écriture ouverte : ' || bad;

  select string_agg(ns.nspname || '.' || p.proname, ', ')
  into bad
  from pg_proc p
  join pg_namespace ns on ns.oid = p.pronamespace
  where ns.nspname in ('public', 'private')
    and p.prosecdef
    and not exists (select 1 from unnest(coalesce(p.proconfig, array[]::text[])) cfg where cfg like 'search_path=%');
  assert bad is null, 'SECURITY DEFINER sans search_path : ' || bad;
end $$;

set role authenticated;
do $$
begin
  assert private.has_role('scholar') = false, 'aucun rôle scholar n''est accordé par défaut';
  assert private.has_role('admin') = false, 'aucun rôle admin n''est accordé par défaut';
end $$;
do $$
begin
  perform 1 from private.app_roles;
  raise exception 'private.app_roles lisible par authenticated';
exception when insufficient_privilege then
  null;
end $$;
reset role;
