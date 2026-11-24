# Badminton Club Ladder — project instructions

Read this file and `docs/SPEC.md` before writing any code. They are the contract.
If something you are about to build is not in the spec, stop and ask.

## What this is

A free web app for one badminton community (~30 players, two 2-hour sessions every
Saturday and Sunday, ~300 rated doubles games per month), saved to each player's
home screen. Players log their doubles games, the other participants confirm, and an
OpenSkill rating moves the ladder.

Not a commercial product. There is no monetisation in scope and no payer to design
for. Do not propose pricing, growth features, or onboarding funnels.

## Hard rules

These are not style preferences. Breaking one is a bug.

1. **Games are the source of truth. Ratings are derived.**
   Never write a rating as an authoritative value. Every rating in the database is
   the output of replaying the full confirmed-game history through the engine. Any
   code path that mutates a rating without a replay is wrong, no matter how small.

2. **The domain core is pure.**
   `src/domain/**` imports nothing from React, React Native, Expo, Supabase, or any
   I/O library. It is plain TypeScript functions over plain data. This is the single
   test seam (see `docs/SPEC.md` → Testing Decisions). Keep it that way.

3. **Rating maths runs server-side only.**
   The client proposes games; it never computes an authoritative rating. A patched
   client must not be able to fake a ranking.

4. **No feature from the Out of Scope list.**
   It is in the spec's Out of Scope section for a reason that was argued through.

5. **No rating-parameter change without a simulation run.**
   Changing placement count, seed values, decay, or the display scale requires
   re-running the simulation harness and reporting the before/after ranking
   recovery. Do not tune these by intuition.

## Anti-slop rules

The author can read and tweak code but is not a professional developer. Code that
looks impressive and cannot be maintained is worse than no code.

- **No speculative abstraction.** No interface with one implementation. No
  `manager`/`helper`/`util` grab-bag files. No config object for a thing with one
  caller. Build the concrete case; abstract on the third repetition, not the first.
- **No file over ~300 lines.** If one grows past that, it is doing two jobs.
- **Strict TypeScript, no `any`, no non-null `!` assertions.** If a type is hard,
  the data model is probably wrong — say so instead of casting.
- **No new dependency without a one-line justification** recorded in the Decision
  Log below. Prefer the standard library and what is already installed.
- **Comments say why, never what.** Delete any comment that restates the code.
- **No dead code, no commented-out blocks, no `TODO` without an owner and a reason.**
- **Match the surrounding file's style** rather than importing a new idiom.
- **Write the domain-core test first.** Red, green, refactor. The `tdd` skill applies.
- **Do not generate scaffolding "for later."** Empty folders, placeholder screens,
  and stub services are slop. Build what the current task needs.
- **When unsure between two designs, ask.** Do not build both and leave one unused.

## Stack

- Expo + React Native, TypeScript, exported as a **static web build**; tested in
  iPhone Safari, installed to the home screen.
- Supabase free tier: Postgres, Auth, Edge Functions.
- `openskill.js` for the rating model, executed in an Edge Function.
- Username-and-password accounts only. The app sends no email; an admin resets a
  forgotten password.
- Distribution: GitHub Pages only. No app store, no TestFlight, no native build.
- Push: Web Push from a service worker. No widget. Nothing costs money.

## Glossary

Use these words in code, schema, and UI. Do not invent synonyms.

| Term | Meaning |
|---|---|
| **Game** | One badminton game to 31, 21, 15, or 11 points. The atomic rated unit. |
| **Match** | Not used as a distinct concept. One logged record == one game. |
| **Logger** | The player who entered a game. |
| **Participant** | Any of the four players in a game. |
| **Confirmation** | A participant's approval of a logged game. |
| **Dispute** | A participant's rejection, which freezes the game. |
| **Pending** | A logged game awaiting confirmation. Does not affect ratings. |
| **Confirmed** | A game that has moved ratings. |
| **Voided** | An admin-removed game. Excluded from replay. |
| **mu / sigma** | OpenSkill's skill estimate and its uncertainty. |
| **Display rating** | The player-facing number derived from mu and sigma. |
| **Tier** | Newbie, Y, TB, TB+, Khá. Club vocabulary, see spec. |
| **Seed tier** | The level a player declares at signup; sets starting mu only. |
| **Placement** | A player's first 5 confirmed games; shown as provisional. |
| **Replay** | Recomputing all ratings from the confirmed-game history. |
| **PvE** | Performance vs expectation; a partner-independent secondary stat. |

