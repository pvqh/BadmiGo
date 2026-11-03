create table public.games (
  id uuid primary key default gen_random_uuid(),
  logger_id uuid not null references public.profiles (id) on delete restrict,
  format smallint not null,
  score_a smallint not null,
  score_b smallint not null,
  winning_side public.side generated always as
    (case when score_a > score_b then 'a'::public.side else 'b'::public.side end) stored,
  played_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  status public.game_status not null default 'pending',
  void_reason text,
  photo_path text,
  constraint games_format_known check (format in (11, 15, 21)),
  constraint games_scores_in_range check (score_a between 0 and 30 and score_b between 0 and 30),
  constraint games_have_a_winner check (score_a <> score_b),
  constraint games_void_reason_matches_status
    check ((status = 'voided') = (void_reason is not null)),
  constraint games_not_logged_before_played check (played_at <= created_at + interval '1 minute')
);

comment on column public.games.created_at is
  'The auto-accept clock runs from here, never from played_at, so backdating a game '
  'cannot shorten the twenty-four hours the other three have to respond.';

comment on table public.games is
  'Scores carry only the structural constraints above. Badminton validity — win by '
  'two, the cap at 30, the three formats — belongs to src/domain/validation and is '
  'not restated here, because one rule in two languages drifts. The backstop is '
  'social: all four names are public and three confirmations are required.';

create table public.game_participants (
  game_id uuid not null references public.games (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete restrict,
  side public.side not null,
  primary key (game_id, profile_id)
);

create table public.game_confirmations (
  game_id uuid not null,
  profile_id uuid not null,
  state public.confirmation_state not null default 'pending',
  responded_at timestamptz,
  primary key (game_id, profile_id),
  /*
   * The composite key is the real guarantee: a confirmation can only exist for
   * someone who actually played. The plain reference to games alongside it is the
   * same truth stated directly, which is what lets a reader ask for a game and its
   * answers in one query — PostgREST only follows declared relationships, and it
   * cannot see this one through the pair above.
   */
  foreign key (game_id, profile_id)
    references public.game_participants (game_id, profile_id) on delete cascade,
  foreign key (game_id) references public.games (id) on delete cascade,
  constraint game_confirmations_responded_when_answered
    check ((state = 'pending') = (responded_at is null))
);

/**
 * A game with three participants, or three per side, would break both the lifecycle
 * reducer and the replay. Deferred so the one transaction in public.log_game can
 * insert the game, its four participants and their four confirmations in any order
 * and be judged once, at commit, on the result.
 */
create function public.assert_game_shape() returns trigger
  language plpgsql
  set search_path = ''
  as $$
  declare
    v_game uuid;
    v_side_a integer;
    v_side_b integer;
    v_confirmations integer;
  begin
    if tg_op = 'DELETE' then
      v_game := old.game_id;
    else
      v_game := new.game_id;
    end if;

    -- Voiding or deleting a game cascades its rows away; there is no shape left to judge.
    if not exists (select 1 from public.games where id = v_game) then
      return null;
    end if;

    select
      count(*) filter (where side = 'a'),
      count(*) filter (where side = 'b')
      into v_side_a, v_side_b
      from public.game_participants
      where game_id = v_game;

    if v_side_a <> 2 or v_side_b <> 2 then
      raise exception
        'game % needs exactly two players per side, has % and %', v_game, v_side_a, v_side_b
        using errcode = '23514';
    end if;

    select count(*) into v_confirmations
      from public.game_confirmations where game_id = v_game;

    if v_confirmations <> 4 then
      raise exception
        'game % needs one confirmation row per participant, has %', v_game, v_confirmations
        using errcode = '23514';
    end if;

    return null;
  end
  $$;

create constraint trigger game_participants_shape
  after insert or update or delete on public.game_participants
  deferrable initially deferred
  for each row execute function public.assert_game_shape();

create constraint trigger game_confirmations_shape
  after insert or update or delete on public.game_confirmations
  deferrable initially deferred
  for each row execute function public.assert_game_shape();

create index games_feed on public.games (status, played_at desc);
create index games_logger_rate_limit on public.games (logger_id, created_at desc);
create index game_participants_by_player on public.game_participants (profile_id);
create index game_confirmations_awaiting on public.game_confirmations (profile_id, state);

alter table public.games enable row level security;
alter table public.game_participants enable row level security;
alter table public.game_confirmations enable row level security;

create policy "club members read every game"
  on public.games for select
  to authenticated
  using ((select public.is_club_member()));

create policy "club members read every participant"
  on public.game_participants for select
  to authenticated
  using ((select public.is_club_member()));

create policy "club members read every confirmation"
  on public.game_confirmations for select
  to authenticated
  using ((select public.is_club_member()));

/**
 * No client writes any of these three tables. Logging goes through public.log_game,
 * and every status change goes through an Edge Function holding the service role, so
 * a patched client cannot confirm on another player's behalf or edit a settled score.
 */
revoke all on table public.games from anon, authenticated;
revoke all on table public.game_participants from anon, authenticated;
revoke all on table public.game_confirmations from anon, authenticated;
grant select on table public.games to authenticated;
grant select on table public.game_participants to authenticated;
grant select on table public.game_confirmations to authenticated;
