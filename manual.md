# Manual — getting the Badminton Ladder running

Written for someone who can read code but has not set this project up before.
Nothing is assumed. Every command says what it does and why you are running it.

Describes the repository as of **2026-11-04, 13:05**. The frontend was being written
while this was produced, so if a screen differs from the description, trust the screen.

You are on **Windows**, and your default terminal is **PowerShell**. Every command
below is written for PowerShell. Where a command would be different in Git Bash, both
are shown.

**Open the terminal in the project folder.** In VS Code: `` Ctrl+` ``. Everywhere else:
open PowerShell and run

```powershell
cd C:\Users\Admin\Desktop\badminton-ladder-app
```

Every command in this document assumes you are in that folder.

---

## Part 0 — What you are about to build, in plain words

It helps enormously to hold this picture before typing anything.

There are **three separate computers** involved, and most confusion comes from not
knowing which one you are talking to.

```
   ┌──────────────────┐        ┌──────────────────────┐       ┌──────────────┐
   │  1. YOUR PHONE   │  --->  │  2. THE BACKEND      │ <---  │ 3. YOUR PC   │
   │  (or simulator)  │        │  Postgres + Auth +   │       │  the code,   │
   │  runs the app    │        │  Edge Functions      │       │  the tests,  │
   │                  │        │  (in Docker, local)  │       │  the CLI     │
   └──────────────────┘        └──────────────────────┘       └──────────────┘
```

1. **The phone** runs the React Native app. It can log a game and confirm a game. It is
   not trusted: it cannot compute or write a single rating.
2. **The backend** is a real Postgres database plus Supabase's Auth and Edge Functions.
   While you develop, all of it runs **inside Docker on your own PC**. Later the same
   thing runs on Supabase's servers for free.
3. **Your PC** holds the source code and runs the tests. The tests are the only part
   that needs nothing else running at all.

The single most important thing to understand: **the ratings are not stored decisions,
they are recomputed.** Every time a game is confirmed, the server replays *every*
confirmed game the club has ever played, from scratch, through the rating engine, and
overwrites the whole ladder. That is why nothing can ever hand-edit a rating, and it is
why a bad score can be fixed by correcting the game instead of patching numbers.

### What works today, honestly

| Part | State |
|---|---|
| The rating engine, lifecycle, validation, stats | **Done.** 172 tests pass. |
| The simulation that proves the ratings are meaningful | **Done.** Spearman 0.883. |
| Database, security, auth, all four Edge Functions | **Done.** Proven by the smoke test. |
| The data layer the app reads through | **Done.** |
| The screens you tap on | **Done.** Ladder, feed, log, profiles, sign-in, settings. |
| The home-screen widget | **Not built yet.** Needs a Mac and the Apple membership. |
| Admin tools (fix a score, void a game) | **Not built yet.** |
| The weekly recap push | **Not built yet.** |

So: by the end of Part 8 you will have the **entire backend running and verified**, and
in Part 9 you will have the real app on your phone — logging games, confirming them,
and watching the ladder move.

Two commands tell you where you stand at any moment:

```powershell
npm test          # 172 passed   <- the rules are correct
npm run typecheck # silent       <- the code is consistent
```

Both are green right now.

---

## Part 1 — Install the five tools you need

Do these in order. After each one, run the check command. If the check prints a version
number, move on. If it prints "not recognized", the install did not finish — close and
reopen the terminal first, because a new install is not visible to an already-open one.

### 1.1 Node.js — runs JavaScript on your PC

Everything in this project is built with it: the tests, the TypeScript compiler, the
Expo bundler, the Supabase CLI.

Get the **LTS** installer from <https://nodejs.org>. Accept the defaults.

```powershell
node --version
```

You should see `v20.x` or newer. **You already have `v26.7.0`, so you are done here.**

> Why the version matters: `npm run smoke` runs a TypeScript file *directly*
> (`node scripts/smoke.ts`) with no build step. Node only learned to do that in v22.18.
> On an older Node that one command fails with a syntax error and nothing else does.

### 1.2 Git — version control

Almost certainly already installed, since this folder is already a git repository.

```powershell
git --version
```

If it is missing, get it from <https://git-scm.com>. The installer also gives you
**Git Bash**, which is a Unix-style shell — handy, because most online instructions for
Supabase assume it.

### 1.3 Docker Desktop — runs the backend on your PC

This is the big one, and the one people get stuck on.

Supabase's backend is not a single program. It is Postgres, a REST layer, an auth
server, a Deno runtime, a mail catcher and a web UI — about eight programs that have to
agree on versions and networking. Docker runs all of them in isolated containers so you
never install any of them yourself.

1. Download Docker Desktop for Windows: <https://www.docker.com/products/docker-desktop>
2. Install it. It will ask to enable **WSL 2**; say yes. It may need a reboot.
3. **Launch Docker Desktop and leave it running.** Look for the whale icon in your
   system tray. If the whale is not there, Docker is not running, and every Supabase
   command in Part 4 will fail.

```powershell
docker --version
docker ps
```

`docker --version` prints a version even when Docker is *not* running — only `docker ps`
proves the engine is actually up. It should print a table header. If instead you see

```
error during connect: ... dockerDesktopLinuxEngine: The system cannot find the file specified
```

then Docker Desktop is installed but **not started**. Open it from the Start menu and
wait for the whale to stop animating. (This is the exact error the project is giving
right now.)

> Docker needs roughly 4 GB of RAM to run this stack comfortably. If your PC gets
> sluggish, open Docker Desktop → Settings → Resources and give it a sensible limit.

### 1.4 Xcode — only when you want to run on an iPhone simulator

This is an **iOS-only** app. Simulators are macOS-only: Xcode does not exist for
Windows.

On Windows your options are:

- **Expo Go on a real iPhone** — a free app from the App Store. Scan a QR code from
  your terminal and the app loads on your phone. This is what you will use. It covers
  everything except the widget and native Google/Apple sign-in, which need a real
  build.
- **A Mac**, when you reach the widget and TestFlight steps. Unavoidable eventually:
  Apple does not allow iOS builds from Windows.

For now, install **Expo Go** from the App Store on your iPhone.

### 1.5 A code editor

VS Code: <https://code.visualstudio.com>. Install the **ESLint** and **Prettier**
extensions if you like, but nothing in the project requires them.

---

## Part 2 — Install the project's dependencies

```powershell
npm install
```

**What this does.** `package.json` lists the libraries the project needs.
`npm install` downloads them all into a folder called `node_modules`, which is why that
folder is enormous and why it is excluded from git — it is rebuildable at any time.

**What to expect.** A few minutes the first time. Some warnings in yellow are normal
and can be ignored. Red `ERR!` lines are not.

The libraries that matter:

| Library | What it is for |
|---|---|
| `openskill` | The actual rating maths. The engine everything else serves. |
| `@supabase/supabase-js` | How the app talks to the backend. |
| `expo`, `react-native`, `react` | The app framework. |
| `@tanstack/react-query` | Caches server data in the app and knows when to refetch. |
| `vitest` | The test runner. |
| `supabase` | The command-line tool that runs the local backend. |
| `typescript` | Checks your types. |

> **If `npm install` fails** with a permissions or path-length error, the usual cause is
> OneDrive syncing the folder. This project lives in `Desktop`, which OneDrive often
> syncs. Either pause OneDrive while you work, or move the project somewhere like
> `C:\dev\badminton-ladder-app`.

---

## Part 3 — Your first win: run the tests

Do this now, before anything else. **It needs no Docker, no database, and no internet.**
It is pure maths over plain data, which is the whole point of how this project is built.

```powershell
npm test
```

**What this does.** Runs every `*.test.ts` file under `src/`. These tests cover the
rating engine, the game lifecycle, score validation, the stats, and the simulation.

**What you should see** (this is the real output, right now):

```
 ✓ src/domain/rating-scale.test.ts (23 tests)
 ✓ src/domain/game-lifecycle.test.ts (34 tests)
 ✓ src/domain/validation.test.ts (60 tests)
 ✓ src/domain/purity.test.ts (5 tests)
 ✓ src/domain/stats.test.ts (14 tests)
 ✓ src/domain/rating-preview.test.ts (7 tests)
 ✓ src/domain/rating.test.ts (19 tests)
 ✓ src/simulation/recovery.test.ts (10 tests)

 Test Files  8 passed (8)
      Tests  172 passed (172)
