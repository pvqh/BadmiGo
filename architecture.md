# Architecture — Badminton Club Ladder

A map of the whole system: what each piece is, why it is shaped that way, and how the
pieces reach each other. Written against the repository as of **2026-11-04**.

Companion documents:

- `CLAUDE.md` — the hard rules and the append-only Decision Log. Takes precedence.
- `docs/SPEC.md` — the agreed specification and the 74 user stories.
- `docs/BACKEND.md` — the operational view of the database and functions.
- `manual.md` — how to actually run all of this, step by step.

---

## 1. What the system is

A free iOS app for one badminton club of about thirty people who play doubles twice
every weekend, roughly 300 rated games a month.

The loop is four steps:

1. A player finishes a doubles game and **logs** it: four names, two per side, a score.
2. The other three get a push notification and **confirm** with one tap.
3. Once all four have agreed, an **OpenSkill rating moves** for all four.
4. A home-screen **widget** shows the top five men, the top five women, and the
   viewer's own rank.

Because every game carries all four names publicly and needs their agreement, the
record polices itself. There is no referee role and no moderation queue.

---

## 2. The two ideas everything else follows from

Almost every structural decision in this repository is downstream of one of these
two. If you understand them you can predict where any given piece of code lives.

### 2.1 Games are authoritative. Ratings are derived.

Confirmed games are the only data anyone writes. **Every** rating in the database is
the output of replaying the whole ordered confirmed-game history through the engine.
Nothing ever writes a rating as a fact in its own right.

What that buys:

- Any rating parameter — placement length, seed values, the display scale, the tier
  bands — can change later without corrupting history. You change the constant and
  replay.
- An admin correction is an *edit to a game* followed by a replay, never a
  hand-patched number. There is no code path that could hand-patch one.
- The engine is trivially testable, because it is a pure function of a game list.

What it costs: a full replay on every confirmation. At this club's volume (a few
thousand games within a year) that is cheap, and the spec explicitly forbids building
incremental updates as an optimisation until a full replay measurably hurts.

The database enforces this with permissions rather than with trust: `player_ratings`,
`rating_history` and `rating_replay_state` are `select`-only for `authenticated` and
revoked entirely from `anon`. The two functions that read and write them
(`replay_input`, `apply_replay`) are granted to `service_role` alone.

### 2.2 The domain decides. Everything else records.

`src/domain/**` is plain TypeScript over plain data. It imports nothing from React,
React Native, Expo, Supabase, or any I/O library. No clock (time is always passed
in), no randomness, no filesystem.

Every rule that could be *wrong* lives there and is tested there. The layers around
it are deliberately thin enough to need no unit tests of their own:

- An Edge Function reads state, calls a pure function, hands the answer to an RPC.
- An RPC writes down what it was given, atomically.
- A screen reads from `data` and formats output from `domain`.

The spec states the corollary plainly: *"Where an Edge Function appears to need a
test, that is a signal a rule leaked out of the domain core; move the rule in rather
than adding a second seam."*

This is enforced mechanically by `src/domain/purity.test.ts`, which greps every
domain source for forbidden imports.

---

## 3. Stack, and why each piece

| Layer | Choice | Why this one |
|---|---|---|
| App | Expo + React Native, TypeScript, **iOS only** | One developer, one platform, no native build tooling to maintain. |
| Rating model | `openskill.js`, Plackett-Luce | Elo is a 1v1 model bent into doubles by averaging and carries no notion of uncertainty, which matters enormously when newbies and strong players share one pool. TrueSkill is the same model family but patented for commercial use. |
| Backend | Supabase free tier | Postgres + Auth + Realtime + Edge Functions in one free box. Row-level security is the whole trust model. |
| Server runtime | Supabase Edge Functions (Deno 2) | Can import the TypeScript domain core *directly*, so the rating engine that runs in production is literally the one the tests exercise. |
| Auth email | Resend as custom SMTP | Supabase's built-in mailer is rate-limited to a trickle. A password reset that silently never arrives is how a community quietly stops using an app. |
| Client cache | `@tanstack/react-query` | Server state with invalidation, instead of hand-rolled loading flags in every screen. |
| Session storage | `@react-native-async-storage/async-storage` | So a member stays signed in between weekends. |
| Widget | Swift / WidgetKit via `expo-apple-targets`, App Group | **Not built yet.** A widget cannot hold a session token, so it renders a payload the host app writes into a shared container. |
| Distribution | TestFlight only | Closed community, invite only. Not the public App Store. |

The only running cost is **$99/year to Apple**, because the App Group entitlement the
widget needs is unavailable to free personal developer teams. Supabase and Resend both
stay inside free tiers at this scale.

---

## 4. Repository map

```
CLAUDE.md                  hard rules + append-only Decision Log  (the contract)
docs/SPEC.md               the agreed spec, 74 user stories
docs/BACKEND.md            operational notes for the backend
architecture.md            this file
manual.md                  how to run it

app.json                   Expo config: scheme, bundle id, plugins, dark only
tsconfig.json              strict, noUnusedLocals, allowImportingTsExtensions
vitest.config.ts           scopes test collection to src/** (see 4.1)
.env.example               EXPO_PUBLIC_* for the phone

app/                       THE ROUTES — expo-router, file-based
  _layout.tsx              providers + the auth gate (Stack.Protected)
  (tabs)/_layout.tsx       the four tabs
  (tabs)/index.tsx         the ladder
  (tabs)/feed.tsx          every confirmed game, club-wide
  (tabs)/log.tsx           log a game, with the live rating preview
  (tabs)/me.tsx            my profile
  game/[id].tsx            one game in full, and the confirm/dispute buttons
  player/[id].tsx          anyone's profile
  sign-in.tsx              username-or-email, Google, Apple
  sign-up.tsx              create an account
  create-profile.tsx       the account-to-member step
  reset-password.tsx       story 5
  settings.tsx             notification preferences, change password, sign out

src/domain/                THE PURE CORE — no I/O, no clock, no randomness
  types.ts                 ProfileId, GameFormat, Side, Tier
  rating-scale.ts          every tunable rating parameter, in one file
  rating.ts                replayRatings() — the one way a rating is produced
  rating-preview.ts        the untrusted pre-submit preview
  game-lifecycle.ts        (state, event) -> state reducer
  validation.ts            badminton score validity, side shape
  stats.ts                 win/loss, partners, head-to-head, PvE
  *.test.ts                172 tests, all behaviour-through-the-interface
  purity.test.ts           enforces "the domain imports nothing"

src/data/                  THE ONLY MODULE THAT TALKS TO SUPABASE
  client.ts                the single Supabase client + unwrap()
  database.types.ts        GENERATED by `npm run types:db` — never hand-edit
  auth.ts                  sign in/up/out, username rules, create_my_profile
  games.ts                 log_game, confirm-game, the feed queries
  ladder.ts                player_ratings, rating_history, player search
  notifications.ts         push tokens, notification preferences

src/ui/                    FORMATTING, STATE AND COMPONENTS — no rules
  theme.ts                 one dark palette, spacing, type scale, layout
  vocabulary.ts            the club's own words, spelled for the screen
  queries.ts               every react-query key and hook, in one place
  session.tsx              who is using the app, as five explicit states
  game-row.ts              unpacking a feed row the way screens need it
  player-stats.ts          assembling one player's stats from the domain
  player-profile.tsx       the profile body, shared by /me and /player/[id]
  components/
    async.tsx              Pending / Problem / Nothing — the three states
    badge.tsx              TierBadge, PlacementBadge, StatusChip
    button.tsx             Button, ButtonRow
    field.tsx              Field (text) and Choice (segmented)
    game-card.tsx          one game as it appears in a feed
    pending-banner.tsx     "you owe three answers", on opening the app
    player-picker.tsx      search + recents, excluding who is already chosen
    rating-graph.tsx       the rating line, drawn with react-native-svg

src/simulation/            A TEST OF THE PREMISE, NOT THE CODE
  club.ts                  30 synthetic players with known true skill
  recovery.test.ts         does the engine recover a ranking it was never told?

scripts/smoke.ts           the ONE end-to-end check against a local stack

supabase/
  config.toml              auth providers, Resend SMTP, per-function settings
  .env.example             secrets the CLI substitutes into config.toml
  migrations/              the schema, seven files, applied in order
  functions/
    _shared/supabase.ts    client factories + json() helper
    _shared/game-state.ts  read -> reduce -> compare-and-set, with retry
    confirm-game/          a participant's answer
    replay-ratings/        rebuild every rating from history
    auto-accept/           hourly sweep of the 24-hour window
    notify-players/        all three pushes behind one `kind`
```

