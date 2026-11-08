-- Passe 1 (31.10.2026) — Rôles applicatifs côté serveur (admin, scholar, moderator). Migration ADDITIVE.
-- Les rôles vivent dans une table du schéma privé, sans aucune policy ni droit client : impossible à lire ou
-- à écrire depuis l'app. Ils ne sont attribués que par le propriétaire du projet (éditeur SQL du tableau de bord,
-- rôle postgres / service_role), jamais par l'app. Vérification par fonctions SECURITY DEFINER à search_path vide.
-- Note : « moderator » ici = modération de la plateforme ; le rôle « moderator » d'un cercle reste dans circle_members.

create table if not exists private.app_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'scholar', 'moderator')),
  granted_at timestamptz not null default now(),
  note text check (note is null or length(note) <= 200),
  primary key (user_id, role)
);
alter table private.app_roles enable row level security;
revoke all on private.app_roles from public, anon, authenticated;

-- Rôle de l'utilisateur courant ? (utilisable dans des policies futures : contenu, validation savante, modération)
create or replace function private.has_role(r text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from private.app_roles a where a.user_id = (select auth.uid()) and a.role = r);
$$;

-- L'app ne peut connaître que SES propres rôles (pour afficher l'écran Validation savante, par ex.).
create or replace function public.my_app_roles() returns text[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(a.role order by a.role), '{}') from private.app_roles a where a.user_id = (select auth.uid());
$$;

revoke all on function private.has_role(text) from public, anon;
grant execute on function private.has_role(text) to authenticated;
revoke all on function public.my_app_roles() from public, anon;
grant execute on function public.my_app_roles() to authenticated;
