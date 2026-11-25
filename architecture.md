# Architecture — Badminton Club Ladder

A map of the whole system: what each piece is, why it is shaped that way, and how the
pieces reach each other. Written against the repository as of **2026-11-24**.

Companion documents:

- `CLAUDE.md` — the hard rules and the append-only Decision Log. Takes precedence.
- `docs/SPEC.md` — the agreed specification and its user stories.
- `docs/APP.md` and `docs/BACKEND.md` — the operational view of the client and the
  backend.
- `manual.md` — how to actually run all of this, step by step.

---

## 1. What the system is

A free web app for one badminton club of about thirty people who play doubles twice
every weekend, roughly 300 rated games a month. Each player adds it to their phone's
home screen, where it opens full-screen like an app. It is hosted on GitHub Pages.

The loop is four steps:

1. A player finishes a doubles game and **logs** it: four names, two per side, a score.
2. The other three get a push notification and **confirm** it.
3. Once all four have agreed, an **OpenSkill rating moves** for all four.
4. The home-screen icon opens straight onto the **ladder**.

Because every game carries all four names publicly and needs their agreement, the
record polices itself. There is no referee role; an admin steps in only for disputes,
mistakes and lost passwords.

Until 2026-11-24 this was an iOS app with a home-screen widget, distributed through
TestFlight. The widget needed a $99/year Apple membership, and the author chose a free
web app instead; the Decision Log records the move.

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
| App | Expo + React Native, TypeScript, rendered to the web by `react-native-web` | The screens were already React Native; Expo exports them as a static site with no rewrite. |
| Hosting | GitHub Pages, built by GitHub Actions | Free, and a static site is all the client is. Pages runs no code, so everything server-side stays in Supabase. |
| Rating model | `openskill.js`, Plackett-Luce | Elo is a 1v1 model bent into doubles by averaging and carries no notion of uncertainty, which matters enormously when newbies and strong players share one pool. TrueSkill is the same model family but patented for commercial use. |
| Backend | Supabase free tier | Postgres + Auth + Edge Functions in one free box. Row-level security is the whole trust model. |
| Server runtime | Supabase Edge Functions (Deno 2) | Can import the TypeScript domain core *directly*, so the rating engine that runs in production is literally the one the tests exercise. |
| Sign-in | Username and password only | The author's call, for simplicity. No email is ever sent, so there is no mail provider; an admin resets a forgotten password. |
| Notifications | Web Push, signed and encrypted by `web-push` | The standard that iPhone supports for home-screen web apps since iOS 16.4. The crypto is exactly the code not to hand-roll. |
| Client cache | `@tanstack/react-query` | Server state with invalidation, instead of hand-rolled loading flags in every screen. |
| Session storage | `@react-native-async-storage/async-storage` | localStorage on the web, so a member stays signed in between weekends. |

There is **no running cost.** GitHub Pages and Supabase's free tier cover a club of
thirty.

---

## 4. Repository map

