create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique,
  display_name text not null,
  gender public.gender not null,
  seed_tier public.tier not null,
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  constraint profiles_username_normalised check (username = lower(trim(username))),
  constraint profiles_username_valid check (public.username_problem(username) is null),
  constraint profiles_display_name_length check (length(trim(display_name)) between 1 and 40)
);

comment on column public.profiles.seed_tier is
  'Sets starting mu only. Changing it changes every rating derived since, so an '
  'admin edit here must be followed by a replay-ratings run.';

/**
 * Having a profile is what makes an authenticated user a club member: an account can
 * exist in auth.users between signing up and completing a profile, and until then it
 * must see nothing. Security definer so the policies that call it do not recurse
 * through profiles' own row-level security.
 */
create function public.is_club_member() returns boolean
  language sql stable security definer
  set search_path = ''
  as $$ select exists (select 1 from public.profiles where id = auth.uid()) $$;

create function public.is_admin() returns boolean
  language sql stable security definer
  set search_path = ''
  as $$ select exists (select 1 from public.profiles where id = auth.uid() and is_admin) $$;

revoke all on function public.is_club_member() from public;
revoke all on function public.is_admin() from public;
grant execute on function public.is_club_member() to authenticated;
grant execute on function public.is_admin() to authenticated;

/**
 * Row-level security is row-level, so the columns a player must not edit on their own
 * row are guarded here instead. Username is immutable for a member because a
 * username-only account's Supabase Auth email is derived from it.
 *
 * Only a signed-in client is policed. The service role an Edge Function holds, and
 * the owner a migration runs as, are what admin corrections and an account merge are
 * built from, and a trigger that blocked them would block those too.
 * Security invoker, deliberately: current_user inside a security definer function is
 * the definer, so the role that asked would be invisible here. It needs no privilege
 * of its own, because public.is_admin() is the definer that reads profiles.
 */
create function public.guard_profile_columns() returns trigger
  language plpgsql
  set search_path = ''
  as $$
  begin
    if current_user <> 'authenticated' or public.is_admin() then
      return new;
    end if;
    if new.username is distinct from old.username
      or new.seed_tier is distinct from old.seed_tier
      or new.is_admin is distinct from old.is_admin
      or new.created_at is distinct from old.created_at
    then
      raise exception 'only an admin may change username, seed_tier or is_admin'
        using errcode = '42501';
    end if;
    return new;
  end
  $$;

create trigger profiles_guard_columns
  before update on public.profiles
  for each row execute function public.guard_profile_columns();

alter table public.profiles enable row level security;

create policy "club members read every profile"
  on public.profiles for select
  to authenticated
  using ((select public.is_club_member()));

create policy "a player edits their own profile"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "an admin edits any profile"
  on public.profiles for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- Profiles are created only by public.create_my_profile, never by a direct insert.
revoke all on table public.profiles from anon, authenticated;
grant select, update on table public.profiles to authenticated;
