# Manual — getting the Badminton Ladder running

Written for someone who can read code but has not set this project up before.
Nothing is assumed. Every command says what it does and why you are running it.

Describes the repository as of **2026-11-24**, after the move from an iOS app to a
web app on GitHub Pages. If a screen differs from the description, trust the screen.

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

There are **four separate computers** involved, and most confusion comes from not
knowing which one you are talking to.

```
   ┌──────────────────┐        ┌──────────────────────┐       ┌──────────────┐
   │  1. A PHONE      │  --->  │  2. THE BACKEND      │ <---  │ 4. YOUR PC   │
   │  Safari, the app │        │  Postgres + Auth +   │       │  the code,   │
   │  on its home     │        │  Storage + Edge      │       │  the tests,  │
   │  screen          │        │  Functions (Supabase)│       │  the CLI     │
   └──────────────────┘        └──────────────────────┘       └──────────────┘
            ^                                                         │
            │              ┌──────────────────────┐                   │
            └───────────── │  3. GITHUB PAGES     │ <──── git push ───┘
              loads the    │  serves the app's    │
              app from     │  files, nothing else │
                           └──────────────────────┘
```

1. **The phone** runs the app in its browser. It can log a game and confirm a game. It
   is not trusted: it cannot compute or write a single rating.
2. **The backend** is a real Postgres database plus Supabase's Auth, Storage and Edge
   Functions. While you develop, all of it runs **inside Docker on your own PC**. Later
   the same thing runs on Supabase's servers for free.
3. **GitHub Pages** hosts the app itself: plain HTML, JavaScript and icons, built by
   GitHub every time you push. It runs no code of its own and holds no data.
4. **Your PC** holds the source code and runs the tests. The tests are the only part
   that needs nothing else running at all.

The single most important thing to understand: **the ratings are not stored decisions,
they are recomputed.** Every time a game is confirmed, the server replays *every*
confirmed game the club has ever played, from scratch, through the rating engine, and
overwrites the whole ladder. That is why nothing can ever hand-edit a rating, and it is
why a bad score is fixed by correcting the game instead of patching numbers.

### What works today, honestly

| Part | State |
|---|---|
| The rating engine, lifecycle, validation, stats, flags, recap | **Done.** 214 tests pass. |
| The simulation that proves the ratings are meaningful | **Done.** Spearman 0.883. |
| Database, security, username sign-in, all six Edge Functions | **Done.** Proven by the smoke test. |
| The screens | **Done.** Ladder, feed, log (with photo), profiles, settings, admin. |
| Home-screen install, and the deep links GitHub Pages needs | **Done.** Checked on a local copy of the Pages setup. |
| Web Push notifications | **Built and checked as far as a PC can.** Real delivery needs the live site and a phone; see Part 13. |
| The home-screen widget | **Dropped** on 2026-11-24, with the Apple membership. |

Two commands tell you where you stand at any moment:

```powershell
npm test          # 214 passed   <- the rules are correct
npm run typecheck # silent       <- the code is consistent
```

Both are green right now.

---

## Part 1 — Install the tools you need

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

You should see `v22.18` or newer. **You already have `v26.7.0`, so you are done here.**

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
server, file storage, a Deno runtime and a web UI — about eight programs that have to
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
wait for the whale to stop animating.

> Docker needs roughly 4 GB of RAM to run this stack comfortably. If your PC gets
> sluggish, open Docker Desktop → Settings → Resources and give it a sensible limit.

### 1.4 A browser, and your phone

The app is a website, so a browser on your PC is enough to develop it. Chrome or Edge
are fine.

To try it on your **iPhone** while developing, you only need the phone on the same
Wi-Fi as your PC (Part 9.2). No Mac, no Xcode, no App Store, no Apple account.

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
| `react-native-web`, `react-dom` | Turn those React Native screens into a web page. |
| `@tanstack/react-query` | Caches server data in the app and knows when to refetch. |
| `vitest` | The test runner. |
| `supabase` | The command-line tool that runs the local backend. |
| `typescript` | Checks your types. |

