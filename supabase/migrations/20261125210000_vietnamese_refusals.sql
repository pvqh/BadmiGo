/**
 * The refusals a member or an admin can actually reach, in Vietnamese like every other
 * sentence on screen. The daily cap is a rolling 24 hours, so a heavy logger can hit
 * it over one weekend. Bodies, signatures and grants are unchanged; only the words are.
 */
create or replace function public.log_game(
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
      raise exception 'Chỉ thành viên câu lạc bộ mới ghi được trận' using errcode = '42501';
    end if;

    if coalesce(array_length(p_side_a, 1), 0) <> 2
      or coalesce(array_length(p_side_b, 1), 0) <> 2
    then
      raise exception 'Mỗi bên phải có đúng hai người' using errcode = '23514';
    end if;

    if (select count(distinct player) from unnest(v_players) as player) <> 4 then
      raise exception 'Bốn người chơi phải là bốn người khác nhau' using errcode = '23514';
    end if;

    if (select count(*) from public.profiles where id = any (v_players)) <> 4 then
      raise exception 'Cả bốn người phải là thành viên câu lạc bộ' using errcode = '23503';
    end if;

    if not (v_logger = any (v_players)) then
      raise exception 'Người ghi phải là một trong bốn người chơi' using errcode = '42501';
    end if;

    if (
      select count(*) from public.games
      where logger_id = v_logger and created_at >= now() - interval '1 day'
    ) >= public.daily_log_cap() then
      raise exception 'Bạn đã ghi % trận trong 24 giờ qua, là mức tối đa', public.daily_log_cap()
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

create or replace function public.merge_profiles(p_keep uuid, p_merge uuid) returns void
  language plpgsql security definer
  set search_path = ''
  as $$
  begin
    if p_keep = p_merge then
      raise exception 'Không thể gộp một tài khoản vào chính nó' using errcode = '22023';
    end if;

    if (select count(*) from public.profiles where id in (p_keep, p_merge)) <> 2 then
      raise exception 'Không tìm thấy một trong hai tài khoản' using errcode = 'P0002';
    end if;

    if exists (
      select 1
      from public.game_participants kept
      join public.game_participants merged using (game_id)
      where kept.profile_id = p_keep and merged.profile_id = p_merge
    ) then
      raise exception 'Hai tài khoản cùng chơi một trận; hãy gỡ trận đó trước'
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
