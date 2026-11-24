# Backend

The database, its row-level security, sign-in, photo storage, and the six Edge
Functions. Read `SPEC.md` first; this says how what it describes is wired.

## The shape of it

```
supabase/migrations/   the schema, applied in filename order
supabase/functions/    six Deno functions, which import the domain core directly
supabase/functions/_shared/   the service client, the lifecycle writer, the push sender
supabase/config.toml   auth settings and per-function settings
src/data/              the only module that talks to Supabase
scripts/smoke.ts       the one end-to-end check (plumbing in smoke-client.ts)
```

Two rules shape all of it.

**Games are authoritative; ratings are derived.** `games`, `game_participants` and
`game_confirmations` are written by members. `player_ratings`, `rating_history` and
`rating_replay_state` are produced only by replaying the confirmed-game history
through `src/domain/rating`, and are replaced wholesale on every run. No client has
write permission on them at all. Admin corrections change the record and replay;
they never touch a rating.

**The domain decides; the database records.** Every rule that can be wrong lives in
`src/domain/**` and is tested there. The functions read state, call a pure function,
and hand the answer to a service-role RPC or write. There is no rule in SQL that is
also in TypeScript — see the Decision Log for the places that was tempting and what
was done instead.

## What a browser may write

Nothing, directly, except its own profile fields, its own push subscriptions, and a
photo in its own storage folder. An admin may also set `is_admin` on anyone.
Everything else is a function or an RPC:

| Route | Who | What it does |
|---|---|---|
| `create_my_profile` | a signed-in username account | turns an account into a club member |
| `username_problem` / `username_available` | anyone | instant signup feedback |
| `log_game` | a club member | a game, four participants, four confirmations, atomically |
| `confirm-game` | a participant | confirm, dispute or cancel, then replay |
| `admin` | an admin | correct, void, resolve, seed tier, merge, temporary password |
| `replay-ratings` | service role | rebuild every rating from history; send "passed you" pushes |
| `auto-accept` | service role, hourly | sweep games past twenty-four hours |
| `weekly-recap` | service role, Sunday evening | each player's week, as a push |
| `notify-players` | service role, or a participant | the push for one game |
| `merge_profiles` | service role (via `admin`) | move a duplicate's games to the kept account |

`games`, `game_participants`, `game_confirmations` and both derived tables are
`select`-only for `authenticated`, and revoked entirely from `anon`.

## Signing in

Username and password, and nothing else.

Supabase authenticates by email, so every account's auth email is **derived** from
its handle: `hung` becomes `hung@users.badminton-ladder.invalid`. The TLD is reserved
by RFC 2606 and can never receive mail. Nothing sends mail at all: there is no SMTP
provider configured.

`create_my_profile` reads the handle back out of that address rather than taking it
as an argument, so Supabase Auth's unique index on email is what actually reserves a
username, and it refuses any account whose address is not on that domain. Supabase
Auth will create an account for a real address if someone calls it directly; that
account simply can never become a member.

The mapping is written twice, in `public.username_email_domain()` and in
`src/data/auth.ts`. **Change them together or sign-in breaks.**

No database trigger creates profiles. Signing up makes the account; the
create-profile screen then calls `create_my_profile`, so an account whose profile step
failed can finish later.

**A forgotten password** is reset by an admin: the `admin` function's
`reset-password` action sets a temporary one through the auth admin API, and the
member changes it in Settings. The function never returns or logs it.

## Admin

`admin` checks the caller's `is_admin` with the service role before doing anything,
then:

- `correct-score` — validated by `src/domain/validation` against the game's format.
  A voided game is not corrected.
- `void` and `resolve` — the lifecycle reducer's own events, written through
  `persist_game_state` like every other status change.
- `set-seed-tier` — the starting point of a rating, so it changes every rating since.
- `merge` — `merge_profiles` moves participant rows, answers and logged games to the
  kept account (refusing if both played in the same game) and deletes the duplicate's
  auth account, whose cascade takes the profile, all in one transaction.