Nothing is over 300 lines.

### 4.1 Why `vitest.config.ts` exists

It scopes test collection to `src/**` and excludes `.claude/**`. A git worktree under
`.claude/worktrees/` holds a second copy of the whole repository, and vitest's defaults
collected that copy too — so every run doubled and a stale branch reported alongside
the real one. `tsconfig.json` excludes `.claude` for the same reason.

---

## 5. The domain core

### 5.1 `rating-scale.ts` — every tunable number

Deliberately one small file, because `CLAUDE.md` forbids changing any of these
without re-running the simulation harness and reporting the before/after ranking
recovery. Keeping them together keeps that promise auditable.

```
SIGMA_INITIAL          25/3 = 8.3333     OpenSkill's default, for EVERY player
PLACEMENT_GAMES        10                ~1 week at this club's volume
IDLE_GRACE_DAYS        21                off the ladder, and sigma starts to widen
SIGMA_RECOVERY_DAYS    21                PROVISIONAL — see below
DISPLAY_SCALE          40
DISPLAY_CONFIDENCE_Z   1.5               simulation-confirmed; was 3

seed tier -> starting mu      newbie 16 | y 21 | tby 25 | tb-plus 30 | kha 36
display rating -> tier band   newbie <400 | y 400 | tby 600 | tb-plus 880 | kha 1120
```

Three things to understand here:

**A seed tier sets starting `mu` only.** `sigma` stays at full width for everyone, so
a declared level is a hint the model can overrule within a few games. A player who
declares "Khá" and loses six straight will be re-rated quickly.

**`display rating = max(0, (mu - 1.5 * sigma) * 40)`.** The `1.5` was `3` — OpenSkill's
own default — until the simulation harness showed that sigma plateaus near 5.2 at this
club's volume rather than settling low. At `z = 3` that flattened 24 of 150 simulated
players to a display rating of zero. The tier bands moved for the same reason: from a
provisional 550/720/900/1120 to the confirmed 400/600/880/1120, which took
within-one-tier labelling from 59% to 96% and exact-tier from 26% to 49%.

**`SIGMA_RECOVERY_DAYS` is still provisional.** The harness simulates one month and
cannot yet exercise a long absence. This is recorded in the Decision Log as an open
item, not as a settled value.

`inflateSigmaForIdleTime(sigma, idleMs)` is the inactivity rule. It is applied **when a
returning player next plays, never while they are away**. That ordering is the whole
trick: it keeps `replayRatings` a pure function of the game list, and it means an idle
player's rating is preserved exactly as they left it rather than quietly decaying on a
timer nobody can reproduce.

### 5.2 `rating.ts` — the replay

```ts
replayRatings({ seeds, games, now }): { ratings, history }
```

The only way a rating is ever produced. Callers pass confirmed games only; pending,
disputed and voided games are filtered out before they get here.

Per game:

1. Resolve all four players. A game naming someone with no seed **throws** rather than
   inventing a default — a silently skipped player would quietly distort everyone.
2. Widen each player's sigma for however long they have been away.
3. Call `openskill.rate([winners, losers])` — only *which side scored more* is read.
4. Record `muBefore/muAfter` and `displayBefore/displayAfter` for all four.

Three properties worth naming:

- **Margin of victory is recorded but is not an input.** 21-0 and 21-19 move ratings
  identically, so nobody is ever obliged to humiliate a weaker opponent for points.
- **Games are sorted inside the function**, by `playedAt` then by `id`, rather than
  trusted from the caller. The same set of games cannot produce two different ladders.
- **`displayBefore` is captured before the idle-sigma widening.** That is correct and
  subtle: the ladder displays the *stored* (un-widened) sigma, so `displayBefore` is
  exactly the number the player last saw.

Output is already in ladder order — strongest first, ties broken by profile id.

### 5.3 `game-lifecycle.ts` — the reducer

```ts
applyEvent(state, event): { ok: true, state } | { ok: false, reason }
```

States: `pending -> confirmed | disputed | voided`.
Events: `confirm`, `dispute`, `cancel`, `void`, `resolve`, `elapse`.

The rules, all of them:

- `openGame` starts the game **pending with the logger already confirmed**. The logger
  implicitly agrees with what they just typed. (`log_game` therefore requires the
  logger to be one of the four players — that implicit confirmation only means
  something if they played.)
- A game becomes `confirmed` only when every one of the four is `confirmed`.
- **One dispute freezes the game immediately**, regardless of how many have already
  confirmed. A frozen game accepts only `resolve` (admin) or `void` (admin).
- `elapse` auto-accepts at **exactly** 24 hours from `loggedAt`, sweeping every
  outstanding participant to `confirmed`.
- `cancel` belongs to the logger alone, and only while pending. Once confirmed, a
  rating has moved, so the only route is an admin void.
- A **confirmed game cannot be disputed.** Admin correction or void is the only way
  back, so auto-accept cannot be quietly undone after the ladder has already moved.
- A voided game rejects every event, including another void.