```
CLAUDE.md                  hard rules + append-only Decision Log  (the contract)
docs/SPEC.md               the agreed spec and its user stories
docs/APP.md                the client, operationally
docs/BACKEND.md            the backend, operationally
architecture.md            this file
manual.md                  how to run it

app.json                   Expo config: web only, baseUrl /BadmiGo, light only
tsconfig.json              strict, noUnusedLocals, allowImportingTsExtensions
vitest.config.ts           scopes test collection to src/** (see 4.1)
.env.example               the three EXPO_PUBLIC_* values the build inlines
.github/workflows/pages.yml  typecheck, test, export, publish to GitHub Pages

public/                    COPIED INTO THE SITE AS-IS
  index.html               the HTML template: manifest, touch icon, iPhone meta tags
  manifest.json            standalone display, start URL on the ladder
  sw.js                    the service worker: shows a push, opens its screen
  icon-192.png, icon-512.png, apple-touch-icon.png

app/                       THE ROUTES — expo-router, file-based
  _layout.tsx              providers + the auth gate (Stack.Protected)
  (tabs)/_layout.tsx       the five tabs
  (tabs)/index.tsx         the ladder
  (tabs)/feed.tsx          every confirmed game, club-wide, searchable by player and day
  (tabs)/log.tsx           log a game, with the live rating preview
  (tabs)/me.tsx            my profile
  (tabs)/settings.tsx      avatar, light/dark, name, notifications, password, admin
  game/[id].tsx            one game in full; confirm/dispute; admin fixes
  player/[id].tsx          anyone's profile
  admin/index.tsx          admin only: flagged games and the member list
  admin/[id].tsx           admin only: seed tier, admin rights, password, merge
  sign-in.tsx              username and password, and the install hint
  sign-up.tsx              create an account
  create-profile.tsx       the account-to-member step, avatar, and the way back

src/domain/                THE PURE CORE — no I/O, no clock, no randomness
  types.ts                 ProfileId, GameFormat, GAME_FORMATS, Side, Tier
  rating-scale.ts          every tunable rating parameter, in one file
  rating.ts                replayRatings() — the one way a rating is produced
  rating-preview.ts        the untrusted pre-submit preview
  game-lifecycle.ts        (state, event) -> state reducer
  validation.ts            badminton score validity, side shape
  stats.ts                 win/loss, partners, head-to-head, PvE
  flags.ts                 which games an admin should look at
  recap.ts                 what a player's week came to
  overtaken.ts             who a replay moved past whom
  *.test.ts                behaviour through the interface
  purity.test.ts           enforces "the domain imports nothing, reads no clock"

src/data/                  THE ONLY MODULE THAT TALKS TO SUPABASE
  client.ts                the single Supabase client, unwrap(), invoke()
  function-contract.ts     what the app and Edge Functions share; domain types only
  database.types.ts        GENERATED by `npm run types:db` — never hand-edit
  auth.ts                  sign in/up/out, username rules, create_my_profile
  avatar.ts                upload, change and show a member's picture
  games.ts                 log_game, confirm-game, the feed queries and feed search
  ladder.ts                player_ratings, rating_history, player search
  notifications.ts         push subscribe/unsubscribe, notification preferences
  admin.ts                 the admin function, members, appointing admins

src/ui/                    FORMATTING, STATE AND COMPONENTS — no rules
  theme.ts                 light and dark palettes, tier colours, spacing, type
  vocabulary.ts            the club's own words, spelled for the screen
  queries.ts               every react-query key and hook, in one place
  session.tsx              who is using the app, as five explicit states
  game-row.ts              unpacking a feed row the way screens need it
  player-stats.ts          assembling one player's stats from the domain
  player-profile.tsx       the profile body, shared by /me and /player/[id]
  standing.ts              your rank and the gap to the player above
  components/              async states, avatar and its picker, badges, buttons,
                           fields, game card, screen title,
                           pending banner, player picker (with invite), podium,
                           rating graph, standing card,
                           install hint, admin game panel

src/simulation/            A TEST OF THE PREMISE, NOT THE CODE
  club.ts                  30 synthetic players with known true skill
  recovery.test.ts         does the engine recover a ranking it was never told?

scripts/smoke.ts           the ONE end-to-end check against a local stack
scripts/smoke-client.ts    its plumbing: local keys, one HTTP helper, registering

supabase/
  config.toml              auth settings, per-function settings
  migrations/              the schema, applied in filename order
  functions/
    deno.json              the functions' imports: supabase-js, openskill, web-push
    .env.example           the VAPID keys the functions read
    _shared/supabase.ts    client factories, required(), json()
    _shared/game-state.ts  read -> reduce -> compare-and-set, with retry
    _shared/push.ts        the one Web Push sender, preferences respected
    _shared/replay-input.ts  narrowing replay_input()'s json
    confirm-game/          a participant's answer
    admin/                 corrections, void, resolve, seed tier, merge, password
    replay-ratings/        rebuild every rating; "passed you" pushes
    auto-accept/           hourly sweep of the 24-hour window
    weekly-recap/          Sunday evening, each player's week
    notify-players/        the push for one game, behind one `kind`
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

### 5.7 `flags.ts`, `recap.ts`, `overtaken.ts` — what the notifications and admin read

Three small pure functions added on 2026-11-24, each answering one question for a
server function or a screen, so that the answer is tested here rather than buried in
I/O code:

- **`flagFor(game)`** — why an admin should look at a game (story 70): `disputed`, or
  `nobody-answered` when the 24-hour clock accepted it and no one but the logger ever
  answered inside the window. It reads `AUTO_ACCEPT_MS` from the lifecycle rather than
  restating it. Scores are not second-guessed. A game carries at most one flag, or
  null.
- **`recapFor(...)`** — a player's games, wins, and rating from first to last over
  whichever games the caller chose as the week (story 62), read from the replay's own
  per-game changes, never recomputed. Null for a player with none, so nobody is sent a
  recap of nothing.
- **`overtaken(before, after)`** — who a replay moved past whom (story 63). It decides
  who is ranked itself (active and out of placement), so the Edge Function only passes
  rows in. Only players ranked on both sides count: someone finishing placement above
  you has arrived, not passed you. Ties break by profile id, the replay's own order.

`types.ts` also holds the club's fixed lists, `GAME_FORMATS` and `TIERS`, with
`asGameFormat` and `asTier` to narrow a value from the database or a request body.
Everything that needs either list imports it from here, the Edge Functions included.

---

## 6. The database

The migrations, applied in filename order. The ones dated 2026-11-24 changed some of
what is described below, and are named where they did.

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
  format         smallint, in (11,15,21,31)       (31 added by ...format_31.sql)
  score_a/_b     smallint, 0..40, must differ
  winning_side   GENERATED ALWAYS AS (score_a > score_b ? 'a' : 'b') STORED
  played_at      timestamptz default now()   <- the replay's ordering
  created_at     timestamptz default now()   <- the auto-accept clock
  status         game_status default 'pending'
  void_reason    text   -- present exactly when status = 'voided'

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
  answers in one query.

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
  than a stale one. It takes an advisory lock first (`...130100_replay_lock.sql`), so
  two replays started in the same second queue instead of colliding on
  `rating_history`'s keys. It returns the ladder it replaced, read under that lock, so
  the "you were passed" comparison never sees the same old ladder twice.

### 6.5 Notifications (`...120400_notifications.sql`, `...130200_web_push.sql`)

`push_subscriptions` (endpoint pk, p256dh, auth, profile_id, updated_at) and
`notification_preferences` (confirmation_requests, dispute_alerts, weekly_recap,
overtaken_on_ladder). Neither is in the spec's original data model — they were added
because stories 22, 25 and 61–64 need somewhere to live, and that is recorded in the
Decision Log. A Web Push subscription is an endpoint plus the two keys a message is
encrypted to; it replaced the native app's single `push_tokens` token on 2026-11-24.

`overtaken_on_ladder` defaults to **false**, per story 63: a player who finds
competition stressful should never be needled by an app they did not ask to be needled
by.

A subscription is private to its owner — the club may read the ladder, not each
other's push addresses. The update policy uses `using (true)` so that claiming an
endpoint already on file is how a shared phone switches owner; it can still only ever
point at the caller, and endpoints are unreadable, so there is nothing to redirect
blindly.

`current_role_name()` lives here: it returns `anon`, `authenticated` or `service_role`,
and `notify-players`, `auto-accept` and `weekly-recap` use it to tell their callers
apart.

### 6.5a Photos (`...130400_game_photos.sql`, removed by `...20261125120000_drop_game_photos.sql`)

Member avatars (`...20261125130000_usernames_and_avatars.sql`) are the one stored image:
a public `avatars` bucket, one small JPEG per member in a folder named by their id.

Games carried an optional photo until 2026-11-25. The later migration drops the
column, its trigger and the storage policies, and recreates `log_game` without the
photo argument. Neither photo nor video is stored now: storage is the one thing that
could cost money.

### 6.6 The RPCs (`...120500_rpc.sql`, `...120600_game_state.sql`)

These hold **no rules the domain owns.** What they hold is the atomicity supabase-js
cannot express, because a client cannot open a transaction and a game is nine rows.

**`create_my_profile(display_name, gender, seed_tier)`** — completes signup. It reads
the username out of the account's synthetic auth email and refuses any other account
(section 8; `...130000_username_only.sql`).

**`username_available(text)`** — `username_problem` is null *and* nobody holds it.

**`log_game(format, side_a[], side_b[], score_a, score_b)`** — one call,
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
answer timestamp. (That is also what lets `src/domain/flags` tell an answer a player
gave from one the 24-hour clock filled in.)

**`merge_profiles(keep, merge)`** (`...130300_merge_profiles.sql`) — story 69, service
role only. Refuses if both accounts played in the same game; otherwise moves the
duplicate's participant rows, answers and logged games to the kept account, then
deletes the duplicate's auth account, whose cascade takes the profile with it, all in
one transaction, so a failure can never leave a login without a profile. The deferred
shape triggers judge the result at commit.

### 6.7 The trust model, in one table

What a browser may write: **its own profile fields (the display name) and its own push
subscriptions.** An admin may also set `is_admin` on another profile. That
is all. Everything else is an RPC or a function.

| Route | Who may call it | What it does |
|---|---|---|
| `username_problem` / `username_available` | anyone | instant signup feedback |
| `create_my_profile` | a signed-in username account | turns an account into a club member |
| `log_game` | a club member | a game, 4 participants, 4 confirmations, atomically |
| `confirm-game` | a participant | confirm / dispute / cancel, then replay |
| `admin` | an admin (checked by the function) | correct, void, resolve, seed tier, merge, password |
| `replay-ratings` | service role only | rebuild every rating from history |
| `auto-accept` | service role only, hourly | sweep games past 24 hours |
| `weekly-recap` | service role only, weekly | each player's week, as a push |
| `notify-players` | service role, or a participant of that game | the push for one game |
| `persist_game_state` | service role only | record a lifecycle decision |
| `merge_profiles` | service role only | move a duplicate's games to the kept account |
| `replay_input` / `apply_replay` | service role only | read / write the derived tables |

`games`, `game_participants`, `game_confirmations` and all three derived tables are
`select`-only for `authenticated` and revoked entirely from `anon`.

Story 74 — *"ratings cannot be computed or altered from a browser"* — is therefore a
property of the **grants**, not of the client code. `scripts/smoke.ts` asserts it
directly: a member cannot write a rating, cannot insert a game outside `log_game`,
cannot make themselves an admin, and is refused by the `admin` function.

---

## 7. The server: six Edge Functions

All six run on Deno and **import the domain core directly** from `../../../src/domain/`.
That is why relative imports inside `src/domain` carry explicit `.ts` extensions: it is
the only way a Deno Edge Function can resolve them, and the edge runtime does not
honour Deno's `sloppy-imports`. It means the engine that rates your Saturday game is
the exact file the tests exercise — not a port of it.

`_shared/supabase.ts` offers two client factories, and which one a function uses *is*
its authorization model:

- **`serviceClient()`** — full privilege. Used by `confirm-game`, `admin` and
  `notify-players`, which must act on behalf of a member who is not allowed to do the
  thing themselves, and so check the caller first.
- **`callerClient(authorization)`** — anon key plus the caller's own bearer token, so
  **the database decides** what the caller may do. Used by `replay-ratings`,
  `auto-accept` and `weekly-recap`. Because the privileged work is granted to
  `service_role` alone, these functions do not re-implement the permission check and
  *cannot forget to*. A club member with a perfectly valid token gets a 403.

`_shared/game-state.ts` is the read-reduce-write loop, used by three functions:

```
read game + confirmations  ->  applyEvent(state, event)  ->  persist_game_state(...)
       ^                                                              |
       |______________ 40001 serialization_failure ___________________|
                        (up to 3 attempts, then 'contended')
