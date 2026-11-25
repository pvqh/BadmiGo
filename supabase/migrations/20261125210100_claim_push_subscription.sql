/**
 * A phone that changes hands keeps its push endpoint, and the new owner's upsert of it
 * was refused: ON CONFLICT DO UPDATE also checks the existing row against the select
 * policy, and that row is someone else's. A sign-out whose clean-up failed leaves
 * exactly that row behind, so the claim moves here, where it can see the old owner's.
 *
 * The update policy that tried to allow it is dropped: nothing else updates a
 * subscription, and this function is now the only way one changes owner.
 */
create function public.claim_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text
) returns void
  language plpgsql security definer
  set search_path = ''
  as $$
  begin
    if auth.uid() is null or not exists (select 1 from public.profiles where id = auth.uid()) then
      raise exception 'Hãy đăng nhập trước' using errcode = '42501';
    end if;

    insert into public.push_subscriptions (endpoint, p256dh, auth, profile_id, updated_at)
    values (p_endpoint, p_p256dh, p_auth, auth.uid(), now())
    on conflict (endpoint) do update
      set p256dh = excluded.p256dh,
          auth = excluded.auth,
          profile_id = excluded.profile_id,
          updated_at = excluded.updated_at;
  end
  $$;

revoke all on function public.claim_push_subscription(text, text, text) from public, anon;
grant execute on function public.claim_push_subscription(text, text, text) to authenticated;

drop policy "a player claims a push subscription" on public.push_subscriptions;
revoke update on table public.push_subscriptions from authenticated;
