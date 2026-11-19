-- Lecture partagée d’une leçon. NON APPLIQUÉE au Supabase hébergé.
-- teaching.shared_reading reste false. Le texte du Coran n’est pas ici :
-- chaque écran lit le Hafs Tanzil embarqué. On ne garde que la position et les marques.

insert into public.app_config (key, value, description) values
  ('teaching.shared_reading', 'false', 'Texte partagé pendant une leçon. Faux tant que Mohamed ne l’ouvre pas. Le rôle enseignant reste exigé pour conduire.')
on conflict (key) do nothing;

create or replace function private.shared_reading_open() returns boolean
language sql stable security definer set search_path = '' as $$
  select private.config_bool('teaching.shared_reading', false) $$;

create or replace function public.shared_reading_open() returns boolean
language sql stable security definer set search_path = '' as $$
  select private.shared_reading_open() $$;

-- Leçon non annulée, et la personne est dans la classe de cette leçon.
create or replace function private.reading_participant(p_lesson uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.class_lessons l
    where l.id = p_lesson and l.cancelled_at is null and private.is_circle_member(l.circle_id)
  ) $$;

create table public.lesson_readings (
  lesson_id uuid primary key references public.class_lessons(id) on delete cascade,
  surah int not null check (surah between 1 and 114),
  ayah_from int not null,
  ayah_to int not null,
  focus_ayah int not null,
  focus_word int check (focus_word is null or (focus_word between 0 and 400)),
  driver_id uuid references public.profiles(id),
  revision int not null default 1 check (revision > 0),
  updated_at timestamptz not null default now(),
  updated_by uuid not null references public.profiles(id)
);
alter table public.lesson_readings enable row level security;
alter table public.lesson_readings replica identity full;
revoke all on public.lesson_readings from public, anon, authenticated;
grant select on public.lesson_readings to authenticated;
create policy lesson_readings_select on public.lesson_readings for select to authenticated
  using (private.shared_reading_open() and private.reading_participant(lesson_id));

create table public.lesson_marks (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.class_lessons(id) on delete cascade,
  surah int not null check (surah between 1 and 114),
  ayah int not null,
  word int check (word is null or (word between 0 and 400)),
  kind text not null check (kind in ('tajweed', 'comment')),
  comment text not null default '' check (char_length(comment) <= 280),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  removed_at timestamptz
);
create index lesson_marks_lesson_idx on public.lesson_marks (lesson_id, created_at);
alter table public.lesson_marks enable row level security;
alter table public.lesson_marks replica identity full;
revoke all on public.lesson_marks from public, anon, authenticated;
grant select on public.lesson_marks to authenticated;
create policy lesson_marks_select on public.lesson_marks for select to authenticated
  using (private.shared_reading_open() and private.reading_participant(lesson_id));

create or replace function private.reading_payload(p_lesson uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'lesson_id', r.lesson_id,
    'surah', r.surah,
    'ayah_from', r.ayah_from,
    'ayah_to', r.ayah_to,
    'focus_ayah', r.focus_ayah,
    'focus_word', r.focus_word,
    'driver_id', r.driver_id,
    'revision', r.revision,
    'marks', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id, 'surah', m.surah, 'ayah', m.ayah, 'word', m.word, 'kind', m.kind, 'comment', m.comment
      ) order by m.created_at)
      from public.lesson_marks m
      where m.lesson_id = r.lesson_id and m.removed_at is null
    ), '[]'::jsonb)
  )
  from public.lesson_readings r
  where r.lesson_id = p_lesson $$;

create or replace function private.assert_reading_open(p_lesson uuid) returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare cid uuid;
begin
  if not private.shared_reading_open() then
    raise exception 'Lecture partagée fermée' using errcode = 'ZKL01',
      detail = jsonb_build_object('reason', 'disabled')::text;
  end if;
  if (select auth.uid()) is null or not private.reading_participant(p_lesson) then
    raise exception 'Réservé aux participants de la leçon' using errcode = '42501';
  end if;
  select circle_id into cid from public.class_lessons where id = p_lesson and cancelled_at is null;
  if cid is null then raise exception 'Leçon introuvable' using errcode = '42501'; end if;
  return cid;
end $$;

create or replace function private.assert_reading_teacher(p_lesson uuid) returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare cid uuid := private.assert_reading_open(p_lesson);
begin
  if not private.is_teacher((select auth.uid())) or private.circle_role(cid) is distinct from 'founder' then
    raise exception 'Réservé à l’enseignant de la classe' using errcode = '42501';
  end if;
  return cid;
end $$;

