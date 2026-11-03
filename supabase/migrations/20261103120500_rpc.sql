/**
 * Every write a phone is allowed to make, other than its own profile fields and its
 * own device token, happens through one of these. They hold no rules the domain core
 * owns: what they hold is the atomicity supabase-js cannot express, because a client
 * cannot open a transaction and a game is nine rows.
 */

/**
 * Completes signup. Called once per account, by every route in — username, email,
 * Google and Apple alike — so there is a single path to becoming a club member and
 * no trigger that works for two of the four.
 */
create function public.create_my_profile(
  p_username text,
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
    v_username text := lower(trim(coalesce(p_username, '')));
    v_profile public.profiles;
  begin
    if v_id is null then
      raise exception 'sign in before creating a profile' using errcode = '42501';
    end if;

    if exists (select 1 from public.profiles where id = v_id) then
      raise exception 'this account already has a profile' using errcode = '42710';
    end if;

    select users.email into v_email from auth.users users where users.id = v_id;

    /*
     * A username-only account's auth email is the username at the synthetic domain,
     * so auth's own unique index is what reserves the handle. Deriving it back rather
     * than trusting the argument keeps the two from ever disagreeing, which would
     * otherwise lock the real owner of that handle out permanently.
     */
    if v_email like ('%@' || public.username_email_domain()) then
      v_username := split_part(v_email, '@', 1);
    end if;

    begin
      insert into public.profiles (id, username, display_name, gender, seed_tier)
      values (v_id, v_username, trim(coalesce(p_display_name, '')), p_gender, p_seed_tier)
      returning * into v_profile;
    exception when unique_violation then
      raise exception '% is already taken', v_username using errcode = '23505';
    end;

    insert into public.notification_preferences (profile_id) values (v_id);

    return v_profile;
  end
  $$;

/** Story 10: signup must not fail at the last step on a handle someone else holds. */
create function public.username_available(p_username text) returns boolean
  language sql stable security definer
  set search_path = ''
  as $$
    select public.username_problem(p_username) is null
      and not exists (
        select 1 from public.profiles
        where username = lower(trim(coalesce(p_username, '')))
      )
  $$;

/**
 * Logs a game: the game, its four participants, and a confirmation row each, with
 * the logger's already answered. One transaction, so the deferred shape triggers see
 * a whole game and a crash leaves nothing behind.
 *
 * played_at is not a parameter. A game is logged courtside, seconds after it ends,
 * and keeping the clock out of the client's hands means a replay can never be
 * reordered from a phone.
 */
create function public.log_game(
  p_format integer,
  p_side_a uuid[],
  p_side_b uuid[],
  p_score_a integer,
  p_score_b integer,
  p_photo_path text default null
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

    -- The logger confirms the game implicitly, which only means anything if they played in it.
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

    insert into public.games (logger_id, format, score_a, score_b, photo_path)
    values (v_logger, p_format, p_score_a, p_score_b, p_photo_path)
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

revoke all on function public.create_my_profile(text, text, public.gender, public.tier)
  from public, anon;
revoke all on function public.username_available(text) from public;
revoke all on function public.log_game(integer, uuid[], uuid[], integer, integer, text)
  from public, anon;

grant execute on function public.create_my_profile(text, text, public.gender, public.tier)
  to authenticated;
grant execute on function public.username_available(text) to anon, authenticated;
grant execute on function public.log_game(integer, uuid[], uuid[], integer, integer, text)
  to authenticated;