## Session start checklist

1. Read `docs/SPEC.md`.
2. Check the Decision Log below for anything that supersedes the spec.
3. Do not re-litigate settled decisions. The spec records what was decided and why.

## Decision Log

Append-only. Newest last. One line each: date, decision, reason.

- 2026-11-03 — Spec written from a five-round design interview. See `docs/SPEC.md`.
- 2026-11-03 — Vitest as the test runner, not jest-expo: the only unit-tested code is the pure domain core, which needs no React Native transform.
- 2026-11-03 — Scores to 15 and 11 end on win-by-two with a hard cap at 21 and 15 respectively; the spec had fixed a cap only for games to 21.
- 2026-11-03 — `applyEvent` returns a result union rather than the spec's bare `(state, event) -> state`, so an illegal transition reports why instead of being silently dropped.
- 2026-11-03 — A confirmed game cannot be disputed; admin correction or void is the only route, so auto-accept cannot be quietly undone after ratings have moved.
- 2026-11-03 — Sigma inflation for an absence is applied when a returning player next plays, never while they are away, so replay stays a pure function of the game list and an idle player's rating is preserved exactly.
- 2026-11-03 — Display scale z changed 3 to 1.5 after a simulation run: sigma plateaus near 5.2 at this club's volume rather than settling low, so z=3 flattened 24 of 150 simulated players to a display rating of zero.
- 2026-11-03 — Tier bands confirmed by simulation as 400 / 600 / 880 / 1120, replacing the provisional 550 / 720 / 900 / 1120. Within-one-tier labelling 59% to 96%, exact tier 26% to 49%, players clipped to zero 24/150 to 0, over five seeds.
- 2026-11-03 — Ranking recovery plateaus at Spearman ~0.85 once the club leaves placement and does not improve with more games; the ceiling is the carrying problem the spec anticipated, not a bug.
- 2026-11-03 — SIGMA_RECOVERY_DAYS (21) remains provisional: the harness simulates one month and cannot yet exercise a long absence.
- 2026-11-03 — A game is written by one `log_game` RPC rather than a client insert: supabase-js cannot open a transaction and a game is nine rows that must land together or not at all.
- 2026-11-03 — `played_at` is the server clock, not a client parameter, so a replay can never be reordered from a phone; `created_at` is kept separately and runs the auto-accept clock, so backdating could not shorten anyone's twenty-four hours.
- 2026-11-03 — Badminton score validity is NOT restated as a SQL constraint; `src/domain/validation` owns it and the social backstop (four public names, three confirmations, admin void) catches the rest, because one rule in two languages drifts. Only structural constraints are in the schema.
- 2026-11-03 — Every status change goes through `persist_game_state`, service-role only, which is handed the state the decision was made from and rejects with serialization_failure if it moved; otherwise two participants confirming in the same moment would each write the other's answer back.
- 2026-11-03 — Username-only accounts get a synthetic auth email derived from the handle (`<name>@users.badminton-ladder.invalid`), so sign-in needs no username-to-email lookup and no member's real address is exposed to handle guessing. Mirrored in `public.username_email_domain()` and `src/data/auth.ts`.
- 2026-11-03 — No auth trigger creates profiles; username, email, Google and Apple all finish by calling `create_my_profile`, so there is one path to membership rather than one that works for two of the four.
- 2026-11-03 — The spec's `notify-widget` is built as `notify-players`, carrying the confirmation request, the dispute alert and the silent widget wake behind one `kind`, because three near-identical push functions would be worse than one.
- 2026-11-03 — `push_tokens` and `notification_preferences` added to the data model: the spec omits them but stories 22, 25 and 61 to 64 need somewhere to live. Overtaken-on-ladder defaults to off, per story 63.
- 2026-11-03 — `player_ratings` stores `in_placement` and `last_played_at` straight off the engine, so the placement count stays a rating parameter in `rating-scale` instead of being restated in SQL, and activity can be measured against the current clock rather than a flag frozen at the last replay.
- 2026-11-03 — Relative imports inside `src/domain` carry explicit `.ts` extensions, because that is the only way a Deno Edge Function can import the domain core directly and run the one true engine. Verified that the edge runtime does not honour Deno's `sloppy-imports`, and that the CLI will not even mount a file it cannot resolve.
- 2026-11-03 — `log_game` requires the logger to be one of the four players, since the lifecycle counts them as confirmed implicitly and that only means something if they played.
- 2026-11-03 — Dependencies added: `@supabase/supabase-js` (the `data` module), `@react-native-async-storage/async-storage` (so a member stays signed in), `supabase` CLI (dev only, runs the local stack and generates `database.types.ts`).
- 2026-11-04 — Dependencies added for the app layer, author's choice: `expo-router` (file-based routing, and its peers `react-native-screens`, `react-native-safe-area-context`, `expo-linking`, `expo-constants`), `@tanstack/react-query` (server-state cache, so one place invalidates after a replay), `react-native-svg` (the rating graph is a line and needs a polyline), `@expo/vector-icons` (four tabs need icons).
- 2026-11-04 — `react-dom` pinned to 19.3.0 by an npm `overrides` entry: expo-router pulls Radix's web tabs, whose react-dom resolves to 19.3.1 and demands react ^19.3.1 while Expo pins react 19.3.0, so every `npm install` failed until the two were locked together.
- 2026-11-04 — The authoritative replay stays in `domain/rating`; the story-19 preview is a separate `domain/rating-preview`, so the untrusted path is obvious from the file name and the Edge Function keeps importing only the one true engine. Its test asserts the preview equals what a replay of the same game produces, so it cannot drift into lying.
- 2026-11-04 — PvE is defined as wins above expectation where the player themselves is replaced by the average of every *other* rating in the club, so the figure is exactly independent of their own rating and cannot be inherited from a strong partner. The spec fixed the property, not the formula; this is the formula.
- 2026-11-04 — `unwrap` is typed with supabase-js's own `PostgrestSingleResponse<T>` rather than a hand-written `{ data, error }`: with two independently nullable fields TypeScript infers a `.single()` query's row type as `null`, which silently gave every single-row caller a `never`.
- 2026-11-04 — `src/data/database.types.ts` was stale: it lacked `game_confirmations.game_id -> games`, which the games migration declares and the feed query embeds through, so the feed's confirmations typed as a `SelectQueryError`. Patched by hand to match the migration; re-run `npm run types:db` once Docker is available and the hand edit disappears.
- 2026-11-04 — `readAwaitingMyAnswer` became `readMyPendingGames`: the logger needs to reach their own pending game to cancel it (story 20), and who still owes an answer is already in the confirmations each row carries, so one query serves the banner and the cancel route rather than two that overlap.
- 2026-11-04 — No Realtime subscriptions. No v1 story asks for a live-updating screen; the ladder and feed refresh on pull and on cache invalidation after an answer, and the widget is the ambient path. Adding sockets would be a second staleness model to reason about.
- 2026-11-04 — One dark palette rather than light and dark, with `userInterfaceStyle` set to `dark` to match: two themes would double every screen's styling for thirty players.
- 2026-11-04 — `vitest.config.ts` added to scope collection to `src/**`: a locked git worktree under `.claude/worktrees` holds a second copy of the repo, and vitest's defaults ran its tests alongside this checkout's. `tsconfig.json` excludes `.claude` for the same reason.
- 2026-11-24 — Games to 31 added (story 16), capped at 40 on the 21→30 pattern; the `games_format_known` and `games_scores_in_range` constraints widened in a new migration.
- 2026-11-24 — Placement shortened from 10 to 5 games, after a simulation run over five seeds: Spearman at the end of placement 0.825 → 0.852, reached after ~85 club games instead of ~134; a third into the month 29.4/30 players are ranked instead of 23.8, with recovery among them 0.828 → 0.842. Full-season recovery unchanged at 0.883.
- 2026-11-24 — The tier the club calls "TB" is spelled TB, not TBY, in the glossary and on screen. The slug stays `tby` in code and the database, because renaming an enum value is a migration with no user-visible gain.
- 2026-11-24 — A confirmed game's detail no longer lists who confirmed it (story 45); the per-player answers show only while the game is pending (story 29).
- 2026-11-24 — Settings is its own tab instead of a screen pushed from the Me header. On the Everyone filter the ladder raises the top three onto a podium (Men and Women stay plain lists); every filter shows the member's own rank with the gap to the player above (`src/ui/standing.ts`), all read from the existing ladder query: no new data, no new dependency.
- 2026-11-24 — Web app on GitHub Pages instead of an iOS app on TestFlight; the widget, Sign in with Apple and the $99 Apple Developer account are dropped, at the author's call, so the project costs nothing. Stories 4 and 55–60 removed, 75–77 added for home-screen install. The widget-era entries above stand as history.
- 2026-11-24 — Username-only signup, at the author's call: email and Google sign-in are dropped (stories 2, 3), and with them Resend. A forgotten password is reset by an admin setting a temporary one (story 5 revised), because there is no address to send a reset to.
- 2026-11-24 — Dependencies added for the web build: `react-native-web` and `react-dom` (Expo's web renderer; `react-dom` was already pinned by the override and is now a direct dependency). The export is a single-page app under `experiments.baseUrl` `/BadmiGo`; `public/index.html` is its template, and `npm run export:web` copies `index.html` to `404.html` because GitHub Pages has no rewrites.
- 2026-11-24 — `web-push` (npm, Edge Functions only) signs and encrypts Web Push messages: VAPID JWTs and aes128gcm payload encryption are exactly the code not to hand-roll. It always sends over HTTPS, which every real push service is.
- 2026-11-24 — `push_tokens` replaced by `push_subscriptions` (endpoint, p256dh, auth), dropped rather than migrated since nothing had been registered. The widget's silent `confirmed` wake is gone from `notify-players`; iPhone shows every web push, so a silent one is not possible anyway.
- 2026-11-24 — Story 70's "implausible activity" is two flags read off the record in `src/domain/flags`: a disputed game, and a game confirmed by the clock with no answer from the other three inside the window. Scores are not second-guessed; the four public names are the check on those.
- 2026-11-24 — Admin actions (score correction, void, resolve, seed tier, merge, temporary password) go through one `admin` Edge Function with an `action` field, for the same reason as `notify-players`; each one that changes rating input ends in a replay. Appointing an admin stays a direct update, because RLS already allows it and it moves no rating.
- 2026-11-24 — A merge is refused when both accounts played in the same game (void it first), moves games, answers and logged games to the kept account in one transaction, and deletes the duplicate's auth account so it cannot quietly make a fresh profile.
- 2026-11-24 — "Passed on the ladder" (story 63) counts only players ranked both before and after a replay, ties broken by profile id as the replay orders them, and is sent from `replay-ratings`; a failed push never fails a replay.
- 2026-11-24 — The weekly recap covers the last seven days and is scheduled for Sunday 13:00 UTC, which is 20:00 in Vietnam.
- 2026-11-24 — Game photos: a private `game-photos` bucket taking JPEGs up to 512 KB, shrunk in the browser to a 1280 px long edge first, and a `games` constraint that a photo path sits in the logger's own folder. Storage is the one thing that could cost money.
- 2026-11-24 — Fixed the four problems in manual Part 12: the misordered pending and rating-history queries, colliding replays (an advisory lock in `apply_replay`), `auto-accept` claiming a replay it never ran and `confirm-game` dropping replay errors, and the purity guard's `expo-` and clock holes.
- 2026-11-24 — `create_my_profile` lost its `p_username` parameter and refuses any account not on the synthetic username domain. `database.types.ts` is regenerated from the migrations again, so the earlier hand patch is gone.
- 2026-11-24 — `.env.example` is tracked again (`!.env.example`). `supabase/.env.example` is deleted because `config.toml` no longer reads any env var; the VAPID keys live in `supabase/functions/.env`, documented by its `.example`.
- 2026-11-24 — Story 78, confirm all, at the author's call: a button on the Feed's waiting list when a member owes two or more answers. It calls `confirm-game` once per game, one after another, rather than a new batch endpoint, so every confirmation takes the one tested path and replays never overlap.
- 2026-11-24 — Review fixes: `src/data/function-contract.ts` holds what the app and the Edge Functions must agree on (`AdminAction`, `MIN_PASSWORD`) and imports only domain types, so Deno imports it as it does `database.types.ts`; `TIERS`, `asTier` and `asGameFormat` live beside `GAME_FORMATS` in `src/domain/types`. Every Edge Function call from the app goes through `invoke` in `src/data/client.ts`, so a refusal shows the function's own reason.
- 2026-11-24 — `merge_profiles` deletes the duplicate's `auth.users` row itself, and the cascade removes the profile, so a merge cannot stop halfway with a working login and no profile. The photo-path rule became an insert trigger instead of a check constraint, because the constraint refused any merge of a duplicate who had logged a game with a photo.
- 2026-11-24 — `apply_replay` returns the ladder it replaced, read under its advisory lock, and `replay-ratings` compares against that instead of reading the ladder itself before the lock, so two queued replays can no longer send the same "you were passed" push twice.
- 2026-11-25 — Game photos removed (story 21), at the author's call: a video was wanted instead, video storage would cost money, and a photo alone is not wanted. `photo_path`, the photo trigger and the storage policies are dropped in a new migration; the empty `game-photos` bucket is deleted from the dashboard, because Supabase refuses SQL deletes from storage tables.
- 2026-11-25 — Story 6a, a member renames themselves from Settings. A direct update of their own profile row, which RLS and `guard_profile_columns` already allowed; no new server code.
- 2026-11-25 — Story 46a, feed search by player name: the names are matched as the player picker matches them, then the confirmed games are filtered through an aliased `!inner` embed, the pattern `readMyPendingGames` already uses. While a search is open the waiting list is set aside.
- 2026-11-25 — Story 46a extended to search by day, at the author's call: a native `<input type="date">` laid invisibly over a chip (`src/ui/components/day-picker.tsx`) opens the iPhone's own date wheel with no new dependency, which works only because the app is web-only. A day is midnight to midnight on the phone's clock, the same day the feed means by "today", and combines with a name. A search returns up to 100 games, because a session day runs to about forty.
- 2026-11-25 — UI v2, at the author's call: one light palette replaces the dark one (`userInterfaceStyle` is now `light`). Floor #EEF2EF, white cards, court green #0E7A4F for the ladder head and links, nylon-shuttle yellow #FFD23F for what is yours and the primary action, a soft colour per tier. Light because a bright hall washes out a dark screen; still one theme, for the same reason as before. The dark-palette entry above stands as history.
- 2026-11-25 — Fonts: Be Vietnam Pro (reading) and a condensed Bricolage Grotesque (scores and ranks), self-hosted as woff2 under `public/fonts` (~200 KB, Vietnamese and Latin subsets only, SIL OFL). No font package and no third-party request; replaces the DIN faces, which exist only on Apple devices.
- 2026-11-25 — Every screen and push message in Vietnamese, "PvE" kept as the label. Tabs: Xếp hạng, Bảng tin, Ghi trận (a raised yellow button in the middle), Tôi, Cài đặt (gear). A disabled log button names what is still missing; the feed is grouped by day with search behind an icon. Score entry is unchanged: both scores are typed.
- 2026-11-25 — Story 1 revised: usernames keep their capitals and may use `.` and `-`; uniqueness is on `lower(username)`. The auth email stays the lower-cased handle, so existing accounts and case-insensitive sign-in are untouched. The typed spelling travels in the account's user metadata and `create_my_profile` only believes it when it lower-cases to the email's handle. Letters stay unaccented because the handle must be an email address.
- 2026-11-25 — Story 6b, avatars: `profiles.avatar_path`, constrained to the member's own folder, and a public `avatars` bucket (JPEG, 200 KB cap) that a member writes only into their own folder, also before their profile exists. Public so the ladder needs no signed URLs; paths carry a member id and a timestamp. The browser crops to a 320 px square first (~20 KB). `create_my_profile` takes an optional `p_avatar_path`; Settings changes or removes the picture and deletes the old file. No new dependency.
- 2026-11-25 — Story 6c: create-profile has "Quay lại đăng nhập", which signs out; the gate then shows sign-in. The half-made account stays and can finish its profile later.
- 2026-11-25 — `nextTier` added to `rating-scale` for the profile's "còn N điểm lên TB" bar; it reads the existing tier floors, so no parameter changed and no simulation run was needed.
- 2026-11-25 — Bricolage is now the cut the UI v2 mockup used: 80% width fixed, weight 400–800 and optical size 12–96 left variable, so the browser draws small figures with the open small-size shapes. The first cut had optical size fixed at 96 and looked cramped below display sizes. Instanced locally with fontTools; still ~113 KB, no package.
- 2026-11-25 — The PvE figure carries an info icon and its explanation opens on tap instead of always showing; the label and the explanation text are unchanged. Win–loss, win rate and PvE are three small cards, as in the mockup.
- 2026-11-25 — Dark mode, at the author's call, chosen per phone in Settings (Sáng / Tối, light by default) and kept in `localStorage`. `theme.ts` picks the palette once at load and a change reloads the page, because every screen builds its styles at import and threading a live theme through them all is a rewrite for a switch used once. `public/index.html` reads the same key so a dark phone never flashes the light floor. The green splits into `court` (a surface under white text) and `courtInk` (text and icons), because one green cannot be readable both under white and on a dark card. This supersedes "one theme" in the UI v2 entry.