create or replace function public.lesson_reading(p_lesson uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.assert_reading_open(p_lesson);
  return private.reading_payload(p_lesson);
end $$;

create or replace function public.open_lesson_reading(p_lesson uuid, p_surah int, p_from int, p_to int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := (select auth.uid());
begin
  perform private.assert_reading_teacher(p_lesson);
  perform private.assert_passage(p_surah, p_from, p_to);
  insert into public.lesson_readings (lesson_id, surah, ayah_from, ayah_to, focus_ayah, focus_word, driver_id, revision, updated_by)
    values (p_lesson, p_surah, p_from, p_to, p_from, null, null, 1, me)
  on conflict (lesson_id) do update set
    surah = excluded.surah,
    ayah_from = excluded.ayah_from,
    ayah_to = excluded.ayah_to,
    focus_ayah = excluded.focus_ayah,
    focus_word = null,
    driver_id = null,
    revision = lesson_readings.revision + 1,
    updated_at = now(),
    updated_by = me;
  return private.reading_payload(p_lesson);
end $$;

create or replace function public.set_reading_focus(p_lesson uuid, p_ayah int, p_word int default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := (select auth.uid()); r public.lesson_readings;
begin
  perform private.assert_reading_open(p_lesson);
  select * into r from public.lesson_readings where lesson_id = p_lesson for update;
  if r.lesson_id is null then raise exception 'Le passage n’est pas encore affiché' using errcode = 'P0002'; end if;
  if r.driver_id is null then
    if not private.is_teacher(me) or private.circle_role((select circle_id from public.class_lessons where id = p_lesson)) is distinct from 'founder' then
      raise exception 'L’enseignant conduit le curseur' using errcode = '42501';
    end if;
  elsif r.driver_id is distinct from me then
    raise exception 'Quelqu’un d’autre conduit le curseur' using errcode = '42501';
  end if;
  if p_ayah < r.ayah_from or p_ayah > r.ayah_to then
    raise exception 'Verset hors du passage' using errcode = '22023';
  end if;
  if p_word is not null and (p_word < 0 or p_word > 400) then
    raise exception 'Mot hors du verset' using errcode = '22023';
  end if;
  update public.lesson_readings set
    focus_ayah = p_ayah, focus_word = p_word, revision = revision + 1, updated_at = now(), updated_by = me
  where lesson_id = p_lesson;
  return private.reading_payload(p_lesson);
end $$;

create or replace function public.hand_reading(p_lesson uuid, p_user uuid default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := (select auth.uid()); cid uuid; who uuid := p_user;
begin
  cid := private.assert_reading_teacher(p_lesson);
  if not exists (select 1 from public.lesson_readings where lesson_id = p_lesson) then
    raise exception 'Le passage n’est pas encore affiché' using errcode = 'P0002';
  end if;
  if who = me then who := null; end if;
  if who is not null and not exists (
    select 1 from public.circle_members m where m.circle_id = cid and m.user_id = who
  ) then
    raise exception 'Cette personne n’est pas dans la classe' using errcode = '42501';
  end if;
  update public.lesson_readings set driver_id = who, revision = revision + 1, updated_at = now(), updated_by = me
  where lesson_id = p_lesson;
  return private.reading_payload(p_lesson);
end $$;

create or replace function public.add_lesson_mark(p_lesson uuid, p_ayah int, p_word int, p_kind text, p_comment text default '') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := (select auth.uid()); r public.lesson_readings; note text := left(trim(coalesce(p_comment, '')), 280); n int;
begin
  perform private.assert_reading_teacher(p_lesson);
  select * into r from public.lesson_readings where lesson_id = p_lesson for update;
  if r.lesson_id is null then raise exception 'Le passage n’est pas encore affiché' using errcode = 'P0002'; end if;
  if p_ayah < r.ayah_from or p_ayah > r.ayah_to or p_kind not in ('tajweed', 'comment') then
    raise exception 'Marque invalide' using errcode = '22023';
  end if;
  if p_word is not null and (p_word < 0 or p_word > 400) then
    raise exception 'Mot hors du verset' using errcode = '22023';
  end if;
  if p_kind = 'comment' and note = '' then raise exception 'Commentaire vide' using errcode = '22023'; end if;
  if char_length(trim(coalesce(p_comment, ''))) > 280 then raise exception 'Commentaire trop long' using errcode = '22023'; end if;
  select count(*) into n from public.lesson_marks where lesson_id = p_lesson and removed_at is null;
  if n >= 100 then raise exception 'Trop de marques' using errcode = '22023'; end if;
  insert into public.lesson_marks (lesson_id, surah, ayah, word, kind, comment, created_by)
    values (p_lesson, r.surah, p_ayah, p_word, p_kind, note, me);
  update public.lesson_readings set revision = revision + 1, updated_at = now(), updated_by = me where lesson_id = p_lesson;
  return private.reading_payload(p_lesson);
end $$;

create or replace function public.remove_lesson_mark(p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := (select auth.uid()); lid uuid;
begin
  select lesson_id into lid from public.lesson_marks where id = p_id and removed_at is null;
  if lid is null then raise exception 'Marque introuvable' using errcode = '42501'; end if;
  perform private.assert_reading_teacher(lid);
  update public.lesson_marks set removed_at = now() where id = p_id;
  update public.lesson_readings set revision = revision + 1, updated_at = now(), updated_by = me where lesson_id = lid;
  return private.reading_payload(lid);
end $$;

revoke all on function private.shared_reading_open(), private.reading_participant(uuid), private.reading_payload(uuid),
  private.assert_reading_open(uuid), private.assert_reading_teacher(uuid) from public, anon;
grant execute on function private.shared_reading_open(), private.reading_participant(uuid) to authenticated;

revoke all on function public.shared_reading_open(), public.lesson_reading(uuid),
  public.open_lesson_reading(uuid, int, int, int), public.set_reading_focus(uuid, int, int),
  public.hand_reading(uuid, uuid), public.add_lesson_mark(uuid, int, int, text, text),
  public.remove_lesson_mark(uuid) from public, anon;
grant execute on function public.shared_reading_open(), public.lesson_reading(uuid),
  public.open_lesson_reading(uuid, int, int, int), public.set_reading_focus(uuid, int, int),
  public.hand_reading(uuid, uuid), public.add_lesson_mark(uuid, int, int, text, text),
  public.remove_lesson_mark(uuid) to authenticated;

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.lesson_readings, public.lesson_marks;
  end if;
end $$;
