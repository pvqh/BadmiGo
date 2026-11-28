# App

The screens. Read `SPEC.md` first and `BACKEND.md` for what they talk to; this says
how the client is put together and what it deliberately does not do.

It is a web app. Expo renders the React Native screens to the browser through
`react-native-web`, the export is a static site, and GitHub Pages serves it. A player
opens it once in Safari and adds it to the home screen; from then on it opens
full-screen, like an app.

## The shape of it

```
app/                   the routes, one file per screen (expo-router)
public/                copied as-is into the site: index.html template, manifest,
                       icons, and sw.js, the service worker
src/ui/                components, the session, the query layer, the words
src/ui/queries.ts      every query key and mutation in one place
src/data/              the only module that talks to Supabase (and the browser's push API)
src/domain/            pure; the screens read from it and never duplicate it
```

```
app/_layout.tsx          providers and the gate
app/(tabs)/index.tsx     the ladder
app/(tabs)/feed.tsx      the club feed, with the member's unsettled games on top,
                         "Confirm all" when they owe two or more, and a search
                         by player name and day
app/(tabs)/log.tsx       logging a game
app/(tabs)/me.tsx        the member's own profile
app/(tabs)/settings.tsx  avatar, display name, notifications, password, sign-out,
                         and the way into admin
app/game/[id].tsx        one game: answers, confirm, dispute, cancel; admin fixes
app/player/[id].tsx      anyone's profile
app/admin/index.tsx      admin only: flagged games and the member list
app/admin/[id].tsx       admin only: one member's seed tier, admin rights,
                         temporary password and merge
app/sign-in.tsx          and sign-up, create-profile (avatar, and a way back to
                         sign-in for the wrong account)
```

Three rules shape all of it.

**The screens contain no rules.** Score validity comes from
`src/domain/validation`, what a game may do next from `src/domain/game-lifecycle`,
placement and tier bands from `src/domain/rating-scale`, and the stats from
`src/domain/stats`. A screen that needs a rule imports it; it
never restates it.

**No rating is computed here as an authority.** `src/domain/rating-preview` shows a
logger what a game is worth before they submit, and that is all it is for. It is
never persisted, and its test holds it to what the server's replay actually produces
so it cannot quietly disagree. Admin screens never edit a rating either: they edit
the record, and the server replays.

**The gate is a guard, not a redirect.** `app/_layout.tsx` reads one of four session
states and wraps each group in `Stack.Protected`, so there is no frame in which a
signed-out browser has a member's screen mounted and no effect racing the router.
The admin routes sit inside a second guard on `is_admin`; the server refuses
non-admins regardless.

## Running it

```bash
cp .env.example .env     # then paste the URL, the anon key and the VAPID public key
npx supabase start       # needs Docker
npm run web              # opens http://localhost:8081
```

To check the real build, the one GitHub Pages serves:

```bash
npm run export:web       # writes dist/, including 404.html
```

`dist/` expects to live at `/BadmiGo/`, so open it through a server that mounts it
there rather than straight from disk. `npm run typecheck` and `npm test` need
neither Docker nor a browser. The app throws on launch with a clear message if
`.env` is missing, rather than failing with an opaque network error.

## Home screen and notifications

`public/index.html` is the template Expo fills in. It links the manifest
(`display: standalone`, start URL on the ladder) and the Apple touch icon. Their
paths carry `/BadmiGo/` because a deep link such as `/BadmiGo/game/<id>` would
resolve a relative path under `/game/`. **If the repository is renamed, change
`experiments.baseUrl` in `app.json` and these paths together.**

Safari has no install button, so `InstallHint` spells out the steps on the sign-in
screen and in Settings, but only on an iPhone that has the app open in a Safari tab.

Push is Web Push. `src/data/notifications.ts` registers `public/sw.js`, asks for
permission from the tap on the Settings switch (iPhone refuses a prompt nobody
tapped for), and stores the subscription in `push_subscriptions`. Signing out
unsubscribes the phone first, so the next person on it gets nobody else's
notifications. The service worker shows the message and opens the game it is about;
it caches nothing, so the app needs a connection.

On an iPhone, notifications only work once the app is on the home screen, on iOS
16.4 or later. Settings says so when that is the reason. A member who never turns
them on still has the banner on the ladder.

## What the cache does after a replay

An answer that settles a game triggers a replay, and a replay rewrites every rating
in the club. `useAnswerGame` therefore drops the entire query cache when the server
reports it replayed, and only the pending list and that one game otherwise. Every
admin action except a password reset replays too, so `useAdminAction` drops
everything, as does `useConfirmAll`, which confirms each owed game in turn through
the same function. These are the only places in the app where a blunt invalidation is the
correct one.

## Deliberately not here

- **Offline use.** The service worker is for push only.
- **Live updates.** No Realtime subscriptions; screens refresh on pull and after an
  answer (see the Decision Log).
- **A native build.** No App Store, no TestFlight. `app.json` lists only the web
  platform.
