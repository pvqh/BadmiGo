# Backend

The database, its row-level security, the authentication routes, and the four Edge
Functions. Read `SPEC.md` first; this says how what it describes is wired.

## The shape of it

```
supabase/migrations/   the schema, in seven files, applied in order
supabase/functions/    four Deno functions, which import the domain core directly
supabase/config.toml   auth providers, Resend SMTP, per-function settings
src/data/              the only module that talks to Supabase
scripts/smoke.ts       the one end-to-end check
```

Two rules shape all of it.

**Games are authoritative; ratings are derived.** `games`, `game_participants` and
`game_confirmations` are written by members. `player_ratings`, `rating_history` and
`rating_replay_state` are produced only by replaying the confirmed-game history
through `src/domain/rating`, and are replaced wholesale on every run. No client has
write permission on them at all.

**The domain decides; the database records.** Every rule that can be wrong lives in
`src/domain/**` and is tested there. The functions read state, call a pure reducer,
and hand the answer to a service-role RPC that writes it in one transaction. There is
no rule in SQL that is also in TypeScript — see the Decision Log for the two places
that was tempting and what was done instead.

## What a phone may write

Nothing, directly, except its own profile fields and its own push token. Everything
else is a function or an RPC:

| Route | Who | What it does |
|---|---|---|
| `create_my_profile` | any signed-in account | turns an account into a club member |
| `username_problem` / `username_available` | anyone | instant signup feedback |
| `log_game` | a club member | a game, four participants, four confirmations, atomically |
| `confirm-game` | a participant | confirm, dispute or cancel, then replay |
| `replay-ratings` | service role | rebuild every rating from history |
| `auto-accept` | service role, hourly | sweep games past twenty-four hours |
| `notify-players` | service role, or a participant | the push for one game |

`games`, `game_participants`, `game_confirmations` and both derived tables are
`select`-only for `authenticated`, and revoked entirely from `anon`.

## Signing in

Three routes in, one path to a profile.

Supabase authenticates by email, and a member who signs up with a username alone has
no email. Rather than look one up — which would expose every member's real address to
anyone who can guess a handle — a username-only account's auth email is **derived**
from the handle: `hung` becomes `hung@users.badminton-ladder.invalid`. The TLD is
reserved by RFC 2606 and can never receive mail, which is the honest signal: these
accounts cannot reset a password by email.

`create_my_profile` reads the handle back out of that address rather than trusting its
argument, so Supabase Auth's unique index on email is what actually reserves a
username and the two can never disagree.

The mapping is written twice, in `public.username_email_domain()` and in
`src/data/auth.ts`. **Change them together or sign-in breaks.**

Signing in with an email or with Google or Apple works normally. No database trigger
creates profiles: all four routes finish by calling `create_my_profile`, so there is
one path to club membership rather than one that works for two of them.

Email confirmations are off. Synthetic addresses cannot receive mail, and signup has
to fit between games.

## Running it locally

Needs Docker running.

```bash
cp supabase/.env.example supabase/.env   # placeholders are fine locally
cp .env.example .env                     # then paste the anon key from the next step
npx supabase start
npx supabase status                      # the anon key and URL for .env
npm run types:db                         # regenerate src/data/database.types.ts
npm run smoke                            # the end-to-end check
```

`npm run types:db` after **every** migration. `src/data/database.types.ts` is
generated, and the Edge Functions import it, so a stale copy is a real bug.

To read a password-reset email locally, set `enabled = false` under
`[auth.email.smtp]` and use Mailpit on <http://127.0.0.1:54324>. Nothing else sends
mail, so the Resend placeholder is otherwise harmless.

### Tests

`npm test` covers the domain core and does not need Docker. `npm run smoke` needs a
running stack and proves the wiring: row-level security, the grants, the atomic
writes, and that a Deno function can reach the domain core at all.

## Going live

Three things the repository cannot hold.

**1. The project, and its secrets.**

```bash
npx supabase link --project-ref <ref>
npx supabase db push
npx supabase functions deploy
npx supabase config push          # reads supabase/.env for the values below
```

`supabase/.env` must hold a real `RESEND_SMTP_PASSWORD` (a Resend API key),
`AUTH_SENDER_EMAIL` on a domain verified with Resend, and the Google and Apple client
IDs. Resend is wired in from day one deliberately: Supabase's own mailer is
rate-limited to a trickle, and a password reset that silently never arrives is how a
community quietly stops using an app.

**2. Apple and Google.** Both ship together — App Store guideline 4.8 requires an
equivalent privacy-respecting login wherever a third-party one is offered. The app
scheme is `badmintonladder`, already in `app.json` and in `additional_redirect_urls`.
`client_id` for Google takes every client that may present an identity token, iOS and
web, comma-separated. Apple's takes the bundle identifier,
`com.pvqh.badmintonladder`.

**3. The hourly sweep.** `auto-accept` has no scheduler of its own, and story 26 does
not work without one. It needs the project ref and the service role key, so it cannot
be a migration. Run this once against the production database:

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

Check it with `select * from cron.job_run_details order by start_time desc limit 5;`.

## Not built yet

Deliberately, so that what is here is finished rather than broadly sketched:

- **Admin tooling.** Correcting a score, voiding a game, adjusting a seed tier and
  merging duplicates (stories 65–72) all end in a replay, and story 67 says that must
  happen automatically. The pieces are in place — the lifecycle reducer has `void`
  and `resolve`, `persist_game_state` and `replay-ratings` exist, and `is_admin()`
  guards the privileged columns — but the functions that drive them are not written.
  Until they are, **an admin edit to `seed_tier` leaves ratings stale** until a replay
  runs; `rating_replay_state` is how you tell.
- **The weekly recap and the overtaken-on-ladder alert** (stories 62, 63). Their
  preferences exist and default correctly; nothing sends them.
- **The widget payload.** Written to the App Group by the host app, not by the server.
- **Photo storage.** `games.photo_path` is a column; no bucket or policy exists yet.