The Edge Functions have one library of their own, `web-push`, listed in
`supabase/functions/deno.json`. It signs and encrypts notifications. You do not install
it: the Supabase runtime fetches it.

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
rating engine, the game lifecycle, score validation, the stats, what the admin gets
flagged, the weekly recap, who passed whom on the ladder, and the simulation.

**What you should see:**

```
 ✓ src/domain/rating-scale.test.ts (23 tests)
 ✓ src/domain/game-lifecycle.test.ts (34 tests)
 ✓ src/domain/validation.test.ts (79 tests)
 ✓ src/domain/purity.test.ts (6 tests)
 ✓ src/domain/stats.test.ts (14 tests)
 ✓ src/domain/rating-preview.test.ts (7 tests)
 ✓ src/domain/rating.test.ts (19 tests)
 ✓ src/domain/flags.test.ts (6 tests)
 ✓ src/domain/recap.test.ts (4 tests)
 ✓ src/domain/overtaken.test.ts (6 tests)
 ✓ src/domain/types.test.ts (2 tests)
 ✓ src/ui/standing.test.ts (4 tests)
 ✓ src/simulation/recovery.test.ts (10 tests)

 Test Files  13 passed (13)
      Tests  214 passed (214)
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

---

## Part 4 — Start the backend

From here on, **Docker Desktop must be running.** Check the whale icon.

### 4.1 Make the notification keys

Notifications are signed with a key pair called a **VAPID** key. You make one pair, once,
and keep it for good: if you ever change it, every phone stops getting notifications
until its owner switches them on again.

The Edge Functions read their keys from `supabase/functions/.env`, which you create and
**never commit** (git already ignores it).

```powershell
Copy-Item supabase\functions\.env.example supabase\functions\.env
```

Git Bash: `cp supabase/functions/.env.example supabase/functions/.env`

Now generate a pair. This prints two lines:

```powershell
node -e "const e=require('crypto').createECDH('prime256v1');e.generateKeys();console.log('VAPID_PUBLIC_KEY='+e.getPublicKey('base64url'));console.log('VAPID_PRIVATE_KEY='+e.getPrivateKey('base64url'))"
```

Paste both lines into `supabase/functions/.env`, replacing the placeholders, and set
`VAPID_SUBJECT` to `mailto:` followed by your own address. Push services use that
address only to contact you if your server misbehaves.

**Keep the public key handy** — the app needs it too, in Part 5. The private key goes
nowhere else.

> **The local stack and the live one can share a pair or have their own.** Your own
> local `supabase/functions/.env` already has a pair made for development. For going
> live (Part 12), make a fresh pair the same way.

### 4.2 Start everything

```powershell
npx supabase start
```

**What this does.** Downloads (the first time) and starts about eight Docker containers,
then applies every migration file in `supabase/migrations/` in filename order, building
the whole schema from nothing.

**The first run takes 5–15 minutes** — it is pulling several gigabytes of container
images. Later runs take 20–30 seconds. Let it finish; interrupting it halfway leaves
containers in a confused state.

When it finishes it prints a block of URLs and keys. **Keep this output.** What each one
is:

| Thing | What it is for |
|---|---|
| **API URL** (54321) | The single door into the backend. The app talks only to this. |
| **DB URL** (54322) | Raw Postgres. For a SQL client like DBeaver or `psql`. |
| **Studio URL** (54323) | A web UI to browse tables and run SQL. Open it in your browser. |
| **anon key** | The public key the app ships with. **Safe to put in the app.** It grants nothing on its own; row-level security decides what a signed-in member may see. |
| **service_role key** | The master key. Bypasses all security. **Never put this in the app, in `.env`, or in git.** Only Edge Functions and the scheduler hold it. |

You can reprint this any time:

```powershell
npx supabase status
```

> If you change `supabase/functions/.env` while the stack is running, run
> `npx supabase stop` and `npx supabase start` so the functions see it.

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

The app needs three values: the backend URL, the anon key, and the VAPID public key.

```powershell
Copy-Item .env.example .env
```

Git Bash: `cp .env.example .env`

Now open `.env` and fill it in:

```
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi....paste.the.whole.anon.key.here
EXPO_PUBLIC_VAPID_PUBLIC_KEY=the.public.key.from.part.4.1
```

**Why the `EXPO_PUBLIC_` prefix matters.** Expo takes any variable starting with
`EXPO_PUBLIC_` and bakes its value **literally into the app's JavaScript** at build
time. That means two things:

1. Anyone who opens the site can read it. So **only public values may ever go here**:
   the anon key and the VAPID *public* key. The service role key or the VAPID private
   key in this file would be published to the world.
2. Because it is literal text substitution, `src/data/client.ts` spells the names out in
   full rather than looking them up dynamically. A dynamic lookup would be `undefined`
   in a real build while passing every test on your PC.

> **For trying it on your phone (Part 9.2):** `127.0.0.1` means "this device". Your
> phone is not your PC, so it cannot reach `127.0.0.1:54321`. Replace it with your PC's
> LAN address — find it with `ipconfig` and look for `IPv4 Address` (something like
> `192.168.1.42`), giving `EXPO_PUBLIC_SUPABASE_URL=http://192.168.1.42:54321`. Both
> devices must be on the same Wi-Fi.

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
> compiler agree to a query the database will refuse at runtime. (The hand patch an
> earlier version of this manual warned about is gone; the committed copy is generated.)

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
6. Has the other three confirm, and checks the game flipped to `confirmed`.
7. Checks a browser **cannot** write a rating, invent a game, or make itself an admin.
8. Checks the ratings actually moved — and that the underdogs gained a *lot*.
9. Makes one member an admin, **corrects the score**, and checks the correction
   replayed by itself and that an impossible score is refused.