```

Three attempts is enough for two participants answering at the same instant; a third
collision is a real queue and is reported as such.

`_shared/push.ts` is the one Web Push sender. It keeps only the recipients whose switch
for that kind is on, sends to every phone they subscribed, and deletes a subscription
the push service reports as gone (404, 410). One bad phone never stops the rest.

### `confirm-game` — a participant's answer

1. Resolve the caller's profile from the bearer token; 401 if absent.
2. Parse `{ gameId, answer }` where answer is `confirm` | `dispute` | `cancel`.
   `void` and `resolve` are the admin's and deliberately do not exist on this route.
3. `applyGameEvent`. A rejection becomes **409 with a Vietnamese sentence** looked up
   from the reducer's reason in `REFUSAL_MESSAGE` (`_shared/game-state.ts`), a missing
   game 404, contention 503. Every non-2xx reply from every function is `{ error }`.
4. If the game is now `confirmed`, **invoke `replay-ratings`**. Replaying here rather
   than on a schedule is what makes a confirming player see the ladder change. A
   failure past this point leaves the record right and the ladder stale — which
   `rating_replay_state` shows — so it is logged and *reported* as `replayed: false`
   rather than turned into a failed confirmation the client would retry.
5. If the game is now `disputed`, invoke `notify-players` with `dispute`.
6. Return `{ status, replayed }`.

### `admin` — what only an admin may do

Checks the caller's `is_admin` with the service role, parses one of six actions, does
it, and — for every action except a password reset — **invokes `replay-ratings`**
(story 67). A refusal is a 409 carrying a sentence for the admin.

| action | what it does |
|---|---|
| `correct-score` | validated by `src/domain/validation` against the game's own format; a voided game is not corrected |
| `void`, `resolve` | the lifecycle reducer's own events, through `applyGameEvent` |
| `set-seed-tier` | the start of a rating, so every rating since moves |
| `merge` | `merge_profiles`, which also deletes the duplicate's auth account |
| `reset-password` | a temporary password through the auth admin API; never returned or logged |

Appointing an admin is not here: RLS already lets an admin set `is_admin`, and it
moves no rating.

### `replay-ratings` — rebuild everything

`replay_input()` -> `replayRatings(...)` -> `apply_replay(...)`, which hands back the
ladder it replaced. Always from zero. Afterwards it compares the ladder before and
after with `src/domain/overtaken` and sends the opt-in "you were passed" push. A failed
push is logged and never fails the replay.

The json crossing from Postgres is **narrowed, not asserted** (`_shared/replay-input.ts`)
— anything malformed is rejected. *"A replay that quietly rated a malformed game is the
one fault in this system that replaying history cannot undo, because history is what
would be wrong."*

One cast exists, `asJson`, and it is documented: the engine returns readonly
interfaces that serialize exactly as the SQL expects, but an interface has no index
signature so TypeScript will not call one `Json`.

### `auto-accept` — the hourly sweep

Checks `current_role_name() = 'service_role'` **up front**, because the first
privileged call is deep inside the loop; without the early check a member would get a
500 on the one run that had a ripe game and a 200 on every other.

Then: every pending game is offered an `elapse` event and **the reducer decides which
are ripe** — the twenty-four hours stay in the domain. One replay for the whole sweep.
`replayed` in its answer is true only when a replay actually ran, because that is the
field read out of `cron.job_run_details`.

### `weekly-recap` — Sunday evening

Service role only, checked up front like `auto-accept`. Takes the last seven days of
confirmed games from `replay_input()`, their rows from `rating_history`, and asks
`src/domain/recap` what each player's week came to: games, wins, rating from first to
last. A player who did not play is sent nothing.

### `notify-players` — the push for one game

| kind | audience | switch |
|---|---|---|
| `confirmation-request` | the three who are not the logger | `confirmation_requests` |
| `dispute` | all four | `dispute_alerts` |

Each message carries the path of the game, and the service worker opens it on a tap.
Two kinds of caller: the functions that settle a game hold the service role, and a
member whose browser just logged a game asks for the confirmation request itself — and
is allowed to, but only for a game they played in.

Neither `auto-accept`, `admin` nor `weekly-recap` has a scheduler of its own where it
needs one: `docs/BACKEND.md` holds the `cron.schedule` + `vault.create_secret` SQL to
run once against production.

---

## 8. Identity and auth

**Username and password, and nothing else** (since 2026-11-24). Email, Google and Apple
sign-in were dropped for simplicity, and with them any email the app sends.

No database trigger creates profiles. Signing up makes the account; the create-profile
screen then calls `create_my_profile`, so an account whose profile step failed can
finish later rather than being stuck half-made.

### The synthetic email scheme

Supabase authenticates by email, and a member has none. So each account's auth email
is **derived** from the handle:

```
Hung.Nguyen  ->  hung.nguyen@users.badminton-ladder.invalid
```

The profile keeps the capitals (since 2026-11-25); the address, and so sign-in, is
always lower case. The typed spelling travels in the account's user metadata and is
only used when it lower-cases to the address's handle.

The `.invalid` TLD is reserved by RFC 2606 and can never receive mail.

Three consequences follow:

- **Supabase Auth's own unique index on email is what actually reserves a username.**
  `create_my_profile` reads the handle back out of the address rather than taking it as
  an argument, so the two can never disagree.
- **`create_my_profile` refuses any account not on that domain.** Supabase Auth will
  create an account for a real address if called directly; it can never become a
  member.
- **The mapping is written twice**, in `public.username_email_domain()` and in
  `src/data/auth.ts`. **Change them together or sign-in breaks.** This is the single
  most dangerous coupling in the repository.

Email confirmations are **off**: synthetic addresses cannot receive mail, and signup has
to fit between games (story 8 — under thirty seconds).

### A forgotten password

An admin sets a temporary one (story 5): *club admin → the member → Temporary
password*, through the `admin` function's `reset-password` action and the auth admin
API. The admin tells the member in person; the member changes it in Settings. The
function never returns or logs the password.

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
- The session lives in `AsyncStorage` — localStorage on the web — so a member stays
  signed in. `detectSessionInUrl` is off: no sign-in ever arrives by link.

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
the ladder and feed refresh on pull and on cache invalidation after an answer.
Sockets would be a second staleness model to reason about.

### 9.2 `src/ui` — formatting, state and components, no rules

- **`theme.ts`** — a light palette and a dark one with the same keys; each phone picks
  in Settings (light by default) and the choice sits in `localStorage`. The palette is
  chosen once when the app loads and a change reloads the page, so screens keep plain
  `StyleSheet.create` at import instead of a theme hook. `court` is the green as a
  surface, `courtInk` the green as text. Type is Be Vietnam Pro and a condensed
  Bricolage, self-hosted in `public/fonts`. Figures use `tabular-nums`, because scores and ratings only line
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
  `needs-profile` is the real gap between an account and a membership — signing up
  creates the first and the profile step the second — and modelling it explicitly is why
  there is no "is this an error or a new user?" conditional anywhere else.
- **`game-row.ts`** — unpacking a feed row: lineup, winner, what it moved for one
  player, how many still owe an answer, how long until auto-accept. It imports
  `AUTO_ACCEPT_MS` from the domain rather than restating 24 hours.
- **`player-stats.ts`** — assembles one player's profile numbers by calling
  `domain/stats` over the games that player appeared in. `startOfMonth` lives here
  because "games this month" (story 54) is a presentation window, not a rule.
- **`components/`** — small pieces. The one worth naming is `async.tsx`:
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
                  member        -> (tabs), game/[id], player/[id]
                                   and, guarded again by is_admin: admin/index, admin/[id]
                  needs-profile -> create-profile
                  signed-out    -> sign-in, sign-up
```