It returns a **result union** rather than the spec's bare `(state, event) -> state`, so
an illegal transition reports *why* instead of being silently dropped. That reason
string travels all the way to the phone: `confirm-game` returns it as a 409 body.

`countsTowardRatings(state)` is the replay's input filter, and it is one line:
`state.status === 'confirmed'`.

### 5.4 `validation.ts` — what counts as a badminton score

```
format 21 -> hard cap 30
format 15 -> hard cap 21
format 11 -> hard cap 15
```

Rally point, win by two, with a hard cap where the next point simply wins. So to 21:
`21-x` needs `x <= 19`; `22..29` must be exactly win-by-two; `30-29` ends it. The caps
for 15 and 11 were added as a Decision Log entry — the spec had fixed a cap only for
games to 21.

`validateProposedGame` returns **every** problem rather than the first, so a logger can
fix a bad score and a duplicated name in one pass instead of playing whack-a-mole.

This rule is **deliberately not restated as a SQL constraint.** The database carries
only structural guards (`format in (11,15,21)`, scores 0–30, no draw). One rule written
in two languages drifts; the social backstop — four public names, three confirmations,
an admin void — catches the rest.

### 5.5 `stats.ts` — the secondary numbers

`record`, `partnerBreakdown`, `headToHead`, `performanceVsExpectation`, all derived
from the same confirmed-game list the replay reads. Pure: a caller who wants "this
month" filters the games before calling in.

**Performance vs expectation (PvE)** is the one that matters, and it exists because of
a known limitation. OpenSkill assumes teammates are interchangeable contributors, so
it cannot tell carrying from being carried — and this club deliberately pairs strong
with weak to keep games competitive, which means weaker players riding stronger
partners will drift upward over time. The spec accepts this and attempts no
algorithmic fix, because every attempt to infer individual contribution from a 2v2
result without per-point data ends badly.

The mitigation is a figure that *cannot* be inherited: before predicting each game,
the player themselves is replaced by an **average club member**, and the prediction is
made from the other three alone. Wins above that prediction, per game. Zero means
"exactly as predicted from who you played with and against". Your own rating never
enters the calculation, which is what makes it un-inheritable.

Partner breakdown is **fully public by explicit decision.** The recommendation was to
show a player only their own, because "you win 34% with X" is socially radioactive in
a group that meets every weekend. The author overrode this knowing their community. If
it causes friction the private variant is a small change — but `CLAUDE.md` says do not
make it unilaterally.

### 5.6 `rating-preview.ts` — the honest lie

A logger is shown what each of the four stands to gain or lose **before** submitting.
Hard rule 3 says the client never computes an authoritative rating, so this is kept in
its own file, separate from `rating.ts`, and nothing it produces is ever persisted.

The arithmetic is identical so the preview cannot mislead: it calls the same
`openskill.rate`, and it applies the same idle-sigma widening. `rating-preview.test.ts`
holds it to the replay's own output on the same fixture — which is the single
highest-value test in the repository, because it makes hard rule 3 cheap to keep
rather than a thing you have to remember.

---

## 6. The database

Seven migrations, applied in filename order.

### 6.1 Enums — the club's vocabulary (`...120000_vocabulary.sql`)

```sql
gender              male | female
tier                newbie | y | tby | tb-plus | kha
side                a | b
game_status         pending | confirmed | disputed | voided
confirmation_state  pending | confirmed | disputed
```

Labels match the TypeScript literal unions in `src/domain/types.ts` **exactly**, so
the schema and the domain cannot drift apart.

Four immutable SQL functions live here too:

- `reserved_usernames()` — handles a reader would mistake for the app speaking:
  `admin`, `system`, `club`, `ladder`, `everyone`, `null`, `deleted`, and so on.
- `username_problem(text)` — returns a human-readable reason, or null. Shared
  deliberately between the `profiles` check constraint and the signup screen, so the
  instant feedback a player sees *is* the rule the database applies.
- `username_email_domain()` — `users.badminton-ladder.invalid`. See section 8.
- `daily_log_cap()` — 30. Story 71's flood guard, over a rolling day.

### 6.2 `profiles` (`...120100_profiles.sql`)

```
id            uuid  pk, references auth.users on delete cascade
username      text  not null unique, must equal lower(trim(...)), must pass username_problem
display_name  text  not null, 1..40 chars after trimming
gender        gender
seed_tier     tier
is_admin      boolean  default false
created_at    timestamptz
```

**Having a profile is what makes an authenticated account a club member.** An account
can exist in `auth.users` between signing up and completing a profile, and until then
it must see nothing. That is `is_club_member()`, a `security definer` function so the
policies that call it do not recurse through `profiles`' own RLS.

Row-level security is row-level, so the *columns* a player must not edit on their own
row are guarded by a trigger instead: `guard_profile_columns()` refuses a change to
`username`, `seed_tier`, `is_admin` or `created_at` from a non-admin. It is
`security invoker` deliberately — inside a `security definer` function `current_user`
would be the definer, so the role that actually asked would be invisible. It needs no
privilege of its own, because `is_admin()` is the definer that reads `profiles`.

The trigger only polices `current_user = 'authenticated'`, which means the service
role and migrations pass through. That is intentional: admin corrections and an
account merge are built from exactly those, and a trigger that blocked them would
block the feature it exists to protect.

`username` is immutable even for its owner, because a username-only account's auth
email is derived from it (section 8).

### 6.3 `games`, `game_participants`, `game_confirmations` (`...120200_games.sql`)

```
games
  id             uuid pk
  logger_id      -> profiles (on delete restrict)
  format         smallint, in (11,15,21)
  score_a/_b     smallint, 0..30, must differ
  winning_side   GENERATED ALWAYS AS (score_a > score_b ? 'a' : 'b') STORED
  played_at      timestamptz default now()   <- the replay's ordering
  created_at     timestamptz default now()   <- the auto-accept clock
  status         game_status default 'pending'
  void_reason    text   -- present exactly when status = 'voided'
  photo_path     text   -- optional memento; no bucket exists yet

game_participants   (game_id, profile_id) pk, side
game_confirmations  (game_id, profile_id) pk, state, responded_at
```

**`played_at` and `created_at` are two clocks on purpose.** The replay orders by
`played_at`; the 24-hour auto-accept window runs from `created_at`. Keeping them
separate means backdating a game could never shorten the twenty-four hours the other
three have to answer.

**`game_confirmations` carries two foreign keys to the same game**, and both are load
bearing:

- `(game_id, profile_id) -> game_participants` is the real guarantee: a confirmation
  can only exist for someone who actually played.
- `(game_id) -> games` is the *same truth stated directly*, and it exists so PostgREST
  can follow it. PostgREST only traverses declared relationships and cannot see this
  one through the composite pair, so without it you could not ask for a game and its
  answers in one query. (See section 15.1 — this relationship is currently missing from
  the generated types, which is a live bug.)