```

**If you see that, the brain of the application works.** The rating model, the
confirmation rules, the score rules and the statistics are all correct and proven. No
database needed to know that.

### 3.1 The interesting one: run the simulation on its own

```powershell
npm run simulate
```

This is not a normal test. It invents **thirty fake players with known true skill
levels**, has them play about 270 realistic games over eight weekend sessions, and then
asks: *can the rating engine work out the ranking it was never told?*

It prints a table:

```
│ trueTier  │ n │ min │ median │ max  │ landedIn            │
│ 'newbie'  │ 6 │ 14  │ 171    │ 529  │ 'newbie, y'         │
│ 'y'       │ 7 │ 114 │ 399    │ 833  │ 'newbie, y, tby'    │
│ 'tby'     │ 8 │ 352 │ 789    │ 865  │ 'newbie, y, tby'    │
│ 'tb-plus' │ 6 │ 781 │ 1056.5 │ 1381 │ 'tby, tb-plus, kha' │
│ 'kha'     │ 3 │ 916 │ 1110   │ 1134 │ 'tb-plus, kha'      │
games simulated: 269
ranking recovery (Spearman): 0.883
```

How to read it: **0.883** is the correlation between the ratings the engine produced and
the true skill it was never shown. 1.0 would be perfect; 0.0 would be noise. 0.88 means
the ladder is genuinely informative, not decoration. The `landedIn` column shows that a
player who declares "Khá" ends up labelled TB+ or Khá — within one tier — which is what
the club needs for the labels to mean something courtside.

**This is the test of the idea, not of the code**, and it is why you can trust the
ladder before a single real game is logged.

> **Do not change any number in `src/domain/rating-scale.ts` without re-running this
> and writing down the before/after.** That is a hard rule in `CLAUDE.md`, and it exists
> because the first versions of two of those numbers were measurably wrong.

### 3.2 Check the types

```powershell
npm run typecheck
```

This compiles every TypeScript file without producing output, purely to find type
errors. **Success is silence** — no output at all means no errors.

It passes right now. If it ever starts reporting
`could not find the relation between games and game_confirmations`, that is the stale
generated-types problem: run `npm run types:db` (Part 6) and it goes away.

---

## Part 4 — Start the backend

From here on, **Docker Desktop must be running.** Check the whale icon.

### 4.1 Create the secrets file the backend reads

The backend's configuration lives in `supabase/config.toml`, which is committed to git.
Anything secret is *not* in that file — it reads values like `env(RESEND_SMTP_PASSWORD)`
from a separate file you create yourself and never commit.

```powershell
Copy-Item supabase\.env.example supabase\.env
```

Git Bash: `cp supabase/.env.example supabase/.env`

**You do not need to edit it.** The placeholders are deliberately fine for local work,
because email confirmations are switched off locally and only a password reset sends any
mail at all.

What is in it, and what each line is for when you eventually go live:

| Variable | What it is |
|---|---|
| `RESEND_SMTP_PASSWORD` | A Resend API key. Resend is the mail service that actually delivers password resets. The SMTP *username* is literally the word `resend`. |
| `AUTH_SENDER_EMAIL` | The "from" address on those emails. Must be on a domain you have verified with Resend. |
| `SUPABASE_AUTH_EXTERNAL_APPLE_CLIENT_ID` | Your iOS bundle identifier, `com.pvqh.badmintonladder`. |
| `SUPABASE_AUTH_EXTERNAL_APPLE_SECRET` | A generated JWT. Only the *web* sign-in flow needs it. |
| `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` | Every OAuth client that may present an identity token — your iOS client *and* your web client, comma-separated. |
| `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET` | The Google OAuth client secret. |

> **If `supabase\.env.example` does not exist**, that is bug #2 in Part 11 — the file is
> on disk but git is ignoring it, so a fresh clone has no copy. Part 11.2 fixes it. In
> the meantime just create `supabase\.env` by hand with these six lines:
> ```
> RESEND_SMTP_PASSWORD=re_placeholder
> AUTH_SENDER_EMAIL=ladder@example.com
> SUPABASE_AUTH_EXTERNAL_APPLE_CLIENT_ID=com.example.badmintonladder
> SUPABASE_AUTH_EXTERNAL_APPLE_SECRET=placeholder
> SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=placeholder.apps.googleusercontent.com
> SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=placeholder
> ```

### 4.2 Start everything

```powershell
npx supabase start
```

**What this does.** Downloads (the first time) and starts about eight Docker containers,
then applies all seven migration files in `supabase/migrations/` in filename order,
building the whole schema from nothing.

**The first run takes 5–15 minutes** — it is pulling several gigabytes of container
images. Later runs take 20–30 seconds. Let it finish; interrupting it halfway leaves
containers in a confused state.

When it finishes it prints a block like this. **Keep this output.**

```
         API URL: http://127.0.0.1:54321
     GraphQL URL: http://127.0.0.1:54321/graphql/v1
          DB URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres
      Studio URL: http://127.0.0.1:54323
    Inbucket URL: http://127.0.0.1:54324
      JWT secret: super-secret-...
        anon key: eyJhbGciOi....VERY.LONG.STRING