It uses `Stack.Protected` **guards rather than a redirect in an effect**, so there is
no frame in which a signed-out browser has a club member's screen mounted. Every group
redirects to `home`, which is whichever route the *current* status belongs to — so one
expression is the right answer for all three groups.

The five tabs are Ladder, Feed, Log, Me and Settings. The ladder screen is the clearest example
of the project's division of labour: it splits the list into **ranked**, *"Finding
their level"* (in placement) and *"Away for 21+ days"*, measuring activity from
`last_played_at` against the current clock rather than trusting the `is_active` flag
the last replay froze — exactly as the column comment in the schema advises. It shows
`rating_replay_state` as *"Updated 3 min ago"*, so a stale ladder says so.

The log screen is where the domain core surfaces directly in the UI: it calls
`validateProposedGame` on every keystroke (suppressing the score complaint while a box
is still empty — "an empty score box is not yet a wrong one") and `previewGame` to show
what each of the four stands to win or lose, captioned *"An estimate. The ladder itself
is worked out on the server, once all four have agreed."* The logger permanently holds
the first slot, because `log_game` only accepts a game they played in. The lineup
survives submission so an afternoon with the same four is one score each time
(story 18).

---

## 10. Home screen, notifications, hosting

### Home screen

`public/manifest.json` (`display: standalone`, start URL `./`, which is the ladder) and
the Apple touch icon make the site install like an app. `public/index.html` is the
template Expo fills in; its links carry `/BadmiGo/` because a deep link such as
`/BadmiGo/game/<id>` would resolve a relative path under `/game/`.