**Shape is enforced by deferred constraint triggers.** `assert_game_shape()` checks
exactly two players per side and exactly four confirmation rows. It is `deferrable
initially deferred` so the single transaction in `log_game` can insert the game, its
four participants and their four confirmations in any order and be judged once, at
commit, on the result. It returns early if the game no longer exists, because voiding
or deleting cascades the rows away and there is no shape left to judge.

Indexes: `(status, played_at desc)` for the feed, `(logger_id, created_at desc)` for
the daily cap, `(profile_id)` on participants, `(profile_id, state)` on confirmations.

### 6.4 The derived tables (`...120300_derived_ratings.sql`)

```
player_ratings       profile_id pk, mu, sigma, games_played, display_rating,
                     tier, in_placement, is_active, last_played_at, updated_at
rating_history       (game_id, profile_id) pk, mu_before/after, display_before/after
rating_replay_state  one row: last_replay_at, games_replayed, duration_ms
```

The JSON field names these are built from are the domain core's own —
`PlayerSeed`, `RatedGame`, `PlayerRating`, `RatingChange` in `src/domain/rating.ts` —
spelled identically on purpose, so the Edge Function between them stays a pipe rather
than a translator that could drift.

`in_placement` is stored rather than recomputed, so the placement count stays a rating
parameter in `rating-scale.ts` and is not restated in SQL. `is_active` is "true as of
the last replay", and `last_played_at` sits beside it because activity decays with the
clock rather than with games — a reader who needs the answer for *right now* should
measure from `last_played_at` rather than trust a frozen flag.

`rating_replay_state` exists so a screen can tell whether the ladder on it reflects
the games below it, and say so rather than lie.

Two `security definer` functions, both `service_role` only:

- **`replay_input()`** returns the complete input as **one jsonb value**, so the
  function cannot page through it wrongly and a replay cannot see a half-read history.
  Every profile is a seed, *including* one who has never played — their rating is
  their seed and they belong on the ladder as provisional, not absent. Times are epoch
  milliseconds, as the domain takes them.
- **`apply_replay(ratings, history, duration_ms)`** replaces the derived tables in one
  transaction, because supabase-js cannot open one and a half-written ladder is worse
  than a stale one.

### 6.5 Notifications (`...120400_notifications.sql`)

`push_tokens` (token pk, profile_id, updated_at) and `notification_preferences`
(confirmation_requests, dispute_alerts, weekly_recap, overtaken_on_ladder). Neither is
in the spec's data model — they were added because stories 22, 25 and 61–64 need
somewhere to live, and that is recorded in the Decision Log.

`overtaken_on_ladder` defaults to **false**, per story 63: a player who finds
competition stressful should never be needled by an app they did not ask to be needled
by.

A push token is private to its owner — the club may read the ladder, not each other's
push addresses. The update policy uses `using (true)` so that claiming a token already
on file is how a shared handset switches owner; it can still only ever point at the
caller, and tokens are unreadable, so there is nothing to redirect blindly.

`current_role_name()` lives here: it returns `anon`, `authenticated` or `service_role`,
and `notify-players` needs it to tell its two kinds of caller apart.

### 6.6 The RPCs (`...120500_rpc.sql`, `...120600_game_state.sql`)

These hold **no rules the domain owns.** What they hold is the atomicity supabase-js
cannot express, because a client cannot open a transaction and a game is nine rows.

**`create_my_profile(username, display_name, gender, seed_tier)`** — completes signup.
Called once per account by every route in, so there is a single path to membership. It
reads the handle back out of the auth email rather than trusting its argument when the
address is synthetic (section 8).

**`username_available(text)`** — `username_problem` is null *and* nobody holds it.

**`log_game(format, side_a[], side_b[], score_a, score_b, photo_path?)`** — one call,
one transaction, nine rows: the game, four participants, four confirmations with the
logger's already answered. Its checks are all structural or social, never badminton
rules: caller is a club member; two per side; four distinct people; all four
registered; **the logger is one of the four**; under the rolling daily cap.
`played_at` is deliberately *not* a parameter — keeping the clock out of the client's
hands means a replay can never be reordered from a phone.

**`persist_game_state(game_id, expected_status, expected_confirmations, status,
confirmations, void_reason?)`** — the one way a game's status ever changes after it is
logged, `service_role` only. It is a **compare-and-set**: the decision was made from a
state read in an earlier request, so that state is passed back in and checked first.
Without it, two participants tapping confirm in the same moment would each write the
other's row back to what they saw. On a mismatch it raises `serialization_failure`
(40001) and the caller reads and decides again.

It writes the game row and the confirmation rows **together**, so a reader can never
catch a game marked confirmed with a participant still pending. `responded_at` uses
`coalesce(existing, now())`, so re-persisting a state cannot move someone's original
answer timestamp.

### 6.7 The trust model, in one table

What a phone may write: **its own profile fields, and its own push token.** That is
all. Everything else is an RPC or a function.

| Route | Who may call it | What it does |
|---|---|---|
| `username_problem` / `username_available` | anyone | instant signup feedback |
| `create_my_profile` | any signed-in account | turns an account into a club member |
| `log_game` | a club member | a game, 4 participants, 4 confirmations, atomically |
| `confirm-game` | a participant | confirm / dispute / cancel, then replay |
| `replay-ratings` | service role only | rebuild every rating from history |
| `auto-accept` | service role only, hourly | sweep games past 24 hours |
| `notify-players` | service role, or a participant of that game | the push for one game |
| `persist_game_state` | service role only | record a lifecycle decision |
| `replay_input` / `apply_replay` | service role only | read / write the derived tables |

`games`, `game_participants`, `game_confirmations` and all three derived tables are
`select`-only for `authenticated` and revoked entirely from `anon`.

Story 74 — *"ratings cannot be computed or altered from a phone"* — is therefore a
property of the **grants**, not of the client code. `scripts/smoke.ts` asserts it
directly: a member cannot write a rating, cannot insert a game outside `log_game`,
and cannot make themselves an admin.

---

## 7. The server: four Edge Functions

All four run on Deno and **import the domain core directly** from `../../../src/domain/`.
That is why relative imports inside `src/domain` carry explicit `.ts` extensions: it is
the only way a Deno Edge Function can resolve them, and the edge runtime does not
honour Deno's `sloppy-imports`. It means the engine that rates your Saturday game is
the exact file the 172 tests exercise — not a port of it.

`_shared/supabase.ts` offers two client factories, and which one a function uses *is*
its authorization model:

- **`serviceClient()`** — full privilege. Used by `confirm-game` and `notify-players`,
  which must act on behalf of a member who is not allowed to do the thing themselves.
- **`callerClient(authorization)`** — anon key plus the caller's own bearer token, so
  **the database decides** what the caller may do. Used by `replay-ratings` and
  `auto-accept`. Because the privileged work is granted to `service_role` alone, these
  two functions do not re-implement the permission check and *cannot forget to*. A club
  member with a perfectly valid token gets a 403 from Postgres.

