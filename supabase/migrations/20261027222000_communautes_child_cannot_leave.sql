-- Un enfant ne peut pas quitter seul sa famille (seuls les parents le retirent).
drop policy family_members_delete on public.family_members;
create policy family_members_delete on public.family_members for delete to authenticated
  using (private.is_family_parent(family_id) or (user_id = (select auth.uid()) and role <> 'child'));
