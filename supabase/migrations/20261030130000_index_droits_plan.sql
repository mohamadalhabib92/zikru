-- Conseiller Supabase (performance) : clé étrangère user_entitlements.plan_id sans index couvrant.
create index if not exists user_entitlements_plan_idx on public.user_entitlements (plan_id);
