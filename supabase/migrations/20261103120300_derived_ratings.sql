/**
 * Everything in this file is derived. It is produced only by replaying the ordered
 * confirmed-game history through src/domain/rating inside the replay-ratings Edge
 * Function, and it is replaced wholesale on every run. No client has write
 * permission, and nothing here is ever edited by hand — see CLAUDE.md, hard rule 1.
 *
 * The json field names below are the domain core's own: PlayerSeed, RatedGame,
 * PlayerRating and RatingChange in src/domain/rating.ts. They are spelled the same
 * on purpose, so the Edge Function between them stays a pipe and not a translator.
 */

create table public.player_ratings (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  mu double precision not null,
  sigma double precision not null,
  games_played integer not null,
  display_rating integer not null,
  tier public.tier not null,
  in_placement boolean not null,
  is_active boolean not null,
  last_played_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint player_ratings_sigma_positive check (sigma > 0),
  constraint player_ratings_games_counted check (games_played >= 0),
  constraint player_ratings_display_not_negative check (display_rating >= 0)
);

comment on column public.player_ratings.in_placement is
  'The verdict the engine reached, stored rather than recomputed, so the placement '
  'count stays a rating parameter in src/domain/rating-scale and is not restated here.';

comment on column public.player_ratings.is_active is
  'True as of the last replay. last_played_at is kept alongside it because activity '
  'decays with the clock rather than with games, so a reader who needs the answer '
  'for right now should measure from last_played_at rather than trust a frozen flag.';

create table public.rating_history (
  game_id uuid not null references public.games (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  mu_before double precision not null,
  mu_after double precision not null,
  display_before integer not null,
  display_after integer not null,
  primary key (game_id, profile_id)
);

create index rating_history_by_player on public.rating_history (profile_id);

/** So a reader can tell whether the ladder on screen reflects the games below it. */
create table public.rating_replay_state (
  singleton boolean primary key default true,
  last_replay_at timestamptz,
  games_replayed integer,
  duration_ms integer,
  constraint rating_replay_state_is_one_row check (singleton)
);

insert into public.rating_replay_state (singleton) values (true);

/**
 * The complete input to a replay, as one value, so the Edge Function cannot page
 * through it wrongly and a replay cannot see a half-read history.
 *
 * Every profile is a seed, including one who has never played: their rating is their
 * seed and they belong on the ladder as provisional, not absent. Games carry only
 * what RatedGame reads — the format is recorded on the game row but all three count
 * equally, so it is not sent here. Times are epoch milliseconds, as the domain takes
 * them. Ordering is left to the engine, which sorts what it is given.
 */
create function public.replay_input() returns jsonb
  language sql stable security definer
  set search_path = ''
  as $$
    select jsonb_build_object(
      'seeds', coalesce((
        select jsonb_agg(jsonb_build_object('profileId', p.id, 'seedTier', p.seed_tier)
                         order by p.id)
        from public.profiles p
      ), '[]'::jsonb),
      'games', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id', g.id,
            'playedAt', (extract(epoch from g.played_at) * 1000)::bigint,
            'scoreA', g.score_a,
            'scoreB', g.score_b,
            'sideA', (
              select coalesce(jsonb_agg(gp.profile_id order by gp.profile_id), '[]'::jsonb)
              from public.game_participants gp
              where gp.game_id = g.id and gp.side = 'a'
            ),
            'sideB', (
              select coalesce(jsonb_agg(gp.profile_id order by gp.profile_id), '[]'::jsonb)
              from public.game_participants gp
              where gp.game_id = g.id and gp.side = 'b'
            )
          )
          order by g.played_at, g.created_at, g.id
        )
        from public.games g
        where g.status = 'confirmed'
      ), '[]'::jsonb)
    )
  $$;

/**
 * Replaces the derived tables in one transaction, because supabase-js cannot open
 * one and a half-written ladder is worse than a stale one. Takes ReplayResult as it
 * comes off the engine.
 */
create function public.apply_replay(
  p_ratings jsonb,
  p_history jsonb,
  p_duration_ms integer
) returns void
  language plpgsql security definer
  set search_path = ''
  as $$
  begin
    -- Supabase preloads pg_safeupdate, so an unqualified delete is refused outright.
    delete from public.rating_history where true;

    insert into public.rating_history
      (game_id, profile_id, mu_before, mu_after, display_before, display_after)
    select
      (entry ->> 'gameId')::uuid,
      (entry ->> 'profileId')::uuid,
      (entry ->> 'muBefore')::double precision,
      (entry ->> 'muAfter')::double precision,
      (entry ->> 'displayBefore')::integer,
      (entry ->> 'displayAfter')::integer
    from jsonb_array_elements(p_history) as entry;

    delete from public.player_ratings
    where profile_id not in (
      select (entry ->> 'profileId')::uuid from jsonb_array_elements(p_ratings) as entry
    );

    insert into public.player_ratings
      (profile_id, mu, sigma, games_played, display_rating, tier,
       in_placement, is_active, last_played_at, updated_at)
    select
      (entry ->> 'profileId')::uuid,
      (entry ->> 'mu')::double precision,
      (entry ->> 'sigma')::double precision,
      (entry ->> 'gamesPlayed')::integer,
      (entry ->> 'displayRating')::integer,
      (entry ->> 'tier')::public.tier,
      (entry ->> 'inPlacement')::boolean,
      (entry ->> 'active')::boolean,
      case
        when entry ->> 'lastPlayedAt' is null then null
        else to_timestamp((entry ->> 'lastPlayedAt')::bigint / 1000.0)
      end,
      now()
    from jsonb_array_elements(p_ratings) as entry
    on conflict (profile_id) do update set
      mu = excluded.mu,
      sigma = excluded.sigma,
      games_played = excluded.games_played,
      display_rating = excluded.display_rating,
      tier = excluded.tier,
      in_placement = excluded.in_placement,
      is_active = excluded.is_active,
      last_played_at = excluded.last_played_at,
      updated_at = excluded.updated_at;

    update public.rating_replay_state
    set last_replay_at = now(),
        games_replayed = (select count(*) from public.games where status = 'confirmed'),
        duration_ms = p_duration_ms
    where singleton;
  end
  $$;

alter table public.player_ratings enable row level security;
alter table public.rating_history enable row level security;
alter table public.rating_replay_state enable row level security;

create policy "club members read every rating"
  on public.player_ratings for select
  to authenticated
  using ((select public.is_club_member()));

create policy "club members read every rating change"
  on public.rating_history for select
  to authenticated
  using ((select public.is_club_member()));

create policy "club members see when ratings were last rebuilt"
  on public.rating_replay_state for select
  to authenticated
  using ((select public.is_club_member()));

revoke all on table public.player_ratings from anon, authenticated;
revoke all on table public.rating_history from anon, authenticated;
revoke all on table public.rating_replay_state from anon, authenticated;
grant select on table public.player_ratings to authenticated;
grant select on table public.rating_history to authenticated;
grant select on table public.rating_replay_state to authenticated;

revoke all on function public.replay_input() from public, anon, authenticated;
revoke all on function public.apply_replay(jsonb, jsonb, integer)
  from public, anon, authenticated;
grant execute on function public.replay_input() to service_role;
grant execute on function public.apply_replay(jsonb, jsonb, integer) to service_role;
