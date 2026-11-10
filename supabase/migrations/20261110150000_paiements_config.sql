-- Interrupteurs des paiements d’enseignement et des dons. NON APPLIQUÉE au Supabase hébergé.
-- Aucun encaissement, aucun prestataire, aucun taux. La commission reste vide tant que Mohamed ne la choisit pas.
-- 100 dix-millièmes = 1 %. La case vide (JSON null) interdit d’ouvrir les paiements.

insert into public.app_config (key, value, description) values
  ('teaching.payments_enabled', 'false', 'Encaissement des cours : faux tant que le prestataire, le taux et la relecture suisse ne sont pas prêts.'),
  ('teaching.commission_bps', 'null', 'Commission Zikru en dix-millièmes du prix convenu. null = taux non décidé. Aucun nombre n’est écrit dans l’application.'),
  ('donations.enabled', 'false', 'Dons : faux tant qu’une organisation reconnue n’encaisse pas en son nom. Bissabi Drinks - BA ne collecte pas.')
on conflict (key) do nothing;

-- Taux utilisable, ou null. Un nombre hors 0..10000 est ignoré : ce n’est pas un taux par défaut.
create or replace function private.teaching_commission_bps() returns int
language sql stable security definer set search_path = '' as $$
  select case
    when jsonb_typeof(private.config('teaching.commission_bps')) = 'number'
     and (private.config('teaching.commission_bps') #>> '{}') ~ '^\d+$'
     and (private.config('teaching.commission_bps') #>> '{}')::int between 0 and 10000
    then (private.config('teaching.commission_bps') #>> '{}')::int
  end $$;

-- Vrai seulement si Mohamed a ouvert l’interrupteur ET posé un taux. Jamais avec la case vide.
create or replace function private.teaching_payments_open() returns boolean
language sql stable security definer set search_path = '' as $$
  select private.config_bool('teaching.payments_enabled', false)
     and private.teaching_commission_bps() is not null $$;

create or replace function private.donations_open() returns boolean
language sql stable security definer set search_path = '' as $$
  select private.config_bool('donations.enabled', false) $$;

revoke all on function private.teaching_commission_bps(), private.teaching_payments_open(), private.donations_open() from public, anon;
grant execute on function private.teaching_commission_bps(), private.teaching_payments_open(), private.donations_open() to authenticated;
