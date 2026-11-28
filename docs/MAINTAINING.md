# Maintaining the app

How to change, test, deploy and look after the ladder once it is live. For how the
pieces work, see [BACKEND.md](BACKEND.md) and [APP.md](APP.md); for what the app is
allowed to do, see [SPEC.md](SPEC.md) and the Decision Log in
[CLAUDE.md](../CLAUDE.md).

## Where each part goes live

| Part | Lives in | Goes live when |
|---|---|---|
| Screens, text, colours, client logic | `app/`, `src/ui/`, `src/data/`, `public/` | You push to `main`. GitHub Actions builds and publishes it. |
| Database tables, rules, RPCs | `supabase/migrations/` | You run `npx supabase db push`. |
| Server functions (confirm, admin, replay, push) | `supabase/functions/` | You run `npx supabase functions deploy`. |
| Rating and game rules | `src/domain/` | **Both** a push to `main` **and** `functions deploy`, because the Edge Functions import the domain core directly. |
| Server secrets (VAPID keys) | `supabase/functions/.env` (not committed) | You run `npx supabase secrets set`. |

The most common mistake is to change `src/domain/` and push without running
`functions deploy`. The app then shows one rule and the server enforces the old one.

## One-time setup on a new computer

1. Install Node 22, Git and Docker Desktop.
2. Clone the repository and install:
   ```bash
   git clone <repository url>
   cd BadmiGo
   npm install
   ```
3. Create the two local env files from their examples:
   ```bash
   cp .env.example .env
   cp supabase/functions/.env.example supabase/functions/.env
   ```
   Put the **production** VAPID keys into `supabase/functions/.env`. Keep a copy
   somewhere safe outside the repository (a password manager), because losing them
   means every member has to turn notifications on again.
4. Start the local stack and copy the URL and anon key it prints into `.env`:
   ```bash
   npx supabase start
   npx supabase status
   ```
5. Link the CLI to the production project (the ref is in the Supabase dashboard URL):
   ```bash
   npx supabase login
   npx supabase link --project-ref <ref>
   ```

## 1. A change to the screens only

Use this when you change only files under `app/`, `src/ui/` or `public/`.

1. Get up to date:
   ```bash
   git pull
   npm install
   ```
2. Make the change.
3. Look at it:
   ```bash
   npm run web             # http://localhost:8081
   ```
   Open it at a phone width (browser dev tools → device toolbar → iPhone), and check
   both themes (Cài đặt → Sáng / Tối).
4. Run the checks that the deploy also runs:
   ```bash
   npm run typecheck
   npm test
   ```
5. Optional but worth it before a weekend: build exactly what GitHub Pages serves:
   ```bash
   npm run export:web
   ```
   It must finish without errors. `dist/` expects to be served under `/BadmiGo/`,
   so opening `dist/index.html` straight from disk will not work.
6. Commit and push:
   ```bash
   git add -A
   git commit -m "What changed, in one line"
   git push
   ```
7. Watch **GitHub → Actions → Deploy to GitHub Pages**. Green means live within a
   minute or two. Red means nothing was published and the old version is still
   running; open the failed step to see why.
8. On your phone, close the home-screen app fully and open it again. The service
   worker caches nothing, so every member gets the new version on their next launch.

## 2. A change to the rules (`src/domain/`)

The domain core is the only unit-tested code, and it is pure: no React, no Supabase,
no clock. A test (`src/domain/purity.test.ts`) fails if it imports anything else.

1. Write or change the test first, in the matching `*.test.ts`, and watch it fail:
   ```bash
   npm run test:watch
   ```
2. Change the code until it passes.
3. Inside `src/domain`, relative imports keep their `.ts` extension
   (`import { x } from './rating.ts'`), or the Edge Functions cannot load the file.
4. Follow section 3 below to check it against the local backend, then deploy
   **both** halves:
   ```bash
   npx supabase functions deploy
   git push
   ```

## 3. A change to the backend

Use this for anything in `supabase/migrations/` or `supabase/functions/`. Docker must
be running.