service_role key: eyJhbGciOi....ANOTHER.LONG.STRING
```

What each one is:

| Thing | What it is for |
|---|---|
| **API URL** (54321) | The single door into the backend. The app talks only to this. |
| **DB URL** (54322) | Raw Postgres. For a SQL client like DBeaver or `psql`. |
| **Studio URL** (54323) | A web UI to browse tables and run SQL. Open it in your browser. |
| **Inbucket/Mailpit** (54324) | Catches every email the backend "sends" so you can read it in a browser instead of a real inbox. |
| **anon key** | The public key the app ships with. **Safe to put in the app.** It grants nothing on its own; row-level security decides what a signed-in member may see. |
| **service_role key** | The master key. Bypasses all security. **Never put this in the app, in `.env`, or in git.** Only Edge Functions and the scheduler hold it. |

You can reprint this any time:

```powershell
npx supabase status
```

### 4.3 Useful: stop and reset

```powershell
npx supabase stop         # stop the containers, keep the data
npx supabase start        # start again, data still there

npx supabase db reset     # WIPE the database and re-apply every migration from zero
```

`db reset` is your friend, not a scary command. Because games are the only
authoritative data and ratings are derived, there is nothing precious in a local
database. **Run `db reset` any time you change a migration file** — editing a migration
that has already been applied does nothing until you reset.

---

## Part 5 — Tell the app where the backend is

The app needs two values: the URL and the anon key.

```powershell
Copy-Item .env.example .env
```

Git Bash: `cp .env.example .env`

Now open `.env` and paste in the **anon key** from the `supabase start` output:

```
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi....paste.the.whole.thing.here
```

**Why the `EXPO_PUBLIC_` prefix matters.** Expo takes any variable starting with
`EXPO_PUBLIC_` and bakes its value **literally into the app bundle** at build time.
That means two things:

1. Anyone with the app can read it. So **only the anon key may ever go here.** The
   service role key in this file would hand your entire database to anyone who
   downloads the app.
2. Because it is literal text substitution, `src/data/client.ts` spells the names out in
   full rather than looking them up dynamically. A dynamic lookup would be `undefined`
   in a real build while passing every test on your PC — a bug that only appears on a
   phone.

> **Important for running on a real iPhone:** `127.0.0.1` means "this device". Your
> phone is not your PC, so it cannot reach `127.0.0.1:54321`. When you test on a real
> phone, replace it with your PC's LAN address — find it with `ipconfig` and look for
> `IPv4 Address` (something like `192.168.1.42`), giving
> `EXPO_PUBLIC_SUPABASE_URL=http://192.168.1.42:54321`. Both devices must be on the same
> Wi-Fi.

