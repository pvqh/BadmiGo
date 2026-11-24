-- Redefines apply_replay with a lock as its first statement, and returns the ladder
-- it replaces; the body is otherwise unchanged from 20261103120300_derived_ratings.sql.
-- The return type changes, so it is dropped and created rather than replaced.
drop function public.apply_replay(jsonb, jsonb, integer);

create function public.apply_replay(
  p_ratings jsonb,
  p_history jsonb,
  p_duration_ms integer
) returns setof public.player_ratings
  language plpgsql security definer
  set search_path = ''
  as $$
  begin
    /*
     * Two games confirmed in the same second start two replays. Each deletes the
     * history rows its own snapshot can see and then inserts the same keys, so without
     * this the second fails on a unique violation and the ladder stays stale. Queued,
     * the second simply rewrites the first's output with its own, equally complete one.
     */
    perform pg_advisory_xact_lock(hashtext('apply_replay'));

    -- The ladder as it stood, read under the lock, so the caller can tell who was
    -- passed (story 63) and two queued replays never both compare against the same one.
    return query select * from public.player_ratings;

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

revoke all on function public.apply_replay(jsonb, jsonb, integer)
  from public, anon, authenticated;
grant execute on function public.apply_replay(jsonb, jsonb, integer) to service_role;