10. Has the admin **set a temporary password** and signs in with it.
11. Has the admin **merge a duplicate account**, and checks the duplicate can no
    longer sign in (and that two players from the same game are refused).
12. Checks an account made with a real email address **cannot** become a member.

**Expected output:** a list of `ok` lines, ending with

```
38 checks passed
```

Its job is to prove the **wiring**, not the rules — the rules are proven by the 214
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
- `games` — one row per badminton game. Scores, format, status, an optional photo, and
  two timestamps: `played_at` (what the replay orders by) and `created_at` (what the
  24-hour confirmation clock runs from).
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

**The private ones:**

- `push_subscriptions` — one row per phone that turned notifications on. Only its owner
  can read it.
- `notification_preferences` — each member's four switches.

Photos live under **Storage → game-photos**, one folder per member.

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

---

## Part 9 — Run the app

```powershell
npm run web
```

The bundler starts and opens <http://localhost:8081> in your browser. Save a file and
the page reloads.

**What you will see:** the sign-in screen. The app is dark-only by design. Shrink the
browser window to phone width; that is the size it is built for.

### 9.1 Walk the whole loop yourself

This is the real test, and it takes about three minutes. You need **two** accounts at
minimum, four to see a rating actually move.

1. **Sign up.** Tap *Join the club*. A username and a password are all it asks for.
   Then pick a display name, which list you appear on, and your level (Newbie, Y, TB,
   TB+, Khá). The level only sets your *starting* point; a few games overrule it.
2. **You land on the Ladder tab.** Every route from the home-screen icon lands there.
3. **Make more players.** Sign out from Settings and repeat, or run `npm run smoke` to
   have four members created for you.
4. **Log tab.** You hold the first slot automatically — the server only accepts a game
   you played in. Pick a partner and two opponents, choose *to 21*, type a score.
   - Type `21` and `25` and watch it refuse. That is `src/domain/validation` running in
     the browser, the same function the 79 validation tests exercise.
   - Enter a legal score and each player's stake appears: what they stand to gain or
     lose. It is an estimate on purpose: the real number is computed on the server once
     all four agree.
   - *Add a photo* is optional. The photo is shrunk in the browser before it uploads.
   - In the player picker, *Invite someone new* shares (or copies) the sign-up link.
