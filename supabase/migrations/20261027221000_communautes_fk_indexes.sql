-- Index des clés étrangères (advisor « unindexed_foreign_keys »)
create index circles_created_by_idx on public.circles (created_by);
create index families_created_by_idx on public.families (created_by);
create index parental_controls_updated_by_idx on public.parental_controls (updated_by);