Safari has no install button, so `InstallHint` shows the steps on the sign-in screen
and in Settings, but only on an iPhone that has the app open in a Safari tab
(`needsHomeScreenInstall()` in `src/data/notifications.ts`).

### Notifications

```
Settings switch (a tap)  ->  Notification.requestPermission()
                         ->  register /BadmiGo/sw.js
                         ->  pushManager.subscribe(VAPID public key)
                         ->  rpc claim_push_subscription (endpoint, p256dh, auth)

server: _shared/push.ts  ->  web-push signs (VAPID) + encrypts (aes128gcm)
                         ->  Apple / Google / Mozilla push service  ->  phone
sw.js 'push'             ->  showNotification(title, body)
sw.js 'notificationclick' -> open or focus the app at the message's path
```

On an iPhone this only works for a home-screen web app, on iOS 16.4 or later, and the
permission prompt must come from a tap — which is why it lives behind a switch rather
than appearing on launch. iPhone shows every web push, so there is no silent push; the
widget's silent wake went with the widget. Signing out unsubscribes the phone first.

### Hosting

`.github/workflows/pages.yml` runs on every push to `main`: `npm ci`, typecheck, the
tests, `npm run export:web`, publish `dist/`. The three `EXPO_PUBLIC_*` values come
from repository *variables*, not secrets, because they are public in the bundle anyway.