5. **Submit.** The other three now have 24 hours. Your lineup stays put so the next
   game is just a score.
6. **Sign in as one of the others.** A banner says you owe an answer. Confirm it. Then
   the last one.
7. **The moment the fourth person confirms**, the server replays the entire game
   history and the Ladder tab changes.
8. **The Feed tab** shows the game with the rating change against each name. **Me**
   shows your record, your rating graph, your partner breakdown and your
   performance-vs-expectation.

If that loop works, the application works.

**To try the admin screens**, make yourself an admin in Studio's SQL Editor:

```sql
update public.profiles set is_admin = true where username = '<your username>';
```

Reload the page. Settings now has a link to **club admin**: flagged games (disputed, or
accepted by the clock with nobody but the logger vouching for them) and every member.
Open a game as an admin to correct its score, resolve a dispute, or remove it. Open a
member to change their seed tier, make them an admin, set a temporary password, or
merge a duplicate account into the one they keep.

Press `Ctrl+C` to stop the bundler.

### 9.2 On your iPhone, while developing

1. Use your PC's LAN address in `.env` (the note at the end of Part 5), then restart
   `npm run web`.
2. On the iPhone, open Safari and go to `http://<your PC's LAN address>:8081`.
3. Windows Firewall may ask to let Node through on first run. Allow it on private
   networks.

Everything works this way **except notifications**: browsers only allow them on
`https://` sites (and `localhost`), and your PC serves plain `http://`. Try notifications
on the live site (Part 13) instead.

### 9.3 Check the real build before you push

`npm run web` is the development server. What GitHub Pages serves is a different thing,
a static export:

```powershell
npm run export:web
```

That writes `dist/`, including a copy of `index.html` named `404.html`. **Why the copy:**
GitHub Pages has no way to send every address to the app, so a link like
`/BadmiGo/game/abc` would be a 404. Pages serves `404.html` for any missing file, and
since that is the app, the app opens and shows the game.

The export expects to live at `/BadmiGo/`, not at the root, so opening
`dist/index.html` straight from disk shows a blank page. That is expected.

---

## Part 10 — Everyday commands

Pin this section.

```powershell
# ----- no Docker needed -----
npm test                  # the 211 domain tests. Run constantly.
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
npm run web               # development server at http://localhost:8081
npm run export:web        # the static site GitHub Pages serves, into dist/
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
   after the existing ones. **Never edit a migration that has already run on
   production** — it will not re-run.
2. `npx supabase db reset` — wipe and re-apply everything, including yours.
3. `npm run types:db` — regenerate the types.
4. `npm run smoke` — confirm nothing broke.
5. When it is live: `npx supabase db push` (Part 12).

**Changing a screen:** `npm run web`, save a file, it reloads. When you are happy,
commit and push to `main`; GitHub builds and publishes it (Part 11).

**Changing an Edge Function:** the local stack picks up a saved file on the next
request. When it is live: `npx supabase functions deploy` (Part 12).

---

## Part 11 — Put the app on GitHub Pages

The repository is `pvqh/BadmiGo` and it is **public**, which is what a free GitHub
account needs for Pages. That is fine: the repository holds no secrets. The files that
do (`.env`, `supabase/functions/.env`) are ignored by git. **Never commit them**, and
never commit the service role key anywhere.

`.github/workflows/pages.yml` does the work. On every push to `main` it installs the
dependencies, runs the typecheck and the tests (so a broken rule never reaches the
club), runs `npm run export:web`, and publishes `dist/`.

### 11.1 Once: switch Pages on

1. On GitHub, open the repository → **Settings → Pages**.
2. Under **Build and deployment → Source**, choose **GitHub Actions**.

### 11.2 Once: give the build the three public values

The build bakes the backend's address into the app, so GitHub needs the **live**
values (from Part 12, not your local ones).

**Settings → Secrets and variables → Actions → Variables tab → New repository variable**,
three times:

| Name | Value |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | `https://<your-project-ref>.supabase.co` |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | the hosted project's anon key |
| `EXPO_PUBLIC_VAPID_PUBLIC_KEY` | the public half of your live VAPID pair |

