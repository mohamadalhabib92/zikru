-- Interrupteurs des paiements d’enseignement et des dons. NON APPLIQUÉE au Supabase hébergé.
-- Aucun encaissement : teaching.payments_enabled reste false.
-- Commission décidée par Mohamed : 5 % = 500 dix-millièmes.
-- Base : le montant reçu après la commission du magasin (Apple, Google).
-- Un cours Stripe (tête-à-tête) n’a pas de commission de magasin : 5 % du prix du cours.
-- Les frais de traitement Stripe ne sont pas retirés avant ce calcul.

insert into public.app_config (key, value, description) values
  ('teaching.payments_enabled', 'false', 'Encaissement des cours : faux tant que le prestataire et la relecture suisse ne sont pas prêts. Le taux, lui, est déjà posé.'),
  ('teaching.commission_bps', '500', 'Commission Zikru : 500 dix-millièmes = 5 % du montant reçu après la commission du magasin. Pour un cours Stripe, ce montant est le prix du cours : les frais Stripe ne le réduisent pas.'),
  ('donations.enabled', 'false', 'Dons : faux tant qu’une organisation reconnue n’encaisse pas en son nom. Bissabi Drinks - BA ne collecte pas.')
on conflict (key) do nothing;

-- Taux utilisable. Défaut 500. Un nombre hors 0..10000, ou une case vidée, est ignoré.
create or replace function private.teaching_commission_bps() returns int
language sql stable security definer set search_path = '' as $$
  select case
    when jsonb_typeof(private.config('teaching.commission_bps')) = 'number'
     and (private.config('teaching.commission_bps') #>> '{}') ~ '^\d+$'
     and (private.config('teaching.commission_bps') #>> '{}')::int between 0 and 10000
    then (private.config('teaching.commission_bps') #>> '{}')::int
  end $$;

-- Vrai seulement si Mohamed a ouvert l’interrupteur ET qu’un taux (0..10000) est posé.
-- Le défaut 500 ne suffit pas : l’interrupteur reste faux.
create or replace function private.teaching_payments_open() returns boolean
language sql stable security definer set search_path = '' as $$
  select private.config_bool('teaching.payments_enabled', false)
     and private.teaching_commission_bps() is not null $$;

-- Commission en centimes. p_store_fee_cents = part Apple ou Google (0 pour Stripe).
-- (prix − magasin) × taux / 10 000. Les frais de traitement Stripe ne sont pas p_store_fee_cents.
create or replace function private.teaching_commission_cents(p_price_cents int, p_store_fee_cents int) returns int
language sql stable security definer set search_path = '' as $$
  select case
    when private.teaching_commission_bps() is null then null
    when p_price_cents is null or p_store_fee_cents is null then null
    when p_price_cents < 0 or p_store_fee_cents < 0 or p_store_fee_cents > p_price_cents then null
    else ((p_price_cents - p_store_fee_cents) * private.teaching_commission_bps()) / 10000
  end $$;

create or replace function private.donations_open() returns boolean
language sql stable security definer set search_path = '' as $$
  select private.config_bool('donations.enabled', false) $$;

revoke all on function private.teaching_commission_bps(), private.teaching_commission_cents(int, int), private.teaching_payments_open(), private.donations_open() from public, anon;
grant execute on function private.teaching_commission_bps(), private.teaching_commission_cents(int, int), private.teaching_payments_open(), private.donations_open() to authenticated;