---

## Part 6 — Regenerate the database types

```powershell
npm run types:db
```

**What this does.** Reads the live local database and writes a TypeScript description
of every table, column and enum into `src/data/database.types.ts`. That is what lets the
compiler catch `profiles.displayname` when the column is `display_name`.

**Run this after every single migration change.** The Edge Functions import this file
too, so a stale copy is a genuine bug, not a cosmetic one.

> **Never edit `src/data/database.types.ts` by hand.** It is generated. A hand edit is
> silently thrown away the next time you run this command — and worse, it can make the
> compiler agree to a query the database will refuse at runtime.
>
> **One exception is currently live and deliberate.** The Decision Log records that the
> committed copy was stale: it lacked the `game_confirmations.game_id -> games`
> relationship, which the games migration declares and which the feed query embeds
> through, so the feed's confirmations typed as a `SelectQueryError`. It was patched by
> hand to match the migration, with the note that the patch disappears the first time
> this command is run with Docker available.
>
> **So the moment you reach this step, that debt clears itself** — run the command and
> check the diff:
>
> ```powershell
> npm run types:db
> git diff src/data/database.types.ts
> ```
>
> If the relationship is still missing after regenerating, the generator is dropping
> the redundant foreign key and the fix belongs in the *query* rather than the types.
> In `src/data/games.ts`, name the key explicitly inside `FEED_SHAPE`:
>
> ```
> game_confirmations!game_confirmations_game_id_fkey (profile_id, state, responded_at),
> ```
>
> You can confirm which case you are in from Studio's SQL Editor — you should see
> **two** foreign keys:
>
> ```sql
> select conname, pg_get_constraintdef(oid)
> from pg_constraint
> where conrelid = 'public.game_confirmations'::regclass and contype = 'f';
> ```

---

## Part 7 — Prove the whole thing works end to end

```powershell
npm run smoke
```

**What this does.** This is the one test that touches everything at once. It:

1. Registers four club members through the real auth endpoint.
2. Has one of them log a game — **where the two newbies beat the two strongest players.**
3. Checks the game arrived as nine rows with only the logger pre-confirmed.
4. Checks a player who was *not* in the game **cannot** answer for it.
5. Checks a club member **cannot** make the server rebuild the ladder on demand.
6. Has the other three confirm.
7. Checks the game flipped to `confirmed` and the winning side was derived from scores.
8. Checks a phone **cannot** write a rating, invent a game, or make itself an admin.
9. Checks the ratings actually moved — and that the underdogs gained a *lot*.

**Expected output:** a list of `ok` lines, ending with

```
24 checks passed
```

Its job is to prove the **wiring**, not the rules — the rules are proven by the 172
tests in Part 3. What only this can prove is the stuff that is *configuration* rather
than code, and would therefore break silently: row-level security, the permission
grants, the atomic nine-row write, and whether a Deno Edge Function can reach the
TypeScript rating engine at all.

If this passes, **your backend is correct and secure.** That is the real milestone.

---

## Part 8 — Look inside with Studio

Open <http://127.0.0.1:54323> in your browser.

Click **Table Editor** in the left sidebar. The tables, in the order worth reading:

**The authoritative ones — written by members:**

- `profiles` — one row per club member. Username, display name, gender, seed tier,
  admin flag. *Having a row here is what makes an account a club member.*
- `games` — one row per badminton game. Scores, format, status, and two timestamps:
  `played_at` (what the replay orders by) and `created_at` (what the 24-hour
  confirmation clock runs from).
- `game_participants` — exactly four rows per game: who played, on which side.
- `game_confirmations` — exactly four rows per game: who has confirmed, disputed, or
  not answered yet.

**The derived ones — nothing writes these by hand, ever:**

