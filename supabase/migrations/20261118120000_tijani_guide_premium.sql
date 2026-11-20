-- Wirds tijani guidés : fonction Premium, à côté des thèmes.
-- N’altère aucune ligne de user_entitlements ni les limites déjà en place.
-- free = false (verrouillé), premium = true. Conflit : on ne réécrit pas une valeur déjà posée.
insert into public.plan_limits (plan_id, key, value) values
  ('free', 'tijani_guide', 'false'),
  ('premium', 'tijani_guide', 'true')
on conflict (plan_id, key) do nothing;