`_shared/game-state.ts` is the read-reduce-write loop, used by two functions:

```
read game + confirmations  ->  applyEvent(state, event)  ->  persist_game_state(...)
       ^                                                              |
       |______________ 40001 serialization_failure ___________________|
                        (up to 3 attempts, then 'contended')
```

Three attempts is enough for two participants answering at the same instant; a third
collision is a real queue and is reported as such.

### `confirm-game` — a participant's answer

1. Resolve the caller's profile from the bearer token; 401 if absent.
2. Parse `{ gameId, answer }` where answer is `confirm` | `dispute` | `cancel`.
   `void` and `resolve` are the admin's and deliberately do not exist on this route.
3. `applyGameEvent`. A rejection becomes **409 with the reducer's own reason string**
   (`not-a-participant`, `already-responded`, `not-the-logger`, …), a missing game 404,
   contention 503.
4. If the game is now `confirmed`, **invoke `replay-ratings`**. Replaying here rather
   than on a schedule is what makes a confirming player see the ladder change. A
   failure past this point leaves the record right and the ladder stale — which
   `rating_replay_state` shows — so it is *reported* as `replayed: false` rather than
   turned into a failed confirmation the client would retry.
5. Invoke `notify-players` with `confirmed` or `dispute`.
6. Return `{ status, replayed }`.

### `replay-ratings` — rebuild everything

`replay_input()` -> `replayRatings(...)` -> `apply_replay(...)`. Always from zero.

The json crossing from Postgres is **narrowed, not asserted** — `parseSeed`,
`parseGame`, `asPair` and friends reject anything malformed. The comment explains why
this is worth the lines: *"A replay that quietly rated a malformed game is the one
fault in this system that replaying history cannot undo, because history is what would
be wrong."*

One cast exists, `asJson`, and it is documented: the engine returns readonly
interfaces that serialize exactly as the SQL expects, but an interface has no index
signature so TypeScript will not call one `Json`. That cast is the entire cost of
spelling the payload the way the engine spells it instead of translating field by field.

### `auto-accept` — the hourly sweep

Checks `current_role_name() = 'service_role'` **up front**, because the first
privileged call is deep inside the loop; without the early check a member would get a
500 on the one run that had a ripe game and a 200 on every other.

Then: every pending game is offered an `elapse` event and **the reducer decides which
are ripe** — the twenty-four hours stay in the domain. One replay for the whole sweep,
then a silent push per accepted game.

It has **no scheduler of its own**, and story 26 does not work without one. It needs
the project ref and the service role key, so it cannot be a migration. `docs/BACKEND.md`
holds the `cron.schedule` + `vault.create_secret` SQL to run once against production.

### `notify-players` — all three pushes, one function

The spec called this `notify-widget`; it was built as `notify-players` carrying the
confirmation request, the dispute alert and the silent widget wake behind one `kind`,
because three near-identical push functions would have been worse than one.

| kind | audience | payload |
|---|---|---|
| `confirmation-request` | the three who are not the logger | visible push |
| `dispute` | all four | visible push |
| `confirmed` | all four | `_contentAvailable: true` — **silent**, wakes the app to reload the widget |

Preferences are respected for the two visible kinds. The silent wake deliberately
ignores them: it carries no message, so there is nothing for a member to have turned
off. Delivery is Expo's push service.

Two kinds of caller: the functions that settle a game hold the service role, and a
member whose phone just logged a game asks for the confirmation request itself — and
is allowed to, but only for a game they played in.

---

## 8. Identity and auth

Three ways in — username+password, email+password, Google, Apple — and **one path to a
profile.** No database trigger creates profiles; all four routes finish by calling
`create_my_profile`, so there is one path to membership rather than one that works for
two of the four.

Apple ships *with* Google, not after it: App Store guideline 4.8 requires an
equivalent privacy-respecting login wherever a third-party one is offered.

### The synthetic email scheme

Supabase authenticates by email, and a member who signs up with a username alone has
no email. The obvious design is a username-to-email lookup — and it was rejected,
because it would expose every member's real address to anyone who can guess a handle.

Instead a username-only account's auth email is **derived** from the handle:

```
hung  ->  hung@users.badminton-ladder.invalid
```

The `.invalid` TLD is reserved by RFC 2606 and can never receive mail, which is the
honest signal: these accounts have no email and cannot reset a password by one.

Two consequences follow:

- **Supabase Auth's own unique index on email is what actually reserves a username.**
  `create_my_profile` reads the handle back out of the address rather than trusting its
  argument, so the two can never disagree — which would otherwise lock the real owner
  of a handle out permanently.
- **The mapping is written twice**, in `public.username_email_domain()` and in
  `src/data/auth.ts`. **Change them together or sign-in breaks.** This is the single
  most dangerous coupling in the repository.

Email confirmations are **off**: synthetic addresses cannot receive mail, and signup has
to fit between games (story 8 — under thirty seconds).

`[auth.rate_limit] email_sent = 30`, raised from the default of 2, because thirty
members might each need a password reset in the same evening and the default would turn
story 5 into "ask the admin" for everyone after the first.

---

## 9. The client

### 9.1 `src/data` — the only module that talks to Supabase

`client.ts` holds the one Supabase client in the app. Everything above `src/data`
reads through this module's siblings and never touches it, so the rest of the app has
no idea where its data comes from.

Two details that matter:

- The two env vars are **spelled out literally**, not looked up by name. Expo inlines
  `process.env.EXPO_PUBLIC_*` at build time by literal substitution, so a dynamic read
  is `undefined` in a built app — it would pass every test here and fail on a phone.
- The session lives in `AsyncStorage` so a member stays signed in. `detectSessionInUrl`
  is off: it is a browser concern and there is no browser.

`unwrap()` turns supabase-js's two-field `{ data, error }` result into a value or a
throw, once, in one place. The handful of readers that can legitimately return nothing
(`readRating`, `myProfile`) handle `{ data, error }` by hand instead, because for them
`null` is an answer rather than a failure.

`database.types.ts` is **generated**: `npm run types:db`. Run it after every migration.
The Edge Functions import it too, so a stale copy is a real bug — and hand-editing it
is worse than a stale copy, because the next regeneration silently reverts the edit.

`FEED_SHAPE` in `games.ts` is one PostgREST select string shared by four queries, and
`GameRow` is named off it (`Awaited<ReturnType<typeof readFeed>>[number]`) rather than
restated, so a change to the shape reaches the screens through the compiler.

There are **no Realtime subscriptions.** No v1 story asks for a live-updating screen:
the ladder and feed refresh on pull and on cache invalidation after an answer, and the
widget is the ambient path. Sockets would be a second staleness model to reason about.

### 9.2 `src/ui` — formatting, state and components, no rules