- `player_ratings` — the ladder. `mu` and `sigma` are the engine's internals;
  `display_rating` is the number a player sees; `tier` is the club label.
- `rating_history` — what every game moved, for every player. This is the rating graph.
- `rating_replay_state` — one row, saying when the ladder was last rebuilt and from how
  many games. **If this looks stale, the ladder on screen does not match the games
  underneath it.**

Now click **SQL Editor** and try this — it is the single most useful query for
understanding the system:

```sql
select p.display_name, p.seed_tier,
       r.display_rating, r.tier, r.games_played, r.in_placement, r.is_active
from player_ratings r
join profiles p on p.id = r.profile_id
order by r.display_rating desc;
```

That is the ladder. The smoke test left four `smoke_...` members in it.

And this shows you the derivation is honest:

```sql
select * from rating_replay_state;
```

### 8.1 Reading the emails the backend sends

Open <http://127.0.0.1:54324>. This is Mailpit, a fake inbox. Any password-reset email
lands here instead of a real address.

One catch: `supabase/config.toml` has `[auth.email.smtp] enabled = true`, which points
mail at Resend rather than Mailpit. To read mail locally, set that `enabled = false`,
then `npx supabase stop` and `npx supabase start`. Set it back when you are done.

---

## Part 9 — Run the app

```powershell
npm start
```

A QR code appears in the terminal.

- **On an iPhone:** open the Camera app, point it at the QR code, tap the banner. Expo
  Go opens and loads the app. (Your phone and PC must be on the same Wi-Fi, and see the
  LAN-address note in Part 5.)
- **Press `w`** in the terminal to open it in a browser instead — quick for checking the
  bundler works, though this is an iOS app and not everything will render.

**What you will see:** the sign-in screen. The app is dark-only by design.

### 9.1 Walk the whole loop yourself

This is the real test, and it takes about three minutes. You need **two** accounts at
minimum, four to see a rating actually move.

1. **Sign up.** Tap through to *Join the club*. A username alone is enough — no email
   needed. Pick a display name and declare your level (Newbie, Y, TB, TB+, Khá).
   Remember: the seed only sets your *starting* point; a few games will overrule it.
2. **You land on `create-profile`** if the account exists but the membership does not.
   That gap is a real state, not an error — it is how Google and Apple sign-in work too.
3. **The Ladder tab** will say *"Nobody has played yet. Log a game and the ladder
   starts."*
4. **Repeat 1–2 three more times** in Expo Go (sign out from Settings), or just run
   `npm run smoke` to have four members created for you.
5. **Log tab.** You hold the first slot automatically — the server only accepts a game
   you played in. Pick a partner and two opponents, choose *to 21*, type a score.
   - Type `21` and `25` and watch it refuse: *"That is not a finished game to 21: win
     by two, and a cap at the top."* That is `src/domain/validation` running on your
     phone, the same function the 60 validation tests exercise.
   - Enter a legal score and the **"What it is worth"** card appears, showing what each
     of the four stands to gain or lose. It is captioned as an estimate on purpose: the
     real number is computed on the server once all four agree.
6. **Submit.** The other three now have 24 hours. Your lineup stays put so the next
   game is just a score.
7. **Sign in as one of the others.** A banner on opening the app says you owe an
   answer. Confirm it. Then the last one.
8. **The moment the fourth person confirms**, the server replays the entire game
   history and the Ladder tab changes. The header will tell you *"Ratings last rebuilt
   just now."*
9. **The Feed tab** shows the game with the rating change against each name. **Me**
   shows your record, your rating graph, your partner breakdown and your
   performance-vs-expectation.

If that loop works, the application works.

Press `Ctrl+C` to stop the bundler.

### 9.2 What you cannot test in Expo Go

- **Push notifications.** They need a real build with push credentials. In Expo Go the
  confirmation request will not arrive as a notification — use the in-app banner
  instead, which is exactly why the banner exists (story 28).
- **Native Google and Apple sign-in.** Both need a real build and configured OAuth
  clients. Username and email sign-in work fully.
- **The widget.** Not built, and needs a Mac.

---

## Part 10 — Everyday commands

Pin this section.

```powershell
# ----- no Docker needed -----
npm test                  # the 172 domain tests. Run constantly.
npm run test:watch        # re-run on every save. Leave this open while coding.
npm run simulate          # the 30-player simulation, with its report table
npm run typecheck         # find type errors across the project

# ----- Docker must be running -----
npx supabase start        # bring the backend up
npx supabase stop         # take it down (data survives)
npx supabase status       # reprint the URLs and keys
npx supabase db reset     # wipe and re-apply all migrations — do this after editing one
npm run types:db          # regenerate database.types.ts — do this after every migration
npm run smoke             # the end-to-end check

# ----- the app -----
npm start                 # Expo bundler + QR code
npm run ios               # same, aimed at an iOS simulator (needs a Mac)
```

### The order you will actually work in

**Changing a rule (a rating parameter, a lifecycle rule, a score rule):**

