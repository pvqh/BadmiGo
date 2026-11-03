-- The club's vocabulary, as enums, so the schema and the TypeScript literal unions
-- in src/domain/types.ts cannot drift apart. Labels match those literals exactly.

create type public.gender as enum ('male', 'female');

create type public.tier as enum ('newbie', 'y', 'tby', 'tb-plus', 'kha');

create type public.side as enum ('a', 'b');

create type public.game_status as enum ('pending', 'confirmed', 'disputed', 'voided');

create type public.confirmation_state as enum ('pending', 'confirmed', 'disputed');

-- Names that must not become a player's handle, because a reader would mistake one
-- for the app speaking rather than a person.
create function public.reserved_usernames() returns text[]
  language sql immutable
  set search_path = ''
  as $$
    select array[
      'admin', 'administrator', 'root', 'owner', 'official', 'system', 'api',
      'support', 'help', 'moderator', 'mod', 'club', 'ladder', 'badminton',
      'everyone', 'anonymous', 'guest', 'me', 'null', 'undefined', 'deleted'
    ]
  $$;

/**
 * Returns a human-readable reason a username cannot be used, or null if it can.
 * Shared deliberately between the `profiles` check constraint and the signup
 * screen, so the instant feedback a player sees is the rule the database applies.
 * Judges the normalised candidate, not the raw input, so typing "Hung" is fine.
 */
create function public.username_problem(p_username text) returns text
  language sql immutable
  set search_path = ''
  as $$
    select case
      when candidate = '' then 'enter a username'
      when length(candidate) < 3 then 'a username needs at least 3 characters'
      when length(candidate) > 20 then 'a username can be at most 20 characters'
      when candidate !~ '^[a-z0-9_]+$' then 'use only letters, numbers and underscores'
      when candidate = any (public.reserved_usernames()) then 'that username is reserved'
    end
    from (select lower(trim(coalesce(p_username, '')))) as normalised (candidate)
  $$;

/**
 * Username-only signups get a synthetic address at this domain, so a username can
 * be resolved to its Supabase Auth email by string formatting instead of a lookup
 * that would expose every member's real email address to anyone who can guess a
 * handle. The TLD is reserved by RFC 2606 and can never receive mail, which is the
 * honest signal: these accounts have no email and cannot reset a password by one.
 *
 * Mirrored in src/data/auth.ts. Changing one without the other breaks sign-in.
 */
create function public.username_email_domain() returns text
  language sql immutable
  set search_path = ''
  as $$ select 'users.badminton-ladder.invalid'::text $$;

/** The admin's flood guard, per story 71. A rolling day, not a calendar one. */
create function public.daily_log_cap() returns integer
  language sql immutable
  set search_path = ''
  as $$ select 30 $$;