GitHub Pages has no rewrite rules, so `export:web` copies `index.html` to `404.html`:
any unknown path is served the app, and the router resolves it.

---

## 11. End-to-end walkthroughs

### Logging and confirming a game

```
BROWSER                   POSTGRES                    EDGE               PUSH SERVICE
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
  |                                                          |--- web push x3 -->|
  |
  :  ... the other three tap the notification, then confirm ...
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
  |                         |                                |  overtaken(before, after)
  |                         |                                |--- "passed you" (opt-in) -->|
  |<-- {status, replayed} --|
  | replayed === true -> drop the entire react-query cache
```

### Nobody answers

`pg_cron` fires hourly (`7 * * * *`) with the service role key from Vault ->
`auto-accept` -> every pending game is offered `elapse` -> the reducer accepts only
those past exactly 24 hours from `created_at` -> one replay for the whole sweep. The
admin's review list then flags any such game where nobody but the logger ever answered
(`src/domain/flags`).

### Signing up

```
signUp("hung", password)  ->  auth account hung@users.badminton-ladder.invalid
                          |
                          v
       create_my_profile(display_name, gender, seed_tier)
                          |
                          +-> profiles row            (membership begins here)
                          +-> notification_preferences row
```

### An admin corrects a score

```
game screen (admin panel)  ->  validateScore() in the browser, for instant feedback
                           ->  invoke admin {action: correct-score}
admin function             ->  is_admin? -> validateScore() again, against the stored format
                           ->  update games set score_a, score_b
                           ->  invoke replay-ratings   (story 67: automatic)
browser                    ->  drop the entire react-query cache
```