1. Write the test first. Watch it fail. (`CLAUDE.md` requires this: red, green, refactor.)
2. Change the code in `src/domain/`.
3. `npm test` until green.
4. If you touched `src/domain/rating-scale.ts`: `npm run simulate`, and write the
   before/after ranking recovery into the Decision Log in `CLAUDE.md`. Not optional.

**Changing the database:**

1. Create a **new** migration file in `supabase/migrations/`. Name it with a timestamp
   after the existing ones, e.g. `20261105090000_admin_tools.sql`. **Never edit a
   migration that has already run on production** — it will not re-run.
2. `npx supabase db reset` — wipe and re-apply everything, including yours.
3. `npm run types:db` — regenerate the types.
4. `npm run smoke` — confirm nothing broke.

**Changing a screen:** `npm start`, save a file, it reloads on the phone.

---

## Part 11 — Two things to fix, and they are both one line

These came out of a strict code-quality review on 2026-11-04. Two of the four original
findings were fixed by the author while the review was running — `probe.ts` is gone and
`typecheck` is clean, and the dependency justifications are now in the Decision Log.
These two remain, they are both in `.gitignore`, and together they take under a minute.

### 11.1 Put the specification back in version control — do this first

**The problem.** The last line of `.gitignore` is `*.md`, which means git is ignoring
**every** markdown file in the project. Check for yourself:

```powershell
git ls-files | Select-String "\.md$"
```

That returns nothing. **Zero** markdown files are tracked, out of 44 tracked files.
`CLAUDE.md`, `docs/SPEC.md`, `docs/BACKEND.md`, `architecture.md` and this file are all
invisible to git.

**Why it matters more than it looks.** `CLAUDE.md` opens with *"Read this file and
`docs/SPEC.md` before writing any code. They are the contract."* It holds the five hard
rules and the append-only Decision Log — the record of which numbers were measured,
which designs were rejected, and why. None of it is reconstructible from the code. One
`git clean -xfd`, one disk failure, one accidental folder delete, and the entire design
history is gone while every line of code survives.

**The fix.** Open `.gitignore` and delete the last two lines:

```
# Docs
*.md
```

Then commit the documents:

```powershell
git add -A
git commit -m "Track the spec, the hard rules and the decision log"
```

### 11.2 Stop ignoring the two example env files

**The problem.** Line 46 of `.gitignore` is `.env.example` **with a trailing space**.
Git strips trailing whitespace from ignore patterns, so that line matches
`.env.example` — the exact files it was written to *spare*. Both `.env.example` and
`supabase/.env.example` are therefore untracked.

```powershell
git check-ignore -v .env.example supabase/.env.example
```

**Why it matters.** Those two files are the only documentation of which environment
variables exist. On a clean clone they are absent, so the first two commands of local
setup — `cp .env.example .env` — fail with "no such file", and a newcomer has no way to
know what belongs in `.env`.

**The fix.** Replace those lines in `.gitignore` with an explicit pair:

```
# Filled-in environment files. Only the .example copies are committed.
.env
supabase/.env
!.env.example
!supabase/.env.example
```

Then `git add .env.example supabase/.env.example` and commit.

### 11.3 Verify

```powershell
npm test            # 172 passed
npm run typecheck   # silent = success
npm run smoke       # 24 checks passed      (needs the stack running)
git status           # and the .md files are now tracked
```

### 11.4 One thing to remember rather than fix

`src/data/database.types.ts` holds a deliberate hand patch, recorded in the Decision
Log: the committed copy was generated before the `game_confirmations -> games` foreign
key existed in the local database, so it was patched by hand to match the migration.

**It clears itself the first time you run `npm run types:db` with Docker running** —
which is Part 6. The only risk is forgetting, so do Part 6 before you trust the feed.

---

## Part 12 — Four deeper problems worth fixing before the club uses this

Not blockers. They will cause confusing bugs later, and they are all small fixes now.
Full write-ups are in `architecture.md` section 15.

### 12.1 Two queries claim an order they do not have

In `src/data/games.ts` and `src/data/ladder.ts`:

```ts
.order('played_at', { referencedTable: 'games', ascending: false })
```

That option orders rows **inside** an embedded resource. Here `games!inner` is a
to-*one* embed — there is exactly one game per row — so it sorts a list of one and the
top-level order is left undefined.

So `readMyPendingGames` does not actually return newest-first, and `readRatingHistory`
does not actually return oldest-first. **The second one matters: it is the rating
graph, and the points will be in arbitrary order.**

The clean fix also simplifies things. Make `games` the top-level table, joining through
an *aliased* inner embed so the real participant list stays whole:

```ts
export async function readMyPendingGames(profileId: ProfileId) {
  return unwrap(
    await supabase
      .from('games')
      .select(`${FEED_SHAPE}, mine:game_participants!inner (profile_id)`)
      .eq('mine.profile_id', profileId)
      .eq('status', 'pending')
      .order('played_at', { ascending: false }),
  );
}
```