1. Start the local stack:
   ```bash
   npx supabase start
   ```
2. **Database change:** create a new migration. Never edit one that already exists,
   because production has already run it and will not run it again.
   ```bash
   npx supabase migration new describe_the_change
   ```
   Write the SQL in the new file under `supabase/migrations/`. Put only structural
   rules in SQL. Badminton score rules stay in `src/domain/validation`.
3. Rebuild the local database from every migration, then regenerate the types:
   ```bash
   npx supabase db reset
   npm run types:db
   ```
   `npm run types:db` is required after **every** migration. The app and the
   functions both import `src/data/database.types.ts`, so a stale copy is a real bug.
   `db reset` wipes local data, which is fine because local data is only for testing.
4. **Function change:** edit the function under `supabase/functions/<name>/`. Shared
   code goes in `supabase/functions/_shared/`. If you added a new file that a
   function imports, restart the stack (the data is kept):
   ```bash
   npx supabase stop
   npx supabase start
   ```
5. Run the end-to-end check against the local stack:
   ```bash
   npm run smoke
   npm run typecheck
   npm test
   ```
6. Try it in the app: `npm run web` with `.env` pointing at the local stack.
7. Deploy in this order, so the website never asks for something production does
   not have yet:
   ```bash
   npx supabase db push              # 1. database
   npx supabase functions deploy     # 2. server functions
   git add -A
   git commit -m "What changed"
   git push                          # 3. website
   ```
   `db push` lists the migrations it is about to apply. Read the list before you
   confirm.

## 4. A change to a rating parameter

Placement count, seed values, decay, `SIGMA_RECOVERY_DAYS`, the display scale and
the tier bands all live in `src/domain/rating-scale.ts`. Hard rule 5 in `CLAUDE.md`
says none of them changes without a simulation run.

1. Run the simulation **before** the change and note the numbers:
   ```bash
   npm run simulate
   ```
   The numbers to note are ranking recovery (Spearman), within-one-tier and
   exact-tier labelling, and players clipped to zero.
2. Change the value and run it again.
3. Add one line to the Decision Log in `CLAUDE.md` with the old value, the new value
   and the before and after numbers. Earlier entries show the format.
4. Deploy as in section 2 (`functions deploy`, then `git push`).
5. Ratings are always recomputed from the game history, so the new value takes
   effect at the next replay. That happens on the next confirmed game or admin
   action. To replay at once, call the function with the service role key (from
   Supabase dashboard → Project Settings → API):
   ```bash
   curl -X POST "https://<ref>.supabase.co/functions/v1/replay-ratings" \
     -H "Authorization: Bearer <service-role-key>" \
     -H "Content-Type: application/json" -d '{}'
   ```
   Never paste the service role key into a file in the repository.

## 5. A change to the spec

When a change adds or alters what members can do:

1. Update the user story in `docs/SPEC.md`, or add one. Check the Out of Scope list
   first.
2. Add one dated line to the Decision Log in `CLAUDE.md`: what was decided and why.
   The log is append-only, so never rewrite an old entry. Add a new one that
   supersedes it.
3. A new package also needs a line in the Decision Log saying why it was needed.

## 6. Running the club (no code)

All of this is in the app. Member tasks are on the admin screen (Cài đặt → admin).
Game tasks are on the game's own page, where an admin sees an extra panel.

| Task | Where |
|---|---|
| A member forgot their password | Admin screen → the member → set a temporary password, then tell them in person |
| A wrong starting level | Admin screen → the member → seed tier (it replays) |
| Someone signed up twice | Admin screen → the duplicate → merge into the real account. Refused if both accounts played in the same game, so void that game first |
| A new admin | Admin screen → the member → admin switch |
| A wrong score | Open the game → admin panel → correct the score (it replays) |
| A game that should not count | Open the game → admin panel → void, with a reason (it replays) |
| A disputed game | Open the game → admin panel → resolve (it replays) |

Never fix a rating by editing the database. Ratings are derived from games, so fix
the game and the replay fixes the rating.

## 7. Regular checks

