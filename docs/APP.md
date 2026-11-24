# App

The screens. Read `SPEC.md` first and `BACKEND.md` for what they talk to; this says
how the client is put together and what it deliberately does not do yet.

## The shape of it

```
app/                   the routes, one file per screen (expo-router)
src/ui/                components, the session, the query layer, the words
src/ui/queries.ts      every query key and mutation in one place
src/data/              the only module that talks to Supabase
src/domain/            pure; the screens read from it and never duplicate it
```

```
app/_layout.tsx          providers and the gate
app/(tabs)/index.tsx     the ladder
app/(tabs)/feed.tsx      the club feed, with the member's unsettled games on top
app/(tabs)/log.tsx       logging a game
app/(tabs)/me.tsx        the member's own profile
app/game/[id].tsx        one game: answers, confirm, dispute, cancel
app/player/[id].tsx      anyone's profile
app/sign-in.tsx          and sign-up, reset-password, create-profile, settings
```

Three rules shape all of it.

**The screens contain no rules.** Score validity comes from
`src/domain/validation`, the twenty-four-hour window from
`src/domain/game-lifecycle`, placement and tier bands from
`src/domain/rating-scale`, the stats from `src/domain/stats`. A screen that needs a
rule imports it; it never restates it.

**No rating is computed here as an authority.** `src/domain/rating-preview` shows a
logger what a game is worth before they submit, and that is all it is for. It is
never persisted, and its test holds it to what the server's replay actually produces
so it cannot quietly disagree.

**The gate is a guard, not a redirect.** `app/_layout.tsx` reads one of four session
states and wraps each group in `Stack.Protected`, so there is no frame in which a
signed-out phone has a member's screen mounted and no effect racing the router.

## Running it

```bash
cp .env.example .env     # then paste the URL and anon key from `supabase status`
npx supabase start       # needs Docker
npm run ios              # or `npm start` and press i
```

`npm run typecheck` and `npm test` need neither Docker nor a simulator. The app will
throw on launch with a clear message if `.env` is missing, rather than failing on a
phone with an opaque network error.

## What the cache does after a replay

An answer that settles a game triggers a replay, and a replay rewrites every rating
in the club. `useAnswerGame` therefore drops the entire query cache when the server
reports it replayed, and only the pending list and that one game otherwise. This is
the one place in the app where a blunt invalidation is the correct one.

## Not built yet

Deliberately, and each for a reason:

- **Google and Apple sign-in** (stories 3, 4). `signInWithIdToken` is in
  `src/data/auth.ts` and the config is in `supabase/config.toml`, but both need the
  paid Apple Developer membership and real client IDs, which arrive with the widget
  step. They ship together — App Store guideline 4.8 requires it.
- **Push notifications** (stories 22, 25, 61). `notify-players` and `push_tokens`
  exist server-side; nothing registers a device, because APNs needs the same Apple
  membership. The in-app banner is the designed fallback and is built, so the
  confirm loop works without push.
- **The photo memento** (story 21). `games.photo_path` is a column with no bucket or
  policy behind it — see `BACKEND.md`. Half of it would be worse than none.
- **The courtside invite link or QR** (story 11). There is nothing to link to until
  TestFlight exists.
- **Admin screens** (stories 65–72) and the weekly recap and overtaken alerts
  (stories 62, 63). Server-side gaps listed in `BACKEND.md`; the preferences exist
  and the settings screen says plainly that two of the four have no sender yet.
- **The widget** (stories 55–60). Next step, and the first one that costs $99.
