/**
 * The one way a game's status ever changes after it is logged.
 *
 * The decision is not made here. src/domain/game-lifecycle reduces (state, event) to
 * the next state, the confirm-game and auto-accept Edge Functions call it, and this
 * writes down what it returned — the game row and the confirmation rows together, so
 * a reader can never catch a game confirmed with a participant still pending.
 *
 * Service role only. A phone cannot reach it, which is what stops a patched client
 * confirming on someone else's behalf.
 *
 * The decision was made from a state read in an earlier request, so that state is
 * passed back in and checked first. Two participants tapping confirm in the same
 * moment would otherwise each write the other's row back to what they saw. On a
 * mismatch this raises serialization_failure and the caller reads and decides again.
 */
create function public.persist_game_state(
  p_game_id uuid,
  p_expected_status public.game_status,
  p_expected_confirmations jsonb,
  p_status public.game_status,
  p_confirmations jsonb,
  -- Defaulted, and therefore last, so a caller with nothing to say may omit it.
  p_void_reason text default null
) returns void
  language plpgsql security definer
  set search_path = ''
  as $$
  declare
    v_stale integer;
  begin
    if (select status from public.games where id = p_game_id) is distinct from
       p_expected_status
    then
      raise exception 'game % moved on before the decision landed', p_game_id
        using errcode = '40001';
    end if;

    select count(*) into v_stale
    from jsonb_array_elements(p_expected_confirmations) as entry
    left join public.game_confirmations confirmation
      on confirmation.game_id = p_game_id
      and confirmation.profile_id = (entry ->> 'profileId')::uuid
    where confirmation.state is null
       or confirmation.state::text <> (entry ->> 'state');

    if v_stale > 0 then
      raise exception '% confirmations on game % moved on before the decision landed',
        v_stale, p_game_id
        using errcode = '40001';
    end if;

    update public.game_confirmations confirmation
    set
      state = (entry ->> 'state')::public.confirmation_state,
      -- The first answer keeps its timestamp; re-persisting must not move it.
      responded_at = case
        when (entry ->> 'state') = 'pending' then null
        else coalesce(confirmation.responded_at, now())
      end
    from jsonb_array_elements(p_confirmations) as entry
    where confirmation.game_id = p_game_id
      and confirmation.profile_id = (entry ->> 'profileId')::uuid
      and confirmation.state::text <> (entry ->> 'state');

    update public.games
    set status = p_status,
        void_reason = p_void_reason
    where id = p_game_id;
  end
  $$;

revoke all on function public.persist_game_state(
  uuid, public.game_status, jsonb, public.game_status, jsonb, text
) from public, anon, authenticated;

grant execute on function public.persist_game_state(
  uuid, public.game_status, jsonb, public.game_status, jsonb, text
) to service_role;
