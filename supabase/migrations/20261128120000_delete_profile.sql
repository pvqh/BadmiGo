/**
 * Story 79: an admin deletes an account that has never played. Every game is rating
 * input for three other people, so an account with any game, pending or not, is
 * refused; voiding the games first is the admin's own, deliberate step.
 *
 * Deleting the auth.users row cascades to the profile and everything hanging off it
 * (ratings, notification settings, push subscriptions), so the login cannot outlive
 * the profile and quietly make a fresh one.
 */
create function public.delete_profile(p_profile uuid) returns void
  language plpgsql security definer
  set search_path = ''
  as $$
  begin
    if not exists (select 1 from public.profiles where id = p_profile) then
      raise exception 'Không tìm thấy tài khoản này' using errcode = 'P0002';
    end if;

    if exists (select 1 from public.game_participants where profile_id = p_profile) then
      raise exception 'Người này đã có trận đấu nên không xoá được' using errcode = '23503';
    end if;

    delete from auth.users where id = p_profile;
  end
  $$;

revoke all on function public.delete_profile(uuid) from public, anon, authenticated;
grant execute on function public.delete_profile(uuid) to service_role;