**Every month**

1. **Scheduled job.** `weekly-recap` runs on Sundays. (`auto-accept` is gone since
   2026-11-28; if it still shows up here, run `select cron.unschedule('auto-accept');`.)
   In the Supabase SQL editor:
   ```sql
   select jobname, status, start_time
   from cron.job_run_details
   join cron.job using (jobid)
   order by start_time desc
   limit 10;
   ```
   Every status should read `succeeded`. If the job is missing, recreate it with
   the SQL in [BACKEND.md](BACKEND.md) → "Going live" → "The schedule".
2. **Free-tier usage.** Supabase dashboard → Usage: database size, Edge Function
   calls, storage (avatars). The club is far below the limits, so a jump means
   something is wrong.
3. **Backup.** Games and profiles are the only data that cannot be rebuilt, since
   ratings are always derived from them. Keep the files outside the repository:
   ```bash
   npx supabase db dump --linked -f backup-schema-2026-12.sql
   npx supabase db dump --linked --data-only -f backup-data-2026-12.sql
   ```
   These files hold every member's data, so never commit them.

**Every few months**

1. **Update packages.** Do it on a weekday, never just before a session.
   ```bash
   git pull
   npx expo install --fix     # moves Expo packages to versions that fit together
   npm outdated               # look; don't blindly upgrade everything
   npm run typecheck
   npm test
   npm run export:web
   ```
   Then check the app in a browser and push. Leave a new Expo major version
   (59, 60 …) alone unless something needs it, and read its upgrade notes first.
   The `react-dom` override in `package.json` must stay equal to the `react`
   version.
2. **Supabase CLI.** `npm install -D supabase@latest`, then repeat the smoke run.

## 8. When something breaks

| Symptom | Likely cause | Fix |
|---|---|---|
| The Actions run is red at `typecheck` or `test` | A real error in the code | Run the same command locally and fix it. The old version stays live meanwhile. |
| The site loads blank, or "throws on launch" | A missing repository variable | GitHub → Settings → Secrets and variables → Actions → Variables: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_VAPID_PUBLIC_KEY` |
| Links inside the app give a 404 | The repository was renamed | Change `experiments.baseUrl` in `app.json` and the `/BadmiGo/` paths in `public/index.html` together |
| A function error such as "column does not exist" | A migration was not pushed, or the types are stale | `npx supabase db push`, `npm run types:db`, `npx supabase functions deploy` |
| The app and the server disagree on a rule | `src/domain` changed without a function deploy | `npx supabase functions deploy` |
| No Sunday recap | The cron job stopped | See section 7, "Scheduled job" |
| A game stays pending | Someone has not answered; nothing settles it by the clock | The logger cancels it, or an admin voids it |
| The ladder did not move after a game was confirmed | The replay failed | `select last_replay_at from rating_replay_state;`, then the `confirm-game` or `admin` logs |
| Nobody gets notifications | The VAPID keys changed or the server secrets were lost | `npx supabase secrets set --env-file supabase/functions/.env` with the **original** keys |
| One member gets no notifications | Not installed to the home screen, iOS below 16.4, or the switch is off | Cài đặt shows the reason on their phone |
| A local function "fails to boot" | A new imported file the runtime has not mounted | `npx supabase stop`, then `npx supabase start` |
| Ratings look wrong after a fix | The replay has not run yet | Trigger it as in section 4, step 5 |

To undo a bad deploy of the website, revert the commit and push. GitHub Pages then
publishes the previous version:

```bash
git revert <commit>
git push
```

A migration cannot be reverted that way. Write a new migration that undoes it.

## Never do these

- Change the VAPID key pair. It turns notifications off on every phone.
- Edit or delete a migration that production has already run.
- Write a rating straight into the database.
- Put the service role key, the VAPID private key or a backup file in the
  repository, or in a GitHub variable. The three `EXPO_PUBLIC_` values are the only
  ones that belong in the build, and they are public by design.
- Rename the repository without also changing the base URL (see section 8).
- Change a rating parameter without a simulation run (section 4).