The alias matters: filtering on an embed also filters the embedded rows, so without a
separate alias the lineup would shrink to one player. As a bonus this returns a plain
`GameRow`, the same shape as the feed, which deletes the `{ game_id, games }` wrapper
the screens would otherwise have to unpack three different ways.

For `readRatingHistory`, just sort in the client. It is a few hundred points at most,
and it is honest.

### 12.2 Two replays at the same moment collide

`apply_replay` deletes all of `rating_history` and then inserts. `player_ratings` is
protected by `on conflict do update`; `rating_history` is not.

`confirm-game` fires a replay **every time a game becomes confirmed**. Two people
confirming two different games in the same second on a Saturday evening is completely
ordinary. When that happens, both transactions delete the rows their own snapshot can
see, then both insert the same primary keys — and the second one fails with a unique
violation. Result: the ladder silently stays stale.

One line fixes it. In `supabase/migrations/...120300_derived_ratings.sql`, make it the
first statement in the body of `apply_replay`:

```sql
perform pg_advisory_xact_lock(hashtext('apply_replay'));
```

Concurrent replays then queue instead of colliding. Remember: new migration file, then
`db reset`, then `types:db`.

### 12.3 Two silent failures

- **`auto-accept` claims `replayed: true` when it never replayed.** The replay sits
  behind `if (accepted.length > 0)`, but the final `return` hardcodes `replayed: true`.
  That is the field you read out of `cron.job_run_details` to check the scheduler is
  healthy, so it lies on every quiet hour.
- **`confirm-game` throws the replay error away.** `replayed = replay.error === null`
  discards it with no log line. For a system whose first rule is "ratings are derived", a
  silent replay failure is the one fault you most want a breadcrumb for. Add
  `console.error(replay.error)`.

### 12.4 The purity guard has a hole

`src/domain/purity.test.ts` is the single mechanism enforcing "the domain core imports
nothing". Its forbidden list matches `'expo'` and `'expo/'` — but the real packages are
`expo-router`, `expo-constants`, `expo-linking`, `expo-status-bar`. All four would pass.

Match the `expo-` prefix too. While you are there, the spec also promises the domain
takes *"no dates from the system clock"*. Nothing checks it. The discipline is currently
perfect, so adding a check for `Date.now(` under `src/domain` costs nothing and keeps it
that way.

---

## Part 13 — When something breaks

### `failed to connect to the docker API ... dockerDesktopLinuxEngine`

Docker Desktop is not running. Open it from the Start menu, wait for the whale in the
system tray to settle, then retry. This is the most common failure by a wide margin.

### `npx supabase start` hangs or fails partway

```powershell
npx supabase stop --no-backup
npx supabase start
```

If it still fails, Docker Desktop → Troubleshoot → **Clean / Purge data**, then try
again. You lose only local containers; nothing in this repository is at risk.

### `Error: EXPO_PUBLIC_SUPABASE_URL is missing. Copy .env.example to .env and fill it in.`

Exactly what it says. Go back to Part 5. If `.env` exists and looks right, **restart the
Expo bundler** — those values are read at bundle time, not at runtime, so an already-
running bundler will not see your edit.

### `supabase status is missing the local keys; is the stack running?`

`npm run smoke` could not read the local credentials. Run `npx supabase start` first.

### The smoke test fails on a permission or relation error

Your database is probably behind your migration files. Editing an already-applied
migration does nothing until you reset:

```powershell
npx supabase db reset
npm run types:db
npm run smoke
```

### `could not find the relation between games and game_confirmations`

That is bug 11.3. Follow Part 11.3.

### A query compiles but returns a 400 at runtime

Almost always a stale or hand-edited `database.types.ts`. Run `npm run types:db` and
look at the diff. If the diff is large, your types were badly out of date and that is
the real bug.

### The app on my phone cannot reach the backend

`127.0.0.1` means "this device", and your phone is not your PC. Use your PC's LAN IP —
see the note at the end of Part 5. Both devices on the same Wi-Fi. Windows Firewall may
also need to allow Node through on first run.

### Tests pass but the app behaves differently

Expected, and informative: the tests cover `src/domain`, which is pure logic. A
difference means the bug is in `src/data`, a screen, or the database — not in the rules.
That narrowing is the entire reason the project is laid out this way.

---

## Part 14 — When you are ready to go live

Everything above was local. Going to production is three things the repository cannot
hold for you. `docs/BACKEND.md` has the full detail; this is the shape of it.

### 14.1 Create the hosted project and push the schema

Make a free project at <https://supabase.com>, then:

```powershell
npx supabase link --project-ref <your-project-ref>
npx supabase db push           # apply the migrations to the hosted database
npx supabase functions deploy  # deploy all four Edge Functions
npx supabase config push --env-file supabase/.env   # push auth + SMTP settings
```

For this step `supabase/.env` must hold **real** values: a Resend API key, a sender
address on a domain verified with Resend, and your Google and Apple client IDs.

Then update `.env` with the hosted project's URL and anon key — **the hosted anon key,
not the local one.**

### 14.2 Set up Google and Apple sign-in

