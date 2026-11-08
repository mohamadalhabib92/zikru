-- OBSOLÈTE (31.10.2026) : ce fichier historique n’est PAS le schéma de production.
-- La source de vérité est supabase/migrations/ (testée par supabase/tests/run-pglite.mjs).
-- Ne pas exécuter ce fichier sur le projet de production.
-- Zikru — schéma Supabase minimal (idempotent). À exécuter dans l'éditeur SQL Supabase.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  lang text not null default 'fr' check (lang in ('fr','en','de','de-CH','ar','ff','wo')),
  role text not null default 'user' check (role in ('user','editor','admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.content_items (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('dhikr','dua')),
  arabic text not null,
  transliteration text,
  translations jsonb not null default '{}'::jsonb,
  source text not null,
  default_count int,
  status text not null default 'draft' check (status in ('draft','in_review','approved')),
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  lang text not null default 'fr',
  hijri_offset int not null default 0 check (hijri_offset between -2 and 2),
  updated_at timestamptz not null default now()
);

create table if not exists public.prayer_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  method text not null default 'MuslimWorldLeague',
  madhab text not null default 'shafi' check (madhab in ('shafi','hanafi')),
  lat double precision, lng double precision, place_label text,
  updated_at timestamptz not null default now()
);

create table if not exists public.tasbih_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  dhikr_id text not null,
  count int not null check (count >= 0),
  target int not null default 0,
  client_id text unique,           -- id local pour une synchro idempotente
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.content_items enable row level security;
alter table public.user_preferences enable row level security;
alter table public.prayer_settings enable row level security;
alter table public.tasbih_sessions enable row level security;

create or replace function public.is_editor() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('editor','admin'));
$$;

drop policy if exists "profiles self" on public.profiles;
create policy "profiles self" on public.profiles for all using (id = auth.uid()) with check (id = auth.uid() and role = 'user');

-- Contenu : tout le monde lit uniquement « approved » ; les éditeurs voient et gèrent tout.
drop policy if exists "content read approved" on public.content_items;
create policy "content read approved" on public.content_items for select using (status = 'approved' or public.is_editor());
drop policy if exists "content editors write" on public.content_items;
create policy "content editors write" on public.content_items for all using (public.is_editor()) with check (public.is_editor());

drop policy if exists "prefs self" on public.user_preferences;
create policy "prefs self" on public.user_preferences for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "prayer self" on public.prayer_settings;
create policy "prayer self" on public.prayer_settings for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "tasbih self" on public.tasbih_sessions;
create policy "tasbih self" on public.tasbih_sessions for all using (user_id = auth.uid()) with check (user_id = auth.uid());
