/**
 * Story 1 revised and story 6b (2026-11-25).
 *
 * A username now keeps the capitals it was typed with, and may use `.` and `-` as
 * well as `_`. It is still unique and still signed in with regardless of case, because
 * its auth email is the lower-cased handle: the address is what the password belongs
 * to, the stored username is only how it is spelled on screen. Letters stay unaccented
 * because the handle has to be an email address; the display name is where a member
 * writes their name in Vietnamese.
 */
create or replace function public.username_problem(p_username text) returns text
  language sql immutable
  set search_path = ''
  as $$
    select case
      when candidate = '' then 'Hãy nhập tên đăng nhập'
      when length(candidate) < 3 then 'Tên đăng nhập cần ít nhất 3 ký tự'
      when length(candidate) > 20 then 'Tên đăng nhập dài tối đa 20 ký tự'
      when candidate !~ '^[A-Za-z0-9_.-]+$' then 'Chỉ dùng chữ không dấu, số và các dấu _ . -'
      when candidate ~ '^\.|\.$|\.\.' then 'Dấu chấm không được đứng đầu, cuối hoặc liền nhau'
      when lower(candidate) = any (public.reserved_usernames()) then 'Tên đăng nhập này đã được giữ chỗ'
    end
    from (select trim(coalesce(p_username, ''))) as normalised (candidate)
  $$;

alter table public.profiles drop constraint profiles_username_normalised;
alter table public.profiles
  add constraint profiles_username_trimmed check (username = trim(username));

-- "Hung" and "hung" would share one auth email, so they are one username.
alter table public.profiles drop constraint profiles_username_key;
create unique index profiles_username_lower_key on public.profiles (lower(username));

create or replace function public.username_available(p_username text) returns boolean
  language sql stable security definer
  set search_path = ''
  as $$
    select public.username_problem(p_username) is null
      and not exists (
        select 1 from public.profiles
        where lower(username) = lower(trim(coalesce(p_username, '')))
      )
  $$;

/**
 * Story 6b: a member's picture, shown on the ladder and their profile. The bucket is
 * public so thirty faces on the ladder cost no signed-URL round trips; a path holds a
 * member id and a timestamp, so it is not guessable from outside the club. Small JPEGs
 * only, which the app makes before uploading: storage is the one thing that could cost
 * money (spec, Out of Scope).
 */
alter table public.profiles add column avatar_path text;
alter table public.profiles
  add constraint profiles_avatar_own_folder
  check (avatar_path is null or avatar_path like (id::text || '/%'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 204800, array['image/jpeg']);

-- No membership check: the picture is chosen while the profile is still being made.
create policy "a player uploads an avatar into their own folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Removing an object reads it first, so the owner needs to see their own folder.
create policy "a player sees their own avatar folder"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "a player removes their own avatar"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

/**
 * As before, plus the picture and the username's capitals. Those capitals travel in
 * the account's metadata, which its owner can edit, so they are only believed when
 * they spell the same handle as the auth email; otherwise the handle is used as is.
 */
drop function public.create_my_profile(text, public.gender, public.tier);

create function public.create_my_profile(
  p_display_name text,
  p_gender public.gender,
  p_seed_tier public.tier,
  p_avatar_path text default null
) returns public.profiles
  language plpgsql security definer
  set search_path = ''
  as $$
  declare
    v_id uuid := auth.uid();
    v_email text;
    v_typed text;
    v_handle text;
    v_profile public.profiles;
  begin
    if v_id is null then
      raise exception 'Hãy đăng nhập trước khi tạo hồ sơ' using errcode = '42501';
    end if;

    if exists (select 1 from public.profiles where id = v_id) then
      raise exception 'Tài khoản này đã có hồ sơ' using errcode = '42710';
    end if;

    select users.email, trim(users.raw_user_meta_data ->> 'username')
      into v_email, v_typed
      from auth.users users where users.id = v_id;

    if v_email is null or v_email not like ('%@' || public.username_email_domain()) then
      raise exception 'Tài khoản chỉ được tạo bằng tên đăng nhập' using errcode = '42501';
    end if;

    v_handle := split_part(v_email, '@', 1);
    if v_typed is null or lower(v_typed) <> v_handle then
      v_typed := v_handle;
    end if;

    begin
      insert into public.profiles (id, username, display_name, gender, seed_tier, avatar_path)
      values (
        v_id,
        v_typed,
        trim(coalesce(p_display_name, '')),
        p_gender,
        p_seed_tier,
        p_avatar_path
      )
      returning * into v_profile;
    exception when unique_violation then
      raise exception 'Tên đăng nhập % đã có người dùng', v_typed using errcode = '23505';
    end;

    insert into public.notification_preferences (profile_id) values (v_id);

    return v_profile;
  end
  $$;

revoke all on function public.create_my_profile(text, public.gender, public.tier, text)
  from public, anon;
grant execute on function public.create_my_profile(text, public.gender, public.tier, text)
  to authenticated;