They ship together. App Store guideline 4.8 requires an equivalent privacy-respecting
login wherever a third-party one is offered, so offering Google obliges you to offer
Apple.

The app's URL scheme is `badmintonladder`, already in `app.json` and in
`additional_redirect_urls`. Google's `client_id` takes **every** client that may present
an identity token — iOS *and* web, comma-separated. Apple's takes the bundle identifier,
`com.pvqh.badmintonladder`.

### 14.3 Schedule the hourly sweep — do not skip this

`auto-accept` works perfectly and **nothing calls it.** Without a scheduler, a game
nobody answers stays pending forever and story 26 does not exist. It needs the project
ref and the service role key, so it cannot live in a migration.

Run this **once**, in the SQL Editor of your hosted project:

```sql
select vault.create_secret('https://<ref>.supabase.co/functions/v1', 'functions_url');
select vault.create_secret('<service-role-key>', 'service_role_key');

select cron.schedule('auto-accept', '7 * * * *', $job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'functions_url')
           || '/auto-accept',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' ||
        (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')),
    body := '{}'::jsonb
  );
$job$);
```

Check it is firing:

```sql
select * from cron.job_run_details order by start_time desc limit 5;
```

### 14.4 Apple, and the one bill

- **Apple Developer Program, $99/year.** Required, and it is the project's only cost.
  The App Group entitlement the widget needs is not available to free personal teams.
- **TestFlight only.** Not the public App Store. Build with EAS
  (`npx eas build -p ios`), submit to TestFlight, invite a handful of players first,
  then the whole club.
- **You need a Mac** for the widget and for Xcode. There is no way around this from
  Windows.
- Supabase free projects pause after about a week of inactivity — twice-weekly use
  comfortably prevents it.

---

## Part 15 — What to build next

The spec's own build order is: **schema and auth → log, confirm and the rating engine →
ladder, feed and stats → widget → TestFlight.**

**The first three are done.** The remaining work, in the order that pays off:

1. **Fix the two `.gitignore` lines** (Part 11). The specification and the Decision Log
   are not in version control. Nothing else on this list matters if that is lost.

2. **Fix the two unordered queries** (Part 12.1). `readRatingHistory` feeds the rating
   graph, and its points are currently in arbitrary order — the graph on the Me tab is
   drawing a scribble rather than a trend. This is the one live bug a club member would
   actually see.

3. **Add the advisory lock to `apply_replay`** (Part 12.2). One line. Without it, two
   people confirming different games in the same second leaves the ladder silently
   stale, and Saturday evening is exactly when that happens.

4. **Put the app in front of two or three players** before building anything else. The
   loop works; what you do not know yet is whether logging a game between games is
   actually fast enough courtside. That answer should shape what comes next.

5. **Admin tooling** (stories 65–72). All the pieces exist — the reducer has `void` and
   `resolve`, `persist_game_state` and `replay-ratings` exist, `is_admin()` guards the
   privileged columns. Until it is built, **an admin edit to `seed_tier` leaves every
   rating stale** until a replay runs, and `rating_replay_state` is the only way to
   notice. Story 67 says the recomputation must be automatic, so whatever you build must
   end in a replay.

6. **The hourly `auto-accept` schedule** (Part 14.3) before any real club use. Without
   it, a game nobody answers stays pending forever.

7. **The widget.** Needs the $99 Apple membership and a Mac. This is the feature the
   whole premise rests on — an ambient ladder on the home screen — so it is worth the
   cost, but everything else should be solid first.

8. **The weekly recap** (story 62). The preference exists and defaults on; nothing
   sends it.

Still firmly out of scope, however tempting: pairing and court-rotation suggestions.
It is the likely v2 and the ratings this app produces are exactly its input — but the
logging loop has to be proven first.

---

## Part 16 — The rules you must not break

These are from `CLAUDE.md`. They are not style preferences; breaking one is a bug.

1. **Never write a rating as an authoritative value.** Every rating is the output of a
   full replay. Any code path that changes a rating without a replay is wrong, however
   small it looks.
2. **`src/domain/**` imports nothing** from React, React Native, Expo, Supabase, or any
   I/O library. It is plain functions over plain data. It is the only test seam in the
   project. Keep it that way.
3. **Rating maths runs server-side only.** The client may *preview* a prospective
   change; it never computes an authoritative one. A patched app must not be able to
   fake a ranking.
4. **Nothing from the spec's Out of Scope list.** Each item is there for a reason that
   was argued through.
5. **No rating-parameter change without a simulation run.** Changing the placement
   count, a seed value, the decay, or the display scale means re-running
   `npm run simulate` and writing the before/after ranking recovery into the Decision
   Log. Two of those numbers were measurably wrong when first written; that is how it was
   found out.

And the practical ones that keep the codebase readable: no file over ~300 lines; strict
TypeScript with no `any` and no `!`; no new dependency without a one-line justification
in the Decision Log; comments explain *why*, never *what*; no dead code; write the
domain test first; **do not build scaffolding for later.**

When you are unsure between two designs, **ask** rather than building both and leaving
one unused.