These are **Variables**, not Secrets, on purpose: their values end up in the published
JavaScript anyway, and calling them secret would only be misleading.

### 11.3 Every time: push

```powershell
git push
```

Watch it under the repository's **Actions** tab. When it is green, the app is at
**<https://pvqh.github.io/BadmiGo/>**. You can also re-run it by hand from the Actions
tab (*Run workflow*) — for example after changing a variable.

> **If you rename the repository**, the address changes with it, and three places
> carry the old name: `experiments.baseUrl` in `app.json`, the `/BadmiGo/` paths in
> `public/index.html`, and `site_url` in `supabase/config.toml`. Change all three
> together.

---

## Part 12 — Put the backend live

Everything above was local. `docs/BACKEND.md` has the full detail; this is the shape of
it.

### 12.1 Create the hosted project and push the schema

Make a free project at <https://supabase.com>, then:

```powershell
npx supabase link --project-ref <your-project-ref>
npx supabase db push             # apply the migrations to the hosted database
npx supabase functions deploy    # deploy all six Edge Functions
npx supabase config push         # push the auth settings, including the site URL
```

Then give the functions their keys. Make a **fresh** VAPID pair (Part 4.1's command)
for the live site, put it in a file outside the repository such as
`C:\Users\Admin\vapid-live.env`, and run:

```powershell
npx supabase secrets set --env-file C:\Users\Admin\vapid-live.env
```

The public half goes into the GitHub variable `EXPO_PUBLIC_VAPID_PUBLIC_KEY` (Part
11.2), and the hosted URL and anon key into the other two.

### 12.2 Make yourself the first admin

Sign up in the live app, then in the hosted project's **SQL Editor**:

```sql
update public.profiles set is_admin = true where username = '<your username>';
```

Every admin after that is appointed in the app: *club admin → a member → Admin*. Appoint
a second one early (story 72), so corrections do not wait when you are away.

### 12.3 Schedule the hourly sweep and the Sunday recap — do not skip this

`auto-accept` and `weekly-recap` work perfectly and **nothing calls them.** Without a
scheduler, a game nobody answers stays pending forever (story 26) and nobody gets a
recap (story 62). They need the project ref and the service role key, so they cannot
live in a migration.

Run the SQL under **"Going live → 3. The schedules"** in `docs/BACKEND.md`, **once**, in
the SQL Editor of your hosted project. The recap is set for Sunday 13:00 UTC, which is
20:00 in Vietnam.

Check they are firing:

```sql
select * from cron.job_run_details order by start_time desc limit 5;
```

### 12.4 The bill

There is none. GitHub Pages and Supabase's free tier cover a club of thirty. Two things
to know:

- Supabase free projects pause after about a week of inactivity. Twice-weekly use
  comfortably prevents it.
- Storage (game photos) has a 1 GB free limit. Photos are shrunk to well under 512 KB
  each, so that is thousands of photos.

---

## Part 13 — Bring the club in

Send everyone **<https://pvqh.github.io/BadmiGo/>**. Each player, on their iPhone:

1. Opens the link **in Safari**. (Not inside Zalo's or Messenger's own browser: tap
   the menu there and choose *Open in Safari*. Only Safari can add it to the home
   screen.)
2. Taps the **Share** button, then **Add to Home Screen**, then **Add**. The sign-in
   screen shows these steps too, whenever the app is open in a Safari tab.
3. Opens the ladder **from the new icon** and signs up.
4. In **Settings**, turns on **notifications on this phone** and allows them.

Step 4 only works from the home-screen icon, and needs **iOS 16.4 or later**. A player
who skips it still sees a banner for games waiting on them, and the 24-hour
auto-accept keeps the ladder moving either way. A player who owes several answers
after a session can clear them with **Confirm all** at the top of the Feed.

**Test notifications yourself first**: turn them on, have someone log a game with you
in it, and check the notification arrives and opens that game. This is the one part
that cannot be checked on a PC.

**A forgotten password:** they ask an admin. The admin opens *club admin → the member
→ Temporary password*, sets one, tells them in person, and they change it in Settings.

---

## Part 14 — When something breaks

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

Exactly what it says. Go back to Part 5. If `.env` exists and looks right, **restart
`npm run web`** — those values are read at bundle time, not at runtime, so an
already-running bundler will not see your edit. On the live site, the same message
means a GitHub variable is missing (Part 11.2).

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

### A query compiles but returns a 400 at runtime

Almost always a stale or hand-edited `database.types.ts`. Run `npm run types:db` and
look at the diff. If the diff is large, your types were badly out of date and that is
the real bug.

### The live site is a blank page

Open it on your PC and press `F12` → Console. A red `404` for a `.js` file under
`/_expo/` means the base path is wrong: the repository was renamed, or `app.json` was
changed. See the box at the end of Part 11.

### A link to a game opens "Page not found" on the live site

`dist/404.html` is missing. The workflow makes it with `npm run export:web`; if you
changed that script, put the copy back.

### Settings says "This browser cannot receive notifications"

On an iPhone: the app is open in a Safari tab, not from the home-screen icon, or iOS is
older than 16.4. On a PC: the page is on plain `http://` other than `localhost`, or
`EXPO_PUBLIC_VAPID_PUBLIC_KEY` is empty in the build.

### Notifications are on but never arrive

Look at the function logs in the Supabase dashboard (**Edge Functions → notify-players
→ Logs**). `push failed` with a reason is the push service refusing; a missing
`VAPID_...` message means `supabase secrets set` was skipped (Part 12.1). If the keys
were ever changed, every phone has to switch notifications off and on again.

### The app on my phone cannot reach the backend

`127.0.0.1` means "this device", and your phone is not your PC. Use your PC's LAN IP —
see the note at the end of Part 5. Both devices on the same Wi-Fi. Windows Firewall may
also need to allow Node and Docker through.

### Tests pass but the app behaves differently

Expected, and informative: the tests cover `src/domain`, which is pure logic. A
difference means the bug is in `src/data`, a screen, or the database — not in the rules.
That narrowing is the entire reason the project is laid out this way.

---

## Part 15 — What comes next

Everything in the spec is built. What is left is finding out whether it works for the
club:

1. **Do Parts 11–13**, then put it in front of two or three players before the whole
   club. What you do not know yet is whether logging a game between games is actually
   fast enough courtside. That answer should shape anything that comes next.
2. **Check notifications on a real iPhone** (Part 13) before you rely on them.
3. **Watch `cron.job_run_details`** for the first weekend, to see the sweep and the recap
   ran.

Things to know rather than fix:

- **Two replays finishing in the wrong order.** The advisory lock in `apply_replay`
  stops two replays from colliding, but if an older replay is slow enough to finish
  after a newer one, the ladder can be one game behind until the next confirmation
  replays again. At this club's volume that is rare and fixes itself.
- **A newly appointed admin** sees the admin screens after reopening the app, because
  the app reads a member's profile once per session.

Still firmly out of scope, however tempting: pairing and court-rotation suggestions.
It is the likely v2 and the ratings this app produces are exactly its input — but the
logging loop has to be proven first.

---

## Part 16 — The rules you must not break

These are from `CLAUDE.md`. They are not style preferences; breaking one is a bug.

1. **Never write a rating as an authoritative value.** Every rating is the output of a
   full replay. Any code path that changes a rating without a replay is wrong, however
   small it looks. Admin corrections change the *game*, then replay.
2. **`src/domain/**` imports nothing** from React, React Native, Expo, Supabase, or any
   I/O library, and never reads the clock. It is plain functions over plain data. It is
   the only test seam in the project. Keep it that way.
3. **Rating maths runs server-side only.** The client may *preview* a prospective
   change; it never computes an authoritative one. A patched page must not be able to
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
