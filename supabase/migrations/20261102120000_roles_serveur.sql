-- Rôles serveur admin / scholar / moderator.
-- Aucune ligne n'est insérée ici : Mohamed les accorde en SQL, jamais depuis le client.
-- La table n'a aucune policy : avec RLS, anon et authenticated ne lisent ni n'écrivent rien.

create table private.app_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('admin', 'scholar', 'moderator')),
  granted_at timestamptz not null default now(),
  primary key (user_id, role)
);

alter table private.app_roles enable row level security;
revoke all on table private.app_roles from public, anon, authenticated;

create or replace function private.has_role(p_role text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from private.app_roles r
    where r.user_id = (select auth.uid()) and r.role = p_role
  );
$$;

revoke all on function private.has_role(text) from public, anon;
grant execute on function private.has_role(text) to authenticated;
