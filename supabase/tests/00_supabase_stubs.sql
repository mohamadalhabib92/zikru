-- Simulacre minimal de l'environnement Supabase pour tester les migrations hors-ligne
-- (PGlite / Postgres local). NE PAS appliquer sur un vrai projet Supabase : ces objets y existent déjà.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema extensions;
create extension if not exists pgcrypto schema extensions;
create schema auth;
create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb not null default '{}'::jsonb);
-- Comme Supabase : auth.uid() lit la revendication « sub » du JWT de la requête.
create function auth.uid() returns uuid language sql stable as $$
  select nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub', '')::uuid $$;
grant usage on schema auth to authenticated, anon;
grant execute on function auth.uid() to authenticated, anon;
create schema realtime;
create table realtime.messages (
  id bigint generated always as identity primary key,
  topic text not null, extension text not null, event text, payload jsonb,
  private boolean not null default true, inserted_at timestamptz not null default now());
alter table realtime.messages enable row level security;
create function realtime.topic() returns text language sql stable as $$
  select nullif(current_setting('realtime.topic', true), '') $$;
create function realtime.send(payload jsonb, event text, topic text, private boolean default true) returns void
language sql as $$ insert into realtime.messages (topic, extension, event, payload, private) values (topic, 'broadcast', event, payload, private) $$;
grant usage on schema realtime to authenticated;
grant select, insert on realtime.messages to authenticated;
grant execute on function realtime.topic() to authenticated;
create publication supabase_realtime;
grant usage on schema public to authenticated, anon;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