- **`theme.ts`** — one dark palette, not a light and a dark one, with
  `userInterfaceStyle: "dark"` in `app.json` to match. The app is read courtside and on
  a home screen at a glance, and two themes would double every screen's styling for a
  community of thirty. Figures use `tabular-nums`, because scores and ratings only line
  up in a column if the digits are the same width.
- **`vocabulary.ts`** — the club's own words spelled for the screen. The domain uses
  slugs (`tb-plus`); nothing outside this file writes the labels (`TB+`), so they
  cannot drift into synonyms.
- **`queries.ts`** — every react-query key in one object, so a mutation that has to
  invalidate a key cannot spell it differently from the screen that reads it. The
  invalidation policy is driven by the server's own answer: when `confirm-game`
  reports `replayed: true`, **every rating in the club just changed**, so the whole
  cache is dropped rather than guessed at.
- **`session.tsx`** — who is using the app, as the five states a router actually
  branches on: `loading`, `signed-out`, `needs-profile`, `member`, `unavailable`.
  `needs-profile` is the real gap between an account and a membership — signing in with
  Google creates the first and not the second — and modelling it explicitly is why
  there is no "is this an error or a new user?" conditional anywhere else.
- **`game-row.ts`** — unpacking a feed row: lineup, winner, what it moved for one
  player, how many still owe an answer, how long until auto-accept. It imports
  `AUTO_ACCEPT_MS` from the domain rather than restating 24 hours.
- **`player-stats.ts`** — assembles one player's profile numbers by calling
  `domain/stats` over the games that player appeared in. `startOfMonth` lives here
  because "games this month" (story 54) is a presentation window, not a rule.
- **`components/`** — eight small pieces. The one worth naming is `async.tsx`:
  `Pending`, `Problem` and `Nothing` are the three states every query screen has, so
  no screen hand-rolls a spinner or an error message.

### 9.3 `app/` — the routes

File-based routing with **expo-router**. `package.json` sets
`"main": "expo-router/entry"`; there is no `App.tsx` or `index.ts` any more.

**`app/_layout.tsx` is the whole of the app's access control**, and it is worth reading
once. It mounts `QueryClientProvider` (30-second `staleTime`, one retry — "thirty
players and two sessions a week: a half-minute of staleness is invisible"),
`SafeAreaProvider` and `SessionProvider`, then branches on `useSession().status`:

```
loading      -> <Pending />
unavailable  -> <Problem onRetry={retry} />
otherwise    -> a Stack with three Stack.Protected groups:
                  member        -> (tabs), game/[id], player/[id], settings
                  needs-profile -> create-profile
                  signed-out    -> sign-in, sign-up, reset-password
```

It uses `Stack.Protected` **guards rather than a redirect in an effect**, so there is
no frame in which a signed-out phone has a club member's screen mounted. Every group
redirects to `home`, which is whichever route the *current* status belongs to — so one
expression is the right answer for all three groups.

The four tabs are Ladder, Feed, Log and Me. The ladder screen is the clearest example
of the project's division of labour: it splits the list into **ranked**, *"Finding
their level"* (in placement) and *"Away for 21+ days"*, measuring activity from
`last_played_at` against the current clock rather than trusting the `is_active` flag
the last replay froze — exactly as the column comment in the schema advises. It shows
`rating_replay_state` as *"Ratings last rebuilt 3 min ago"*, which is story 60's
honesty about the few-minute lag.

The log screen is where the domain core surfaces directly in the UI: it calls
`validateProposedGame` on every keystroke (suppressing the score complaint while a box
is still empty — "an empty score box is not yet a wrong one") and `previewGame` to show
what each of the four stands to win or lose, captioned *"An estimate. The ladder itself
is worked out on the server, once all four have agreed."* The logger permanently holds
the first slot, because `log_game` only accepts a game they played in. The lineup
survives submission so an afternoon with the same four is one score each time
(story 18).

---

## 10. The widget — designed, not built

Large size only in v1. The spec's eleven rows (five men, five women, the viewer's rank)
do not fit a small or medium widget, and lock-screen widgets cannot hold them at all.

iOS does not let a widget poll, so three refresh paths work together:

1. A timeline refresh roughly hourly, as the floor.
2. `reloadAllTimelines()` when the app is foregrounded, so the logger sees their own
   change immediately.
3. A **silent background push** (`content-available`) to the other participants when a
   game becomes confirmed, waking their app long enough to reload. That is the
   `confirmed` kind in `notify-players`, and it is already implemented server-side.

The widget **renders a payload the host app writes into the App Group container.** It
does not query Supabase and does not hold a session token.

The UI states "ranks update within a few minutes" (story 60). Chasing true realtime on
an iOS widget is not winnable and is not attempted.

---

## 11. End-to-end walkthroughs

### Logging and confirming a game

```
PHONE                     POSTGRES                    EDGE                 EXPO
  |
  | validateProposedGame()            (src/domain/validation — client-side, instant)
  | previewGame()                     (src/domain/rating-preview — untrusted)
  |
  |--- rpc log_game ------->|
  |                         | 1 txn: game + 4 participants + 4 confirmations
  |                         | logger's own row = 'confirmed'
  |<---- game uuid ---------|
  |
  |--- invoke notify-players {kind: confirmation-request} -->|
  |                                                          |--- push x3 -->|
  |
  :  ... the other three tap confirm ...
  |
  |--- invoke confirm-game {gameId, answer} ---------------->|
  |                         |<-- read game + confirmations --|
  |                         |                                | applyEvent(state, event)
  |                         |<-- persist_game_state ---------|   (compare-and-set,
  |                         |     40001 -> retry, max 3      |    3 attempts)
  |                         |
  |                         |     once all four are confirmed:
  |                         |<-- replay_input() -------------|  invoke replay-ratings
  |                         |                                |  replayRatings(...)
  |                         |<-- apply_replay() -------------|  (whole ladder, from zero)
  |                         |
  |<-- {status, replayed} --|
  |                                                          |--- silent push x4 -->|
  | replayed === true -> drop the entire react-query cache
```

### Nobody answers

`pg_cron` fires hourly (`7 * * * *`) with the service role key from Vault ->
`auto-accept` -> every pending game is offered `elapse` -> the reducer accepts only
those past exactly 24 hours from `created_at` -> one replay for the whole sweep -> a
silent push per accepted game.

### Signing up

```
username only:  signUp("hung")  ->  hung@users.badminton-ladder.invalid
email:          signUp("me@x.com")  ->  me@x.com
Google / Apple: signInWithIdToken(provider, token)
                          |
                          v
            all four -> create_my_profile(username, display_name, gender, seed_tier)
                          |
                          +-> profiles row            (membership begins here)
                          +-> notification_preferences row
```

### An admin corrects a score (design, not built)

