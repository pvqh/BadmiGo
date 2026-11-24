-- Story 16 adds games to 31, capped at 40. The score rules live in
-- src/domain/validation; these only keep the columns structurally sane.
alter table public.games drop constraint games_format_known;
alter table public.games add constraint games_format_known check (format in (11, 15, 21, 31));

alter table public.games drop constraint games_scores_in_range;
alter table public.games add constraint games_scores_in_range
  check (score_a between 0 and 40 and score_b between 0 and 40);
