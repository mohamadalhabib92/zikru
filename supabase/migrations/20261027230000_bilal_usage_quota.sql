-- El Ghaly Bilal : quota quotidien (30 messages / utilisateur / jour UTC), sans service_role.
create table if not exists public.bilal_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null default (now() at time zone 'utc')::date,
  count int not null default 0,
  primary key (user_id, day)
);
alter table public.bilal_usage enable row level security;
revoke all on public.bilal_usage from anon, authenticated;
create policy bilal_usage_read_own on public.bilal_usage for select to authenticated using (user_id = (select auth.uid()));
grant select on public.bilal_usage to authenticated;

create or replace function private.bilal_consume(p_limit int default 30)
returns int language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  c int;
begin
  if uid is null then raise exception 'auth required' using errcode = '28000'; end if;
  insert into public.bilal_usage(user_id, day, count) values (uid, (now() at time zone 'utc')::date, 1)
  on conflict (user_id, day) do update set count = public.bilal_usage.count + 1
  returning count into c;
  delete from public.bilal_usage where user_id = uid and day < (now() at time zone 'utc')::date - 7;
  return greatest(least(p_limit, 30) - c, -1);
end;
$$;
revoke all on function private.bilal_consume(int) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.bilal_consume(int) to authenticated;

create or replace function public.bilal_consume()
returns int language sql security invoker set search_path = '' as $$ select private.bilal_consume(30) $$;
revoke all on function public.bilal_consume() from public, anon;
grant execute on function public.bilal_consume() to authenticated;