Edit the game -> replay. Story 67 requires the recomputation to be automatic. The
pieces exist — the reducer has `void` and `resolve`, `persist_game_state` and
`replay-ratings` exist, `is_admin()` guards the privileged columns — but the functions
that drive them are not written. **Until they are, an admin edit to `seed_tier` leaves
every rating stale** until a replay runs. `rating_replay_state` is how you tell.

---

## 12. Testing

### The seam

**One seam: the pure domain core.** 172 tests across 8 files, all of them asserting
observable behaviour through a module's public interface. Not one asserts that
`openskill.rate` was called, reaches into an intermediate value, or snapshot-tests a
blob of floats.

Most assertions are about **ordering and direction** rather than exact magnitudes —
*did the underdog gain more than the favourite?* — because magnitudes are tuning and
will change. That is a deliberate choice recorded in the spec, and it is why a
parameter change does not cascade into fifty test edits.

Vitest rather than jest-expo: the only unit-tested code is the pure core, which needs
no React Native transform.

What is covered: surprise asymmetry; uncertainty asymmetry; the placement transition
at *exactly* five games; seed tiers producing the expected initial order; inactivity
inflating sigma; margin of victory having no effect; determinism; every lifecycle
transition and every invalid one; the 24-hour boundary; a single dispute freezing a
game regardless of other confirmations; valid and invalid scores for all three formats;
partner breakdown and head-to-head against hand-computed fixtures; PvE near zero for a
player who performs exactly as predicted, and unmovable by their own rating.

### The simulation harness

A deliberate test of the **premise**, not the code — and it runs before any real game
is logged.

Thirty synthetic players with known true skill matching this club's spread (a wide base
of improvers, a few strong players), ~270 games over eight weekend sessions, with
realistic pairing: **70% strong-with-weak**, which is what a club actually does to keep
a game competitive and is exactly the pattern OpenSkill finds hardest. Everything is
driven by an explicit seed (mulberry32), so a run is reproducible and a parameter change
shows up as a change in recovery rather than as noise.

Current output:

```
games simulated:                   269
ranking recovery (Spearman):       0.883
ranked players flattened to zero:  0
within one tier of declared:       > 90%
```

Two results from this harness are now settled decisions, and two are open:

- **Settled:** `DISPLAY_CONFIDENCE_Z` 3 -> 1.5, and the tier bands
  550/720/900/1120 -> 400/600/880/1120.
- **Open:** recovery plateaus at Spearman ~0.85–0.88 once the club leaves placement and
  does **not** improve with more games. That ceiling is the carrying problem the spec
  anticipated, not a bug — it is recorded as such.
- **Open:** `SIGMA_RECOVERY_DAYS` is unvalidated, because the harness simulates one
  month and cannot exercise a long absence.

This is a committed test, not a throwaway script. It is the regression guard for every
future rating-parameter change, and `CLAUDE.md` hard rule 5 forbids changing those
parameters without running it and reporting the before/after.

### The end-to-end smoke check

`scripts/smoke.ts`, one scripted path against a local stack. Its job is to prove the
**wiring**, not the rules: row-level security, the grants, the atomic writes, and
whether a Deno function can reach the domain core at all. Four members register, the
two newbies beat the two strongest, three confirm, and the derived tables are checked —
including the three things that are *configuration* rather than code and would
therefore break silently: a phone cannot write a rating, cannot invent a game, cannot
make itself an admin.

---

## 13. Configuration and secrets

### `.env` (repo root) — baked into the app bundle

```
EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_ANON_KEY
```

Expo inlines anything prefixed `EXPO_PUBLIC_` into the bundle, so **only ever put the
anon key here.** It is public by design; row-level security is what protects the data.
The service role key must never appear in this file.

### `supabase/.env` — substituted into `config.toml` by the CLI

```
RESEND_SMTP_PASSWORD                      a Resend API key; the user is literally "resend"
AUTH_SENDER_EMAIL                         on a domain verified with Resend
SUPABASE_AUTH_EXTERNAL_APPLE_CLIENT_ID    the iOS bundle id, com.pvqh.badmintonladder
SUPABASE_AUTH_EXTERNAL_APPLE_SECRET       the client-secret JWT (web OAuth flow only)
SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID   EVERY client that may present an ID token,
                                          iOS and web, comma-separated
SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET
```

Placeholders are fine locally: email confirmations are off, so only a password reset
sends mail at all.

Auth providers are configured **in `config.toml` rather than in the dashboard** so the
setting is reviewed in git and cannot be forgotten on a project rebuild.
`skip_nonce_check = true` for Google because the native Google sign-in library does not
return the nonce it signed. Apple has `email_optional = true` because Sign in with
Apple can withhold the address behind a relay and a member who hides it still gets a
profile.

### Local ports

| Port | What |
|---|---|
| 54321 | API gateway — REST, Auth, Functions |
| 54322 | Postgres |
| 54323 | Supabase Studio |
| 54324 | Mailpit, the local mail catcher |
| 54327 | analytics |
| 8083 | Deno inspector for debugging functions |

---

## 14. What is built, and what is not

**Built and working:** the entire schema with RLS; all four auth routes; `log_game`;
the full lifecycle through `confirm-game`; `replay-ratings`; `auto-accept`;
`notify-players`; the complete pure domain core with 172 tests; the simulation harness;
the end-to-end smoke check; the data layer; and — as of 2026-11-04 — the full route
tree and component set: the ladder with its men's/women's filter, the feed, the log
flow with its live preview, the pending banner, a player profile with the rating graph,
settings, and all four ways in.

`npm test` is green (172) and `npm run typecheck` is clean.

**Deliberately not built yet**, so that what exists is finished rather than broadly
sketched:

- **Admin tooling** (stories 65–72). Correcting a score, voiding a game, adjusting a
  seed tier, merging duplicates. All the pieces exist; the functions that drive them do
  not. Consequence today: an admin edit to `seed_tier` leaves ratings stale.
- **The weekly recap and the overtaken-on-ladder alert** (stories 62, 63). The
  preferences exist and default correctly; nothing sends them.
- **The widget**, and the payload the host app would write to the App Group.
- **Photo storage.** `games.photo_path` is a column; no bucket and no policy exist.
- **The hourly scheduler.** `auto-accept` works but nothing calls it. The SQL is in
  `docs/BACKEND.md` and must be run once against production.

**Out of scope, and not to be built opportunistically:** monetisation of any kind;
small and medium widgets; pairing and court-rotation suggestions (the likely v2);
sessions, organisers and groups; Android; separate singles/level/mixed ladders;
tournaments and challenges; public App Store distribution; chat, expense splitting,
attendance, court booking; photo as proof; guest profiles; incremental rating updates.

Each of those is in the spec's Out of Scope list for a reason that was argued through.
`CLAUDE.md` hard rule 4.

---

## 15. Known issues as of 2026-11-04