- `reset-password` — see above.

Every action except the password reset ends in a replay (story 67).

The first admin has to be made by hand; see "Going live".

## Notifications

Web Push. A browser subscription is an endpoint plus two keys, stored in
`push_subscriptions` and readable only by its owner. `_shared/push.ts` is the one
sender: it checks each recipient's switch in `notification_preferences`, signs and
encrypts with the `web-push` package, and deletes subscriptions the push service
reports as gone (404 or 410).

| Kind | Sent by | Switch |
|---|---|---|
| Confirm a game | `notify-players`, asked for by the logger's browser | `confirmation_requests` |
| A game was disputed | `notify-players`, from `confirm-game` | `dispute_alerts` |
| You were passed | `replay-ratings`, from `src/domain/overtaken` | `overtaken_on_ladder` (off by default) |
| Your week | `weekly-recap`, from `src/domain/recap` | `weekly_recap` |

A failed push never fails the thing that caused it: a replay that rebuilt the ladder
reports success even if the "passed you" push did not go.

The keys: `VAPID_SUBJECT`, `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` in the
functions' environment, and the public key again in the app's `.env` as
`EXPO_PUBLIC_VAPID_PUBLIC_KEY`. Changing the pair later silently turns notifications
off on every phone until each member switches them on again.

## Photos

A private `game-photos` bucket, JPEG only, 512 KB per file. Club members can read
every photo; a member can upload only into a folder named after their own id, and a
`games` insert trigger insists `photo_path` sits in the logger's folder (insert only,
so a merge can move a game without moving its photo). The app shrinks a
photo to a 1280 px long edge before uploading and shows it through a signed link that
lasts an hour. Storage is the one thing here that could cost money; the free tier is
1 GB.

## Running it locally

Needs Docker running.

```bash
cp .env.example .env                                     # then fill in from the next steps
cp supabase/functions/.env.example supabase/functions/.env   # VAPID keys, see the manual
npx supabase start
npx supabase status                      # the anon key and URL for .env
npm run types:db                         # regenerate src/data/database.types.ts
npm run smoke                            # the end-to-end check
```

`npm run types:db` after **every** migration. `src/data/database.types.ts` is
generated, and the Edge Functions import it, so a stale copy is a real bug.

### Tests

`npm test` covers the domain core and does not need Docker. `npm run smoke` needs a
running stack and proves the wiring: row-level security, the grants, the atomic
writes, the admin route and its replay, merging, username-only membership, and that
a Deno function can reach the domain core at all.

The local functions runtime mounts only the files that existed when `supabase start`
ran. After adding a file that a function imports, run `npx supabase stop` and
`npx supabase start` again (the database is kept), or the function fails to boot.

## Going live

Three things the repository cannot hold. (`config push` also sets the site URL to
the GitHub Pages address, from `config.toml`.)

**1. The project, and its secrets.**

```bash
npx supabase link --project-ref <ref>
npx supabase db push
npx supabase functions deploy
npx supabase config push
npx supabase secrets set --env-file supabase/functions/.env   # the production VAPID keys
```

**2. The first admin.** In the SQL editor, after you have signed up in the app:

```sql
update public.profiles set is_admin = true where username = '<your username>';
```

Every later admin is appointed from the app.

**3. The schedules.** `auto-accept` (hourly) and `weekly-recap` (Sunday evening) have
no scheduler of their own, and stories 26 and 62 do not work without one. They need
the project ref and the service role key, so they cannot be migrations. Run this once
against the production database:

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

-- 13:00 UTC on Sunday is 20:00 in Vietnam. Change the hour if the club is elsewhere.
select cron.schedule('weekly-recap', '0 13 * * 0', $job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'functions_url')
           || '/weekly-recap',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' ||
        (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')),
    body := '{}'::jsonb
  );
$job$);
```

Check them with `select * from cron.job_run_details order by start_time desc limit 5;`.

The web app itself is deployed by GitHub Actions; see the manual.