Voiding, resolving a dispute, changing a seed tier and merging accounts take the same
path. None of them writes a rating; each changes what the replay reads.

---

## 12. Testing

### The seam

**One seam: the pure domain core.** 214 tests across 13 files, all of them asserting
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
player who performs exactly as predicted, and unmovable by their own rating; the admin
flags, including an answer one millisecond inside the 24-hour window; the weekly recap
over a window; and who passed whom, ties included.

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
including the things that are *configuration* rather than code and would therefore
break silently: a browser cannot write a rating, cannot invent a game, cannot make
itself an admin. Then an admin corrects the score and the replay follows by itself, a
temporary password works, a merged duplicate can no longer sign in, and an account
made with a real email cannot join.

---

## 13. Configuration and secrets

### `.env` (repo root) — baked into the app's JavaScript

```
EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_ANON_KEY
EXPO_PUBLIC_VAPID_PUBLIC_KEY
```

Expo inlines anything prefixed `EXPO_PUBLIC_` into the bundle, so **only public values
go here.** The anon key is public by design; row-level security is what protects the
data. The service role key and the VAPID private key must never appear in this file.
For the live site the same three are GitHub repository variables (manual Part 11).

### `supabase/functions/.env` — read by the Edge Functions

```
VAPID_SUBJECT       mailto: an address push services can contact
VAPID_PUBLIC_KEY    the same public key as above
VAPID_PRIVATE_KEY   never anywhere else
```

Locally the runtime reads this file. In production the same values are set with
`npx supabase secrets set`. **Changing the pair** turns notifications off on every
phone until each member switches them on again.

### `supabase/config.toml`

Committed, and read by `supabase start` and `supabase config push`. It reads no
environment variables any more. Worth knowing: `site_url` is the GitHub Pages address,
with `http://localhost:8081` allowed as well; email confirmations are off; no external
OAuth provider is enabled; and every function is `verify_jwt = true`.

### Local ports

| Port | What |
|---|---|
| 8081 | `npm run web`, the development server |
| 54321 | API gateway — REST, Auth, Storage, Functions |
| 54322 | Postgres |
| 54323 | Supabase Studio |
| 54324 | Mailpit (still started by the CLI; nothing sends mail) |
| 54327 | analytics |
| 8083 | Deno inspector for debugging functions |

---

## 14. What is built, and what is not

**Built and working:** every story in the spec. The schema with RLS and storage;
username sign-in; `log_game`; the full lifecycle through `confirm-game`; the `admin`
function and its screens; `replay-ratings` with the overtaken alert; `auto-accept`;
`weekly-recap`; `notify-players` over Web Push; the complete pure domain core; the
simulation harness; the end-to-end smoke check; and the screens: the ladder with its
podium and men's/women's filter, the feed, the log flow with its live preview, the pending banner, profiles with the rating graph, settings, admin,
home-screen install, and the GitHub Pages build.

