/**
 * Story 21 removed: games carry no photo or video. Storage is the one thing that
 * could cost money, and the author would rather pay for it once video is wanted than
 * keep a photo nobody asked for.
 *
 * The game-photos bucket itself is left for the dashboard to delete: Supabase refuses
 * direct SQL deletes from storage tables, and with its policies gone nobody can read
 * or write it.
 */
drop policy "club members see game photos" on storage.objects;
drop policy "a member uploads a game photo into their own folder" on storage.objects;

drop trigger games_photo_is_the_loggers on public.games;
drop function public.photo_is_the_loggers();

drop function public.log_game(integer, uuid[], uuid[], integer, integer, text);

alter table public.games drop column photo_path;

/** As before, less the photo. See 20261103120500_rpc.sql for why each guard exists. */
create function public.log_game(
  p_format integer,
  p_side_a uuid[],
  p_side_b uuid[],
  p_score_a integer,
  p_score_b integer
) returns uuid
  language plpgsql security definer
  set search_path = ''
  as $$
  declare
    v_logger uuid := auth.uid();
    v_players uuid[] := coalesce(p_side_a, '{}') || coalesce(p_side_b, '{}');
    v_game uuid;
  begin
    if v_logger is null or not exists (select 1 from public.profiles where id = v_logger) then
      raise exception 'only a club member may log a game' using errcode = '42501';
    end if;

    if coalesce(array_length(p_side_a, 1), 0) <> 2
      or coalesce(array_length(p_side_b, 1), 0) <> 2
    then
      raise exception 'a game needs exactly two players per side' using errcode = '23514';
    end if;

    if (select count(distinct player) from unnest(v_players) as player) <> 4 then
      raise exception 'the four players must be four different people' using errcode = '23514';
    end if;

    if (select count(*) from public.profiles where id = any (v_players)) <> 4 then
      raise exception 'every player must be a registered club member' using errcode = '23503';
    end if;

    if not (v_logger = any (v_players)) then
      raise exception 'the logger must be one of the four players' using errcode = '42501';
    end if;

    if (
      select count(*) from public.games
      where logger_id = v_logger and created_at >= now() - interval '1 day'
    ) >= public.daily_log_cap() then
      raise exception 'you have logged % games today, which is the cap', public.daily_log_cap()
        using errcode = '54000';
    end if;

    insert into public.games (logger_id, format, score_a, score_b)
    values (v_logger, p_format, p_score_a, p_score_b)
    returning id into v_game;

    insert into public.game_participants (game_id, profile_id, side)
    select v_game, player, 'a'::public.side from unnest(p_side_a) as player
    union all
    select v_game, player, 'b'::public.side from unnest(p_side_b) as player;

    insert into public.game_confirmations (game_id, profile_id, state, responded_at)
    select
      v_game,
      participant.profile_id,
      case when participant.profile_id = v_logger then 'confirmed' else 'pending' end
        ::public.confirmation_state,
      case when participant.profile_id = v_logger then now() end
    from public.game_participants participant
    where participant.game_id = v_game;

    return v_game;
  end
  $$;

revoke all on function public.log_game(integer, uuid[], uuid[], integer, integer)
  from public, anon;
grant execute on function public.log_game(integer, uuid[], uuid[], integer, integer)
  to authenticated;
