# Review log

Findings from code reviews, to work through. Tick an item when it is fixed; delete
the section once every item in it is done.

## 2026-11-25 — Whole-repository review after the CORS outage

**Scope:** every tracked file: the app, the data layer, the Edge Functions, the
migrations, the build and deploy setup, the docs and the assets.

**What was checked and passed:**
- `npm run typecheck` is clean and `npm test` passes, 218 of 218.
- The deployed production bundle points at the production Supabase project and has
  no localhost address.
- The bundle uses the `/BadmiGo` base path, and `sw.js`, `manifest.json` and the
  deep-link fallback are all served.
- The browser's CORS check now passes on `confirm-game`, `admin` and `notify-players`.

**Not verified here:**
- Whether the cron jobs exist in production.
- Whether replays run in production.
- Anything that needs a signed-in session or the SQL editor.

These are listed below so they get checked by hand.

### Status after the 2026-11-25 fix round

Sections A (bugs a member can hit) and D (smaller things) are fixed and removed. What
is left needs production access or a decision about the docs. `npm run smoke` now also
checks the CORS preflight, refusal sentences, filter quoting, feed paging and a phone
changing hands (`scripts/smoke-browser.ts`).

### B. Build, deploy and production setup

- [x] **B1. Put the Edge Functions in CI and deploy them from CI.** Done; the deploy
  job stays skipped until `SUPABASE_PROJECT_REF` and `SUPABASE_ACCESS_TOKEN` are set
  (manual Part 11.4).
  - **What happens:** [.github/workflows/pages.yml](../.github/workflows/pages.yml)
    type-checks, tests and deploys the app only. The functions get no check and no
    deploy.
  - **Fix:**
    - Add a job that runs `deno check` over `supabase/functions/*/index.ts`. Deno is a
      single `denoland/setup-deno` step.
    - Add a deploy job, gated on that check, that runs
      `supabase functions deploy --import-map supabase/functions/deno.json`. It needs a
      `SUPABASE_ACCESS_TOKEN` secret and the project ref as a variable.

    App and functions then ship together from one push and cannot drift apart. This
    also retires the hand-typed deploy commands in B2.

- [x] **B2. The deploy command is written out in three places, and two were wrong.**
  - **What happens:**
    - [docs/BACKEND.md:160](BACKEND.md#L160) and [manual.md:664](../manual.md#L664)
      still say plain `npx supabase functions deploy`. That fails with "Failed to bundle
      the function" whenever Docker is not running, because the shared import map is
      not sent.
    - CLI v3 also ignores the old `supabase link` state, so `--remote=<ref>` is needed.
    - [manual.md:730](../manual.md#L730) was fixed today.
  - **Fix:** keep the command in one place, ideally an npm script such as
    `"deploy:functions"`, and point the docs at it. That becomes moot once B1 lands.

- [x] **B3. `deno check` fails today.** [push.ts:69](../supabase/functions/_shared/push.ts#L69):
  `error` is still `unknown` after `instanceof webpush.WebPushError`, because the npm
  package ships no types. Read `statusCode` through a small type guard instead. It does
  not block deploys now, but B1's check will fail until it is fixed.

- [x] **B4. The app and the functions run two different supabase-js versions.** The app
  uses `^2.118.0` ([package.json](../package.json)) and the functions use `^2.58.0`
  ([supabase/functions/deno.json](../supabase/functions/deno.json)). Pin both to the
  same range; A3 needs the newer one.

- [ ] **B5. Check by hand that the schedules exist in production.**
  - **What breaks without them:** story 26 (games nobody answers are accepted after 24
    hours) and story 62 (the weekly recap) need the cron SQL in
    [docs/BACKEND.md "Going live" step 3](BACKEND.md). Nothing in the repository applies
    it, and nothing alerts when it is missing.
  - **Missing step:** that SQL assumes the `pg_cron` and `pg_net` extensions are
    enabled. Turn them on first under Database → Extensions; the docs never say so.
  - **Done:** the extension step and these checks are now in `docs/BACKEND.md`. The check
    itself still has to be run by hand.
  - **How to check:**
    - `select jobname, schedule from cron.job;`
    - `select * from cron.job_run_details order by start_time desc limit 5;`
    - and that no game in production has been `pending` for more than a day.

- [ ] **B6. Check by hand that replays run in production.**
  - **Why:** `confirm-game`, `admin` and `auto-accept` call `replay-ratings` through the
    gateway with `SUPABASE_SERVICE_ROLE_KEY`. That works only while the project still
    has legacy JWT keys turned on.
  - **How to check:** read `rating_replay_state.last_replay_at` after confirming a game.
  - **Note for later:** if Supabase's legacy API keys are ever turned off, every
    function-to-function call and both cron jobs stop together.

- [x] **B7. The free tier pauses after a week of inactivity.** A holiday break (Tết)
  pauses the project, and the app then fails for everyone until it is restored by hand
  in the dashboard. Worth a line in the manual's troubleshooting section.

- [x] **B8. A local-dev address is pushed to production auth.**
  `additional_redirect_urls = ["http://localhost:8081"]` in
  [supabase/config.toml:164](../supabase/config.toml#L164) is sent to production by
  `config push`. It is unused, since no sign-in ever uses a redirect, so delete it.

### C. Files that do not belong in the repository

- [x] **C1. `.claude/worktrees/docs-architecture-manual` is a committed git submodule
  pointer.** It is mode `160000` with no `.gitmodules`, a leftover worktree that was
  committed. It is also the only reason [tsconfig.json](../tsconfig.json) and
  [vitest.config.ts](../vitest.config.ts) carry `.claude` exclusions.
  - **Fix:** `git rm --cached` the pointer, add `.claude/worktrees/` to `.gitignore`,
    then drop the exclusions and vitest's explanatory comment.

- [x] **C2. The same AI skill is committed twice.** `.agents/skills/frontend-design/`
  and `.claude/skills/frontend-design/` hold identical files, plus `skills-lock.json`.
  This is editor tooling, not the app. Ignore both.

- [x] **C3. Mockup photos are committed.** `UI_v1/` holds 8 screenshots from the
  redesign. Delete them, or move them out of the repository.

- [x] **C4. Unused images.** The app never references these, and `public/logo.jpg` is
  published to the live site for no reason:
  - [assets/icon.png](../assets/icon.png) and [assets/splash-icon.png](../assets/splash-icon.png),
    Expo template leftovers
  - [public/logo.jpg](../public/logo.jpg), a copy of `assets/logo.jpg`

- [x] **C5. `.gitignore` says things that are not true.**
  - It lists `docs/RULES.md`, `docs/BACKEND.md` and `docs/APP.md` as ignored, but all
    three are tracked, so the lines do nothing and mislead.
  - It ignores `docs/REVIEW_LOGS.md`, but this file is `REVIEW-LOG.md`.
  - The native-build block (`/ios`, `/android`, `*.jks`, `*.p8`, `*.mobileprovision`)
    is from the iOS era.

  Decide whether the docs are tracked, and make the file say so.

- [ ] **C6. The same facts live in too many documents.** These overlap:
  - `CLAUDE.md`
  - `docs/SPEC.md`
  - [architecture.md](../architecture.md), 1265 lines, "as of 2026-11-24"
  - [manual.md](../manual.md), 948 lines
  - `docs/APP.md`, `docs/BACKEND.md` and `docs/RULES.md`

  The deploy command lived in three of them and two were wrong (B2). Each fact,
  especially every command, should live in one file that the others link to.
  `architecture.md` is already a day stale (no CORS, no import map).
