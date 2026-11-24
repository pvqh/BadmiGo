/**
 * Accounts are username-only (spec, Identity and auth, revised 2026-11-24). The
 * username is read back out of the account's synthetic auth email and is no longer a
 * parameter, and an account made any other way — Supabase Auth will still create one
 * for a real address if asked directly — cannot become a club member.
 */
drop function public.create_my_profile(text, text, public.gender, public.tier);

create function public.create_my_profile(
  p_display_name text,
  p_gender public.gender,
  p_seed_tier public.tier
) returns public.profiles
  language plpgsql security definer
  set search_path = ''
  as $$
  declare
    v_id uuid := auth.uid();
    v_email text;
    v_profile public.profiles;
  begin
    if v_id is null then
      raise exception 'sign in before creating a profile' using errcode = '42501';
    end if;

    if exists (select 1 from public.profiles where id = v_id) then
      raise exception 'this account already has a profile' using errcode = '42710';
    end if;

    select users.email into v_email from auth.users users where users.id = v_id;

    if v_email is null or v_email not like ('%@' || public.username_email_domain()) then
      raise exception 'accounts are made with a username only' using errcode = '42501';
    end if;

    begin
      insert into public.profiles (id, username, display_name, gender, seed_tier)
      values (
        v_id,
        split_part(v_email, '@', 1),
        trim(coalesce(p_display_name, '')),
        p_gender,
        p_seed_tier
      )
      returning * into v_profile;
    exception when unique_violation then
      raise exception '% is already taken', split_part(v_email, '@', 1) using errcode = '23505';
    end;

    insert into public.notification_preferences (profile_id) values (v_id);

    return v_profile;
  end
  $$;

revoke all on function public.create_my_profile(text, public.gender, public.tier)
  from public, anon;
grant execute on function public.create_my_profile(text, public.gender, public.tier)
  to authenticated;