`npm test` is green (214), `npm run typecheck` is clean, and `npm run smoke` passes
38 checks.

**Verified only as far as a PC can:** Web Push. The server signs and encrypts a
message (checked against a local endpoint); real delivery to an iPhone needs the live
HTTPS site and a phone.

**Needs doing once, outside the repository:** the hosted project, the first admin, the
two cron schedules, and the GitHub Pages settings and variables. `manual.md` Parts
11–12 and `docs/BACKEND.md` "Going live".

**Out of scope, and not to be built opportunistically:** monetisation of any kind;
home-screen widgets; offline use; pairing and court-rotation suggestions (the likely
v2); sessions, organisers and groups; Android-specific work; separate
singles/level/mixed ladders; tournaments and challenges; any app store, TestFlight or
native build; chat, expense splitting, attendance, court booking; photos and video of games;
guest profiles; incremental rating updates.

Each of those is in the spec's Out of Scope list for a reason that was argued through.
`CLAUDE.md` hard rule 4.

---

## 15. Known issues as of 2026-11-24

### 15.1 Closed

From the 2026-11-04 review, fixed on 2026-11-24:

- `.gitignore` ignored every markdown file, and `.env.example`. Both fixed; the contract
  and the example env files are tracked.
- `readMyPendingGames` and `readRatingHistory` claimed an order PostgREST was not giving
  them. The first now queries `games` at the top level through an aliased embed; the
  second sorts in the replay's own order after reading.
- Two concurrent replays could collide on `rating_history`. `apply_replay` now takes an
  advisory lock first.
- `auto-accept` claimed `replayed: true` on every run, and `confirm-game` dropped replay
  errors. Both now report and log what actually happened.
- The purity guard missed `expo-*` packages and the system clock. Both are checked.
- `database.types.ts` held a hand patch. It is regenerated from the migrations again.

### 15.2 Open

1. **Two replays can finish in the wrong order.** The lock stops them colliding, but a
   replay that read its input before a second game was confirmed, and finishes after
   the replay that included it, leaves the ladder one game behind until the next
   replay. Rare at this volume, and it heals itself.
2. **`auto-accept` spends three round-trips per pending game to re-learn "not yet".**
   Filtering the query with `.lt('created_at', now - AUTO_ACCEPT_MS)` — importing the
   constant from the domain — would keep the decision in the reducer while stopping it
   from being asked forty times an hour to say no.
3. **`logGame` ignores the result of asking for the confirmation push.** Correct as
   best-effort — the game is logged either way and the banner is the fallback — but a
   comment there would make it read as a decision.
4. **Minor: `inflateSigmaForIdleTime` contradicts its own test name.**
   `if (sigma >= SIGMA_INITIAL) return SIGMA_INITIAL` *deflates* anyone above the
   initial. Unreachable today because OpenSkill never grows sigma.
5. **Minor: a client clock reaches the database.** `updatePreferences` sends
   `updated_at` from the browser's clock (`turnOnPush` no longer does; its RPC uses
   `now()`). A column default plus a `before update` trigger would keep that rule on
   the server.
6. **Minor: a newly appointed admin** sees the admin screens only after reopening the
   app, because the session reads a member's profile once.

### 15.3 What is notably good

Worth recording so it is not accidentally refactored away:

- The derived-state architecture is held **honestly**. There is no code path that
  writes a rating outside a replay, and that is enforced by grants rather than by
  discipline — admin corrections included.
- `replay-ratings`, `auto-accept` and `weekly-recap` running as their *caller* so the
  database is the authorization, instead of re-checking permissions in TypeScript, is
  the right shape — and it is why one smoke assertion can prove it.
- `persist_game_state`'s compare-and-set, with the domain reducer deciding and SQL only
  recording, is exactly the division the project claims to make.
- No `any`, no non-null `!`, no file over 300 lines.
- `rating-preview.test.ts` pinning the untrusted client preview to the authoritative
  replay's own output makes hard rule 3 cheap to keep rather than a thing to remember.
- The auth gate uses `Stack.Protected` guards rather than a redirect in an effect, so
  there is no frame in which the wrong screen is mounted.
- The ladder screen measures activity from `last_played_at` against the live clock
  rather than trusting the `is_active` flag frozen by the last replay.
- Comments say *why*.
