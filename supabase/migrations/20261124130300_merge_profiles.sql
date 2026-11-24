/**
 * Story 69: folds a duplicate account into the one its owner keeps. Every game the
 * duplicate played, logged or answered moves across; then its auth account is
 * deleted, and the cascade takes the profile, derived ratings and device
 * subscriptions with it. The admin function then replays, which is what makes the
 * merged history count (story 67).
 *
 * One transaction, because a game half-moved between two players breaks the shape
 * every replay depends on, and a profile deleted without its login would let the
 * owner sign in and quietly make a fresh one. Refused when both accounts played in the same game: no
 * player can partner or oppose themselves, so that game has to be voided first.
 */
create function public.merge_profiles(p_keep uuid, p_merge uuid) returns void
  language plpgsql security definer
  set search_path = ''
  as $$
  begin
    if p_keep = p_merge then
      raise exception 'an account cannot be merged into itself' using errcode = '22023';
    end if;

    if (select count(*) from public.profiles where id in (p_keep, p_merge)) <> 2 then
      raise exception 'both accounts must exist' using errcode = 'P0002';
    end if;

    if exists (
      select 1
      from public.game_participants kept
      join public.game_participants merged using (game_id)
      where kept.profile_id = p_keep and merged.profile_id = p_merge
    ) then
      raise exception 'both accounts played in the same game; void that game first'
        using errcode = '23514';
    end if;

    -- A confirmation hangs off its participant row, so the new pair is written before
    -- the old pair is removed; the shape triggers are deferred and judge the result.
    insert into public.game_participants (game_id, profile_id, side)
    select game_id, p_keep, side from public.game_participants where profile_id = p_merge;

    insert into public.game_confirmations (game_id, profile_id, state, responded_at)
    select game_id, p_keep, state, responded_at
    from public.game_confirmations where profile_id = p_merge;

    delete from public.game_participants where profile_id = p_merge;

    update public.games set logger_id = p_keep where logger_id = p_merge;

    delete from auth.users where id = p_merge;
  end
  $$;

revoke all on function public.merge_profiles(uuid, uuid) from public, anon, authenticated;
grant execute on function public.merge_profiles(uuid, uuid) to service_role;
