-- Fonctions du jour : Premium à vie (ch.mohamadba.zikru.premium.lifetime).
-- NON APPLIQUÉE au Supabase hébergé. La discussion de groupe et le fait de rejoindre un groupe
-- ne sont pas touchés. premium_creation_gate reste false : la création de famille ou de cercle
-- n’est pas verrouillée ici.
--
-- Décision de Mohamed : tout le monde dans l’appel ou la leçon doit avoir Premium,
-- y compris les personnes invitées et les élèves. La discussion et l’adhésion restent libres.

-- Sans Premium, un membre ne peut ni ouvrir ni rejoindre. Motif premium_required.
create or replace function private.call_rights(p_scope text, p_scope_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare me uuid := (select auth.uid()); r text; minor boolean; c record; video boolean; reason text; n int;
        on_ boolean := private.calls_open();
        vid boolean := private.config_bool('calls.video', true);
        cap int := greatest(private.config_int('calls.max_participants', 12), 2);
        ck text; amix boolean; mixed boolean := false; host boolean := false;
begin
  if me is null then return jsonb_build_object('member', false, 'enabled', on_); end if;
  minor := private.is_minor(me);
  if p_scope = 'circle' then
    r := private.circle_role(p_scope_id);
    if r is null then return jsonb_build_object('member', false, 'enabled', on_); end if;
    select count(*) into n from public.circle_members where circle_id = p_scope_id;
    select c2.kind, c2.allow_mixed_video into ck, amix from public.circles c2 where c2.id = p_scope_id;
    if minor then
      select * into c from private.minor_call_consent(me, null);
      if coalesce(ck, 'circle') = 'class' then
        if not private.minor_may_join_class(me, p_scope_id) then reason := 'parental'; end if;
        video := coalesce((
          select bool_or(pc.allow_classes and pc.allow_video_calls)
          from public.family_members m
          join public.parental_controls pc on pc.child_member_id = m.id
          where m.user_id = me and m.role = 'child'), false);
      else
        if not coalesce(c.circles, false) then reason := 'parental'; end if;
        video := coalesce(c.video_circles, false);
      end if;
    else
      video := true;
    end if;
    if coalesce(ck, 'circle') = 'class' and not coalesce(amix, false) then
      video := false;
      mixed := true;
    end if;
  elsif p_scope = 'family' then
    r := private.family_role(p_scope_id);
    if r is null then return jsonb_build_object('member', false, 'enabled', on_); end if;
    select count(*) into n from public.family_members where family_id = p_scope_id and user_id is not null;
    if minor and r <> 'child' then reason := 'parental'; end if;
    if r = 'child' and private.child_messaging_strict(p_scope_id, me) = 'none' then reason := 'parental'; end if;
    if minor or r = 'child' then
      select * into c from private.minor_call_consent(me, p_scope_id);
      video := coalesce(c.video_family, false);
    else
      video := true;
    end if;
  else
    return jsonb_build_object('member', false, 'enabled', on_);
  end if;
  if private.is_suspended(me) then reason := 'suspended'; end if;
  if not on_ then reason := 'disabled'; end if;
  if reason is null and not private.may_create_groups(me) then reason := 'premium_required'; end if;
  host := case p_scope when 'circle' then r in ('founder', 'moderator') else r = 'parent' end and reason is null;
  return jsonb_build_object('member', true, 'enabled', on_, 'role', r,
    'can_join', reason is null, 'reason', reason,
    'video', vid and video and reason is null,
    'video_needs_consent', vid and not video and not mixed and (minor or r = 'child'),
    'mixed_closed', mixed,
    'admin', host,
    'can_start', host and private.may_create_groups(me),
    'max_participants', least(cap, greatest(n, 2)));
end $$;

create or replace function private.call_join(p_scope text, p_scope_id uuid, p_video boolean, p_present uuid[]) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := (select auth.uid()); r jsonb := private.call_rights(p_scope, p_scope_id); p uuid; nm text; v boolean;
        fid uuid := case when p_scope = 'family' then p_scope_id end; cid uuid := case when p_scope = 'circle' then p_scope_id end;
        ring boolean := false; cool int := private.config_int('calls.ring_cooldown_s', 600);
begin
  if me is null then raise exception 'Connexion requise' using errcode = '42501'; end if;
  if not coalesce((r ->> 'member')::boolean, false) then return jsonb_build_object('ok', false, 'reason', 'not_member'); end if;
  if not coalesce((r ->> 'can_join')::boolean, false) then return jsonb_build_object('ok', false, 'reason', r ->> 'reason'); end if;
  if coalesce(cardinality(p_present), 0) >= (r ->> 'max_participants')::int then return jsonb_build_object('ok', false, 'reason', 'full'); end if;
  foreach p in array coalesce(p_present, '{}'::uuid[]) loop
    if p <> me and not private.call_pair_ok(p_scope, p_scope_id, me, p) then
      return jsonb_build_object('ok', false, 'reason', 'pair');
    end if;
  end loop;
  perform private.rate_hit('call_join', 30, 3600);
  v := coalesce(p_video, false) and coalesce((r ->> 'video')::boolean, false);
  nm := case p_scope when 'circle' then (select display_name from public.circle_members where circle_id = p_scope_id and user_id = me)
                     else (select display_name from public.family_members where family_id = p_scope_id and user_id = me) end;
  if coalesce(cardinality(p_present), 0) = 0 and private.config_bool('calls.push', false) then
    ring := not exists (select 1 from private.call_joins j where j.at > now() - make_interval(secs => cool)
                        and ((fid is not null and j.family_id = fid) or (cid is not null and j.circle_id = cid)));
  end if;
  delete from private.call_joins where at < now() - make_interval(days => private.config_int('retention.call_joins_days', 30));
  insert into private.call_joins (user_id, scope_type, family_id, circle_id, video) values (me, p_scope, fid, cid, v);
  return jsonb_build_object('ok', true, 'room', p_scope || '_' || p_scope_id::text, 'identity', me::text,
    'name', coalesce(nm, ''), 'video', v, 'admin', (r ->> 'admin')::boolean,
    'max_participants', (r ->> 'max_participants')::int,
    'token_ttl_s', least(greatest(private.config_int('calls.token_ttl_s', 600), 60), 3600), 'ring', ring);
end $$;

-- Conduire la lecture : validation Bissabi ET Premium. Lire reste ouvert aux élèves du cours.
create or replace function private.assert_reading_teacher(p_lesson uuid) returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare me uuid := (select auth.uid()); cid uuid := private.assert_reading_open(p_lesson);
begin
  if private.circle_role(cid) is distinct from 'founder' then
    raise exception 'Réservé à l’enseignant de la classe' using errcode = '42501';
  end if;
  if not private.has_teacher_grant(me) then
    raise exception 'Rôle enseignant non validé' using errcode = 'ZKT01';
  end if;
  if not private.may_create_groups(me) then
    raise exception 'Réserver à Zikru Premium' using errcode = 'ZKP01',
      detail = jsonb_build_object('reason', 'premium_required', 'product', 'ch.mohamadba.zikru.premium.lifetime')::text;
  end if;
  return cid;
end $$;

create or replace function public.set_reading_focus(p_lesson uuid, p_ayah int, p_word int default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := (select auth.uid()); r public.lesson_readings;
begin
  perform private.assert_reading_open(p_lesson);
  select * into r from public.lesson_readings where lesson_id = p_lesson for update;
  if r.lesson_id is null then raise exception 'Le passage n’est pas encore affiché' using errcode = 'P0002'; end if;
  if r.driver_id is null then
    perform private.assert_reading_teacher(p_lesson);
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

-- Lire la leçon aussi : élève, hôte, personne invitée. Sans Premium, la ligne n’est pas visible.
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
  if not private.may_create_groups((select auth.uid())) then
    raise exception 'La leçon demande Zikru Premium' using errcode = 'ZKP01',
      detail = jsonb_build_object('reason', 'premium_required', 'product', 'ch.mohamadba.zikru.premium.lifetime')::text;
  end if;
  select circle_id into cid from public.class_lessons where id = p_lesson and cancelled_at is null;
  if cid is null then raise exception 'Leçon introuvable' using errcode = '42501'; end if;
  return cid;
end $$;

drop policy if exists lesson_readings_select on public.lesson_readings;
create policy lesson_readings_select on public.lesson_readings for select to authenticated
  using (private.shared_reading_open() and private.reading_participant(lesson_id) and private.may_create_groups((select auth.uid())));

drop policy if exists lesson_marks_select on public.lesson_marks;
create policy lesson_marks_select on public.lesson_marks for select to authenticated
  using (private.shared_reading_open() and private.reading_participant(lesson_id) and private.may_create_groups((select auth.uid())));
