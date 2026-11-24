/**
 * Story 21: an optional photo as a memento. Storage is the one thing here that could
 * cost money, so the bucket only takes small JPEGs — the app shrinks a photo before
 * upload — and it is private: club members read it, nobody else can.
 */
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('game-photos', 'game-photos', false, 524288, array['image/jpeg']);

create policy "club members see game photos"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'game-photos' and (select public.is_club_member()));

-- Each member uploads only into a folder named after themselves.
create policy "a member uploads a game photo into their own folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'game-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select public.is_club_member())
  );

-- log_game takes the path from the client, so this is what stops a game pointing at
-- a photo someone else uploaded. Checked on insert only, not as a table constraint,
-- because a merge moves a game to the kept account while its photo stays where the
-- duplicate uploaded it.
create function public.photo_is_the_loggers() returns trigger
  language plpgsql
  set search_path = ''
  as $$
  begin
    if new.photo_path is not null and new.photo_path not like (new.logger_id::text || '/%') then
      raise exception 'a game photo must be one its logger uploaded' using errcode = '23514';
    end if;
    return new;
  end
  $$;

create trigger games_photo_is_the_loggers
  before insert on public.games
  for each row execute function public.photo_is_the_loggers();
