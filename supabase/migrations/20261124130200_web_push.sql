/**
 * The app is a web app now, and a browser's push address is a Web Push subscription
 * — an endpoint plus the two keys a message is encrypted to — rather than the single
 * token a native app had. Nothing has been registered yet, so the old table is dropped
 * rather than migrated.
 */
drop table public.push_tokens;

create table public.push_subscriptions (
  endpoint text primary key,
  p256dh text not null,
  auth text not null,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  updated_at timestamptz not null default now()
);

create index push_subscriptions_by_player on public.push_subscriptions (profile_id);

alter table public.push_subscriptions enable row level security;

-- A push address is private to its owner: the club may read the ladder, not each
-- other's devices.
create policy "a player reads their own push subscriptions"
  on public.push_subscriptions for select
  to authenticated
  using (profile_id = (select auth.uid()));

create policy "a player subscribes a device for themselves"
  on public.push_subscriptions for insert
  to authenticated
  with check (profile_id = (select auth.uid()));

/**
 * Claiming an endpoint already on file is how a shared phone switches owner, so the
 * update is not restricted to rows the caller can see — but it can only ever point at
 * the caller, and endpoints are unreadable, so there is nothing to redirect blindly.
 */
create policy "a player claims a push subscription"
  on public.push_subscriptions for update
  to authenticated
  using (true)
  with check (profile_id = (select auth.uid()));

create policy "a player removes their own push subscription"
  on public.push_subscriptions for delete
  to authenticated
  using (profile_id = (select auth.uid()));

revoke all on table public.push_subscriptions from anon, authenticated;
grant select, insert, update, delete on table public.push_subscriptions to authenticated;
