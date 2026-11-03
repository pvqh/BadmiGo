/**
 * The confirmation loop only works if a push can reach the other three, and the
 * widget's third refresh path is a silent push to the same people. Both need a
 * device token, which the spec's data model does not name — see the Decision Log.
 */
create table public.push_tokens (
  token text primary key,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  updated_at timestamptz not null default now()
);

create index push_tokens_by_player on public.push_tokens (profile_id);

create table public.notification_preferences (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  confirmation_requests boolean not null default true,
  dispute_alerts boolean not null default true,
  weekly_recap boolean not null default true,
  -- Story 63: this one is opt-in, so the app never needles anyone who did not ask.
  overtaken_on_ladder boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.push_tokens enable row level security;
alter table public.notification_preferences enable row level security;

-- A device token is private to its owner: the club may read the ladder, not each
-- other's push addresses.
create policy "a player reads their own device tokens"
  on public.push_tokens for select
  to authenticated
  using (profile_id = (select auth.uid()));

create policy "a player registers a device for themselves"
  on public.push_tokens for insert
  to authenticated
  with check (profile_id = (select auth.uid()));

/**
 * Claiming a token already on file is how a shared handset switches owner, so the
 * update is not restricted to rows the caller can see — but it can only ever point
 * at the caller, and tokens are unreadable, so there is nothing to redirect blindly.
 */
create policy "a player claims a device token"
  on public.push_tokens for update
  to authenticated
  using (true)
  with check (profile_id = (select auth.uid()));

create policy "a player removes their own device token"
  on public.push_tokens for delete
  to authenticated
  using (profile_id = (select auth.uid()));

create policy "a player reads their own notification preferences"
  on public.notification_preferences for select
  to authenticated
  using (profile_id = (select auth.uid()));

create policy "a player changes their own notification preferences"
  on public.notification_preferences for update
  to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

revoke all on table public.push_tokens from anon, authenticated;
revoke all on table public.notification_preferences from anon, authenticated;
grant select, insert, update, delete on table public.push_tokens to authenticated;
-- The row is created with the profile, so there is no insert and nothing to delete.
grant select, update on table public.notification_preferences to authenticated;

/**
 * Which database role the request arrived as: anon, authenticated or service_role.
 * notify-players is called both by a member who has just logged a game and by the
 * functions that hold the service role, and it must tell those two apart to know
 * whether to insist the caller played in the game.
 */
create function public.current_role_name() returns text
  language sql stable
  set search_path = ''
  as $$ select current_user::text $$;

grant execute on function public.current_role_name() to anon, authenticated, service_role;