From a strict code-quality review of the tree at 13:05 on 2026-11-04. The repository
was being actively edited throughout the review; four findings were resolved by the
author while it was in progress and are listed as closed in 15.5 rather than deleted,
so the reasoning is still on record.

`manual.md` section 11 has the fix sequence for what remains.

### 15.1 Blockers

1. **`.gitignore` ends with `*.md`, so the contract is not in version control.**
   `CLAUDE.md`, `docs/SPEC.md`, `docs/BACKEND.md`, and this file are all ignored and
   untracked — **zero** markdown files are tracked. `CLAUDE.md` opens with "Read this
   file and `docs/SPEC.md` before writing any code. They are the contract," and the
   Decision Log is append-only project memory recording which numbers were measured and
   which designs were rejected. None of it is reconstructible from the code. One
   `git clean -xfd` and the design history is gone while every line of code survives.

2. **`.gitignore` has `.env.example ` with a trailing space.** Git strips trailing
   whitespace from ignore patterns, so the rule matches `.env.example` — the two example
   files it was written to *spare*. Both are untracked, so on a clean clone the first
   two lines of local setup (`cp .env.example .env`) fail with "no such file", and a
   newcomer has no record of which variables exist.

### 15.2 Correctness

5. **Two reads are silently unordered.**
   `.order(col, { referencedTable: 'games' })` emits `games.order=…`, which sorts rows
   *inside* a to-one embed — there is one row, so it is a no-op. The top-level order is
   undefined. `readMyPendingGames` claims "newest first" and `readRatingHistory` claims
   "oldest first, for the graph"; neither holds. **The rating graph will draw its points
   in arbitrary order.**

6. **Two concurrent replays collide and the second one loses.** `apply_replay` does
   `delete from rating_history where true` then a bare insert. `player_ratings` is
   protected by `on conflict do update`; `rating_history` is not. Under READ COMMITTED
   two overlapping transactions each delete the rows visible to their own snapshot and
   then insert the same `(game_id, profile_id)` keys — unique violation on the loser.
   `confirm-game` fires a replay per confirmation, so two people confirming two
   *different* games in the same second is an ordinary Saturday. A
   `pg_advisory_xact_lock` at the top of `apply_replay` fixes it.

7. **`auto-accept` reports `replayed: true` when it never replayed** (the trailing
   return hardcodes it, and the replay is behind `if (accepted.length > 0)`). That is
   the field an operator reads out of `cron.job_run_details`.

8. **`confirm-game` discards the replay error** — `replayed = replay.error === null`
   throws it away with no log line. For a system whose first hard rule is "ratings are
   derived", a silent replay failure is the one fault you most want a breadcrumb for.

### 15.3 Structure

9. **`auto-accept` spends three round-trips per pending game to re-learn "not yet".**
   Every pending game, however young, costs a read of `games`, a read of
   `game_confirmations` and a rejected reducer call. On a Saturday evening most pending
   games are hours from ripe. Filtering the query with
   `.lt('created_at', now - AUTO_ACCEPT_MS)` — importing the constant from the domain —
   keeps the decision in the reducer while stopping it from being asked forty times an
   hour to say no. The notify loop afterwards could be a `Promise.all`; those are
   independent.

10. **The purity guard has two holes.** `src/domain/purity.test.ts` is the single
    mechanism enforcing hard rule 2. `FORBIDDEN` matches `'expo'` and `'expo/'`, so
    `expo-router`, `expo-constants`, `expo-linking` and `expo-status-bar` would all
    pass. And the spec's promise that the domain takes "no dates from the system clock"
    is unchecked — the discipline is currently perfect, so a guard costs nothing and
    would keep it that way.

11. **`notify-players` has no error boundary.** `tokensFor` and `send` both `throw`, so
    an Expo push hiccup becomes an unhandled rejection and an opaque 500. `logGame` in
    `src/data/games.ts` awaits that invoke and never checks `error` — correct as
    best-effort, but worth one comment, because silently ignoring an awaited result
    reads as an oversight rather than a decision.

12. **Minor: `inflateSigmaForIdleTime` contradicts its own test name.**
    `if (sigma >= SIGMA_INITIAL) return SIGMA_INITIAL` *deflates* anyone above the
    initial, while the test is called "never deflates a player who is already more
    uncertain than a newcomer" and only pins the equality case. Unreachable today
    because OpenSkill never grows sigma, so it is a dead branch with a misleading
    label — `Math.max(sigma, SIGMA_INITIAL)` would match the name.

13. **Minor: two client clocks reach the database.** `registerDevice` and
    `updatePreferences` send `updated_at: new Date().toISOString()` — a phone's clock,
    in a project that went out of its way to keep `played_at` on the server's. A column
    default plus a `before update` trigger would keep that rule in one place.

### 15.4 Closed during the review

Resolved by the author between 12:40 and 13:05 on 2026-11-04, recorded so the
reasoning survives:

- **`probe.ts` broke `npm run typecheck`** — a root-level scratch file of
  deliberately-wrong assertions used to coax inferred types out of `tsc`. Deleted;
  typecheck is now clean.
- **Six dependencies had no Decision Log line.** Now recorded, with reasons, including
  the `react-dom` 19.3.0 `overrides` pin that `expo-router` made necessary.
- **`expo-router` was configured but unreachable** — plugin present, no `app/`
  directory, `main` still `index.ts`. The whole route tree now exists and `main` is
  `expo-router/entry`.
- **`database.types.ts` was hand-edited.** Still true, but it is now a *recorded*
  temporary patch: the Decision Log notes the file was stale, that it lacked
  `game_confirmations.game_id -> games` which the migration declares and the feed
  embeds through, and that the hand edit disappears on the next `npm run types:db` once
  Docker is available. That makes it a known debt rather than a hidden one — the
  remaining risk is only that the regeneration is forgotten.

### 15.5 What is notably good

Worth recording so it is not accidentally refactored away:

- The derived-state architecture is held **honestly**. There is no code path that
  writes a rating outside a replay, and that is enforced by grants rather than by
  discipline.
- `replay-ratings` and `auto-accept` running as their *caller* so the database is the
  authorization, instead of re-checking permissions in TypeScript, is the right shape —
  and it is why one smoke assertion can prove it.
- `persist_game_state`'s compare-and-set, with the domain reducer deciding and SQL only
  recording, is exactly the division the project claims to make.
- No `any`, no non-null `!`, no file over 300 lines.
- `rating-preview.test.ts` pinning the untrusted client preview to the authoritative
  replay's own output makes hard rule 3 cheap to keep rather than a thing to remember.
- The auth gate uses `Stack.Protected` guards rather than a redirect in an effect, so
  there is no frame in which the wrong screen is mounted. That is the harder and
  correct choice.
- The ladder screen measures activity from `last_played_at` against the live clock
  rather than trusting the `is_active` flag frozen by the last replay — it took the
  schema comment's advice instead of the convenient column.
- Comments say *why*. I did not find one that restates its code.
