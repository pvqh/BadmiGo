# Spec — Badminton Club LeaderBoard (v1)

Status: agreed 2026-11-03. Source: five-round design interview.
Read alongside `../CLAUDE.md`, which holds the hard rules and glossary.

## Problem Statement

A badminton community of about 30 people plays doubles every Saturday and Sunday,
two hours a session, four to six games each. Skill is spread wide — complete
newbies alongside genuinely strong players.

Nobody knows where they stand. Who is improving, who the strongest players actually
are, and which partnerships work are all a matter of opinion and memory, settled
courtside by whoever argues loudest. Results evaporate the moment a game ends.
There is no shared record, so there is nothing to be proud of, nothing to chase,
and no way to settle an argument.

The organiser wants that record to be ambient rather than something people have to
go looking for — visible on the home screen the way Locket made shared photos
ambient, so the ladder is part of the week rather than a page in yet another app
nobody opens.

## Solution

An iOS app, free, for this one community.

After a game, any participant logs it: four players, two per side, and the score.
The other three get a push notification and confirm with one tap. Once confirmed,
an OpenSkill rating moves for all four — up or down depending on how surprising the
result was — and the game appears in a club-wide feed showing everyone's rating
change.

A single club ladder ranks everyone, filterable to men's and women's lists. Each
player gets a tier label in the club's own vocabulary (Newbie, Y, TB, TB+, Khá),
a rating graph over time, head-to-head records, and a partner breakdown showing who
they win most and least with.

A large home-screen widget shows the top five men, the top five women, and the
viewer's own rank, refreshing shortly after a game they played is confirmed.

Because every game carries all four names publicly and needs their agreement, the
record polices itself without anyone being appointed referee.

## User Stories

### Signing up and getting in

1. As a club player, I want to sign up with a username and password, so that I can join without sharing an email address.
2. As a club player, I want to sign up with my email and a password, so that I can use the method I am used to.
3. As a club player, I want to sign in with Google, so that I can get in with one tap.
4. As an iPhone user, I want to sign in with Apple, so that I can register without handing over personal details.
5. As a player who forgot my password, I want to reset it by email and actually receive that email, so that I can get back in without asking the admin.
6. As a player, I want to change my password from inside the app, so that I can manage my own account.
7. As a new member, I want to declare my current level at signup, so that my rating starts near reality instead of making me grind up from zero.
8. As a new member, I want signup to take under thirty seconds, so that I can register courtside between games.
9. As a player, I want a display name separate from my username, so that the ladder shows the name my friends actually call me.
10. As a player, I want to be told immediately if my chosen username is taken, so that signup does not fail at the last step.
11. As a logger who cannot find a friend in the player picker, I want to send them an invite link or QR code on the spot, so that they can register and we can log the game we just played.

### Logging a game

12. As the player who just finished a game, I want to log it by picking four players and entering the score, so that it counts toward everyone's rating.
13. As a logger, I want my recent teammates and opponents at the top of the picker, so that I do not search thirty names every time.
14. As a logger, I want to search players by name as I type, so that I can find someone who is not in my recents.
15. As a logger, I want to assign the four players to two sides, so that the record reflects who actually partnered whom.
16. As a logger, I want to record the format — to 31, 21, 15, or 11 — so that the history reflects what we played.
17. As a logger, I want to be warned immediately if the score is not a valid badminton result, so that I do not create a game everyone has to dispute.
18. As a logger playing several games with the same four people, I want to keep the lineup and just enter the next score, so that logging a whole afternoon takes seconds rather than minutes.
19. As a logger, I want to see the rating change each player stands to gain or lose before I submit, so that I understand what is at stake.
20. As a logger who made a mistake, I want to cancel a game I just submitted while it is still pending, so that I do not need to bother the admin.
21. As a logger, I want to attach an optional photo as a memento, so that a good session leaves something behind — but never as a requirement.
22a. As a logger, I want to easily clear a player I picked by mistake and search for someone else, so that a wrong pick costs one tap.

### Confirming and disputing

22. As a player named in a game, I want a push notification asking me to confirm, so that nothing is recorded about me without my knowledge.
23. As a confirming player, I want to approve with a single tap from the notification or the banner, so that confirming never feels like a chore.
24. As a player who disagrees with a logged score, I want to dispute it, so that a wrong result does not move my rating.
25. As any participant in a disputed game, I want to be notified of the dispute, so that we can sort it out in person at the next session.
26. As a club, we want games that nobody responded to to auto-accept after twenty-four hours, so that the ladder is not held hostage by one person who does not open the app.
27. As a player, I want pending games to move nobody's rating, so that the ladder only ever reflects agreed results.
28. As a player with games awaiting my response, I want a banner when I open the app, so that I can clear them even if I missed the push.
29. As a player, I want to see which of the other three have confirmed so far, so that I know whether a game is nearly settled.

### The ladder and the rating

30. As a club player, I want one club ladder, so that I know where I stand among everyone I play with.
31. As a club player, I want to filter the ladder to men's or women's rankings, so that I can see the same splits the widget shows.
32. As a new player, I want a provisional badge rather than a rank until I have played five games, so that nobody judges me on two lucky results.
33. As a player in placement, I want to see how many games remain before I am ranked, so that I know what I am working toward.
34. As a player, I want a tier label in my club's own words — Newbie, Y, TB, TB+, Khá — so that my rating means something in the language we already use courtside.
35. As a strong player who beat a much weaker pair, I want my rating to barely move, so that the ladder cannot be climbed by farming easy games.
36. As a weaker player who beat a much stronger pair, I want a large rating gain, so that genuine upsets are properly rewarded.
37. As a new player, I want my rating to move quickly at first and settle as I play more, so that it finds my real level fast without bouncing forever.
38. As a player returning after a month away, I want my rating to be responsive again, so that it can catch up to my current form quickly.
39. As a club player, I want the ladder to list only people who have played recently, so that it reflects who is actually around.
40. As an inactive player, I want my rating preserved while I am off the ladder, so that I pick up where I left off rather than starting again.
41. As a club player, I want the same set of games to always produce the same ratings, so that the ladder never changes mysteriously.
42. As a club player, I want to know that 21-5 and 21-19 count the same, so that nobody feels obliged to humiliate a weaker opponent for rating points.

### The feed

43. As a club player, I want a feed of every confirmed game with scores and rating changes, so that I can follow what happened at sessions I missed.
44. As a club player, I want to see games I was not in, so that the whole club's activity is visible and anyone can spot something wrong.
45. As a club player, I want to open any game from the feed and see its full detail, so that I can check a result I am curious about. Once a game is confirmed, its detail does not list who confirmed it; that is only shown while it is pending (story 29).
46. As a club player, I want the feed to be worth opening midweek, so that the app is not only useful during sessions.

### My profile and stats

47. As a player, I want my win/loss record, so that I can see how I am doing overall.
48. As a player, I want a graph of my rating over time, so that I can see whether I am improving.
49. As a player, I want to see which partners I win most and least with, so that I can choose better pairings.
50. As a club player, I want to see any other player's partner breakdown too, so that the whole club can talk about pairings openly.
51. As a player, I want head-to-head records against each opponent, so that rivalries are tracked and settled.
52. As a player, I want a performance-vs-expectation figure, so that I can tell whether I am genuinely lifting my teams or just riding good partners.
53. As a player, I want the rating change shown against each of my recent games, so that I understand what moved me.
54. As a player, I want to see how many games I have played this month, so that I know whether I am staying on the active ladder.

### The widget

55. As a club player, I want a home-screen widget showing the top five men, so that the ladder is visible without opening anything.
56. As a club player, I want the same widget to show the top five women, so that both ladders get equal visibility.
57. As a club player, I want my own rank on the widget, so that I can see my position even when I am nowhere near the top five.
58. As a club player, I want the widget to refresh shortly after a game I played is confirmed, so that it feels alive on weekends.
59. As a player still in placement, I want the widget to show something sensible rather than an error or a zero, so that it is not broken during my first week.
60. As a club player, I want to understand that the widget updates within minutes rather than instantly, so that I do not think it is broken.

### Notifications

61. As a player, I want push notifications for confirmation requests, so that the loop works without me remembering to check the app.
62. As a player, I want a Sunday-evening weekly recap, so that I get a satisfying summary of the weekend.
63. As a player who finds competition stressful, I want "someone passed you on the ladder" notifications off unless I switch them on, so that the app never feels like it is needling me.
64. As a player, I want to turn each notification type on or off independently, so that I keep only what I like.

### Administration and trust

65. As the admin, I want to correct a wrong score, so that one typo does not permanently distort the ladder.
66. As the admin, I want to void a game entirely, so that games that did not happen can be removed.
67. As the admin, I want every correction to recompute all affected ratings automatically, so that I never hand-edit a rating.
68. As the admin, I want to adjust a player's seed tier shortly after signup, so that an honest self-misjudgement can be fixed before it distorts anything.
69. As the admin, I want to merge duplicate accounts, so that someone who signed up twice does not appear twice on the ladder.
70. As the admin, I want to see flagged implausible activity, so that I can check anything that looks wrong.
71. As the admin, I want a per-player daily cap on logged games, so that nobody can flood the ladder by accident or otherwise.
72. As the admin, I want to appoint a second admin, so that corrections do not wait for me when I am away for a weekend.
73. As a club player, I want every game to carry all four names publicly, so that the record polices itself.
74. As a club player, I want to know that ratings cannot be computed or altered from a phone, so that a modified app cannot fake a ranking.

## Implementation Decisions

### Rating model

**OpenSkill (Weng-Lin), Plackett-Luce variant, via `openskill.js`.** Chosen over Elo
because Elo is a 1v1 model bent into doubles by averaging, and carries no notion of
uncertainty — which matters enormously in a club where newbies and strong players
share one pool. Chosen over TrueSkill because TrueSkill is patented for commercial
use; OpenSkill is the open equivalent of the same model family. Plackett-Luce is the
library default and for plain 2v2 behaves near-identically to the alternatives, so
the variant is not worth revisiting.

Parameters, which encode the decisions more precisely than prose:

```
sigma (all new players)   8.3333        // 25/3, library default
placement games           5             // ~first weekend at this club's volume
display rating            max(0, (mu - 1.5*sigma) * 40)
inactivity                sigma inflates toward its initial value after 21 days idle
margin of victory         recorded, NOT an input to the rating
rated unit                one game (format 31/21/15/11 tagged, weighted equally)

seed tier -> starting mu
  Newbie  16
  Y       21
  TB      25
  TB+     30
  Khá     36

display rating -> tier band    (CONFIRMED by simulation, 2026-11-03)
  Newbie  < 400
  Y       400 - 599
  TB      600 - 879
  TB+     880 - 1119
  Khá     >= 1120
```

Seed tier sets starting `mu` only; `sigma` stays at full width for everyone, so a
seed is a hint the model can overrule within a few games. Players in placement show
`provisional n/5` instead of a number, so nobody is judged on a handful of results
while their uncertainty is still at full width.

The tier bands and the display scale were checked against the simulation harness on
2026-11-03 and both were wrong as first written: sigma plateaus near 5.2 at this
club's volume rather than settling low, so the original `mu - 3*sigma` flattened a
fifth of the club to a display rating of zero. See the Decision Log for the
before/after figures. Both are now simulation-confirmed, and neither may change
again without another harness run.

### Derived-state architecture

Confirmed games are the only authoritative data. All ratings are produced by
**replaying** the ordered confirmed-game history through the engine. Nothing writes
a rating as an authoritative value.

This is the decision the rest of the system hangs on. It means any rating parameter
above can change later without corrupting history; it means every admin correction
is an edit followed by a replay rather than a hand-patched number; and it makes the
engine trivially testable because it is a pure function of a game list.

Replay runs in a Supabase Edge Function. At this club's volume — roughly 300 games
a month, so a few thousand within a year — a full replay from zero is cheap enough
to be the only code path. Do not build incremental updating as an optimisation until
a full replay measurably hurts.

Rating maths never runs on the client as an authority. The client may compute a
*preview* of a prospective rating change for display before submission; that preview
is explicitly untrusted and is never persisted.

### Modules

- **`domain/rating`** — pure. Takes an ordered list of confirmed games plus player
  seed tiers, returns each player's `mu`, `sigma`, games played, display rating,
  tier, and per-game deltas. No I/O, no dates from the system clock (time is passed
  in), no randomness.
- **`domain/game-lifecycle`** — pure. A reducer over game state: `(state, event) ->
  state`, covering pending → confirmed → disputed → voided, the twenty-four-hour
  auto-accept, the logger's own implicit confirmation, and the cancel-while-pending
  window.
- **`domain/validation`** — pure. Badminton score validity per format (rally point,
  win by two, hard cap at 40 for a game to 31, 30 for a game to 21, 21 for a game to 15, and 15 for a
  game to 11), four distinct players, two per side.
- **`domain/stats`** — pure. Win/loss, partner breakdown, head-to-head, and
  performance-vs-expectation derived from the same game list.
- **`data`** — the only module that talks to Supabase. Thin adapters; no business
  rules. Nothing above it imports the Supabase client directly.
- **`ui`** — screens and components. Reads from `data`, formats output from
  `domain`. Contains no rules.
- **Edge Functions** — `replay-ratings` (recompute and persist derived tables),
  `confirm-game` (apply a confirmation event, trigger replay when a game becomes
  confirmed), `auto-accept` (scheduled, sweeps games past the 24h window),
  `notify-widget` (silent push to participants after a confirmation).
- **Widget extension** — Swift, WidgetKit, large size only. Renders a pre-computed
  payload; contains no rating logic.

### Data model

Authoritative:

- **`profiles`** — username (unique), display name, gender (`male` | `female`),
  seed tier, admin flag, created at.
- **`games`** — logger, format, both scores, winning side, played at, status
  (`pending` | `confirmed` | `disputed` | `voided`), void reason, optional photo ref.
- **`game_participants`** — four rows per game: game, profile, side.
- **`game_confirmations`** — game, profile, state (`pending` | `confirmed` |
  `disputed`), responded at.

Derived, rebuilt by replay and never written by hand:

- **`player_ratings`** — profile, mu, sigma, games played, display rating, tier,
  active flag, updated at.
- **`rating_history`** — game, profile, mu and display rating before and after.

Row-level security: all club members may read all of the above. Only the logger may
create a game; only a participant may write their own confirmation row; only an
admin may change a game's score or void it. No client may write to the derived
tables at all — the Edge Function's service role owns them.

### Identity and auth

Supabase Auth with email+password, Google, and Sign in with Apple. Apple's App Store
guideline 4.8 requires an equivalent privacy-respecting login wherever a third-party
service is offered, so Google implies Apple; both ship together.

Username login needs a mapping layer, because Supabase authenticates by email:
username is stored on `profiles` with a uniqueness constraint and a reserved-names
list, and sign-in resolves username to email before calling Auth.

Resend is wired in as custom SMTP from day one. Supabase's built-in mailer is
rate-limited and not intended for production, and a password reset that silently
never arrives is exactly how a community quietly stops using an app.

All four participants must be registered accounts. Guest and placeholder profiles
were considered and rejected. The accepted consequence is that signup must be
sub-thirty-seconds and the player picker must offer a courtside invite link or QR
when a name is not found.

### Widget delivery

Large size only in v1 — the spec's eleven rows (five men, five women, viewer's rank)
do not fit a small or medium widget, and lock-screen widgets cannot hold them at all.

iOS does not let a widget poll. Three refresh paths together:

- A timeline refresh roughly hourly as the floor.
- `reloadAllTimelines` when the app is foregrounded, so the logger sees their change
  immediately.
- A silent background push (`content-available`) to the other participants when a
  game becomes confirmed, waking their app long enough to reload.

The app states "ranks update within a few minutes" in the UI. Chasing true realtime
on an iOS widget is not winnable and is not attempted.

The widget renders a payload written to the App Group container by the host app. It
does not query Supabase and does not hold a session token.

### Scope and sequencing

No sessions, no organisers, no groups. The club plays in two or three sub-groups with
players crossing between them, and a single connected rating pool is what makes one
ladder statistically meaningful. Games are free-standing records.

One computed rating pool for all genders. Gender splits the *display* only. A
separate women's pool would have roughly eight players and would never converge.

Build order: schema and auth → log, confirm, and the rating engine → ladder, feed,
and stats → widget → TestFlight to a handful of players, then the whole club. Pay
the Apple Developer fee before the widget step.

## Testing Decisions

### What a good test looks like here

A test asserts **observable behaviour through a module's public interface**, never
its internals. For the rating engine that means: given this list of games, these are
the resulting ratings and this is the resulting order. It does not mean asserting
that `openskill.rate` was called, or reaching into intermediate values, or
snapshot-testing a blob of floats nobody can read.

Tests are written before the implementation for everything in `domain/**`.

Floating-point assertions use a tolerance, and more importantly most assertions
should be about **ordering and direction** (did the underdog gain more than the
favourite?) rather than exact magnitudes, because magnitudes are tuning and will
change.

### The seam

**One seam: the pure domain core.** `domain/rating`, `domain/game-lifecycle`,
`domain/validation`, and `domain/stats` are plain functions over plain data, with no
I/O, no clock, and no randomness. Every rule in this spec that can be wrong lives
behind that seam and is tested directly against it.

Everything outside it — `data`, `ui`, Edge Function handlers, the widget extension —
is deliberately thin enough to need no unit tests. It is covered by manual
verification on a device and by the end-to-end smoke check below. Where an Edge
Function appears to need a test, that is a signal a rule leaked out of the domain
core; move the rule in rather than adding a second seam.

Enforced by an import restriction: nothing in `src/domain/**` may import React,
React Native, Expo, or the Supabase client. If that rule starts to chafe, the design
is drifting.

### What gets tested

- **`domain/rating`** — surprise asymmetry (an underdog win moves more than a
  favourite win); uncertainty asymmetry (a new player moves further per game than a
  veteran); placement transition at exactly five games; seed tiers producing the
  expected initial order; inactivity inflating sigma; margin of victory having no
  effect; determinism, i.e. the same game list always yielding identical output.
- **`domain/game-lifecycle`** — every state transition and every invalid one;
  twenty-four-hour auto-accept including the exact boundary; a single dispute
  freezing a game regardless of other confirmations; the logger counting as
  confirmed; cancel permitted while pending and refused once confirmed; voiding
  removing a game from the replay input.
- **`domain/validation`** — valid and invalid scores for each of the three formats,
  including win-by-two and the caps at 40 and 30; duplicate players; wrong side counts.
- **`domain/stats`** — partner breakdown and head-to-head against hand-computed
  fixtures; performance-vs-expectation returning near zero for a player who wins
  exactly as often as their partner's rating predicts.

### The simulation harness

A deliberate test of the *premise*, not just the code, and it runs before any real
game is logged.

Invent thirty synthetic players with known true skill levels matching this club's
spread, simulate roughly three hundred games with realistic pairing (including the
mixed-level pairing a club actually uses), and assert that the engine recovers the
true ranking order within a tolerance. Then use the same harness to check the
parameters above: how many games placement really needs, whether the seed values
help or hurt convergence, and where the five tier bands should actually sit.

This is a committed test, not a throwaway script — it is the regression guard for
every future rating-parameter change, and `CLAUDE.md` forbids changing those
parameters without running it.

### End-to-end smoke check

One scripted path against a local Supabase instance: register four players, log a
game, confirm from three accounts, assert the derived tables hold the expected
ratings and that `rating_history` has four rows. Its job is to prove the wiring,
not the rules. Keep it to one.

### Prior art

None — this is a greenfield repository. These decisions establish the convention,
and later work should follow them rather than introduce a second style.

## Out of Scope

Not in v1, and not to be built opportunistically:

- **Monetisation of any kind.** No subscriptions, no ads, no paid tiers. The project
  is free for one community; there is no payer to design for.
- **Medium and small widgets.** Large only.
- **Pairing and court-rotation suggestions.** Deferred deliberately, not forgotten
  — see Further Notes.
- **Sessions, organisers, and groups.** Games are free-standing.
- **Android.** iOS only. The data layer should not actively prevent it later, but no
  work is spent enabling it.
- **Separate singles, level-doubles, or mixed-doubles ladders.** One pool.
- **Tournaments, brackets, challenges, and ladder matches.**
- **Public App Store distribution.** TestFlight only.
- **Public or cross-club discovery.** One closed community, invite only.
- **Chat, expense splitting, attendance tracking, court booking.** Other apps do
  these; this one does the ladder.
- **Photo or video as proof.** A photo is an optional memento and never a
  requirement, because a photo cannot establish a score and storage is the one thing
  that could introduce a running cost.
- **Guest or placeholder player profiles.** Considered and rejected.
- **Incremental rating updates.** Full replay only, until it measurably hurts.

## Further Notes

**The competitive landscape is known and accepted.** Badminton 360, Rankat,
EloSmash, Ranking – Badminton ELO, and Badminton: Score Counter already ship most of
this specification for free, and Badminton: Score Counter already has widgets. This
was checked before the spec was written and the decision to build anyway is
deliberate: the app is for one specific community the author belongs to. Do not
treat this as a market opportunity or propose features aimed at a wider audience.

**The likely v2 is pairing and court rotation.** With thirty spread-level players
over two hours and courts to share, deciding who plays with whom is plausibly the
real weekly friction, and the OpenSkill ratings this app produces are exactly the
input such a feature needs. It was kept out of v1 because it is a
scheduling-optimisation problem with strong social opinions attached, and because the
logging loop must be proven first. The absence of sessions in v1 is not an obstacle
to it.

**OpenSkill cannot distinguish carrying from being carried.** It assumes teammates
are interchangeable contributors, so in a club that deliberately pairs strong with
weak to balance games, weaker players riding stronger partners will drift upward
over time. No algorithmic fix is attempted — every attempt to infer individual
contribution from a 2v2 result without per-point data ends badly. The mitigation is
the performance-vs-expectation stat, which cannot be inherited from a partner, shown
alongside the rating. If the ladder starts visibly lying, this is the first place to
look.

**Partner chemistry is fully public by explicit decision.** The recommendation was
to show a player their own partner breakdown but not expose anyone else's, because
"you win 34% with X" is socially radioactive in a group that meets every weekend.
The author overrode this, knowing their community. It is built fully public. If it
causes friction, the private variant is a small change — but do not make it
unilaterally.

**The one unavoidable cost is $99/year to Apple**, because the App Group entitlement
the widget requires is not available to free personal developer teams. Supabase and
Resend both stay within free tiers at this scale. Supabase free-tier projects pause
after about a week of inactivity, which twice-weekly use comfortably prevents.

**Why thirty players and two sessions a week matters.** Roughly 300 rated games a
month means about ten games per player per week, so sigma converges within a month.
Many club ladders are statistically meaningless noise; this one has the volume to be
real. Any future change that fragments the pool — separate ladders by gender, by
group, or by format — gives that up, which is why several of them sit in Out of
Scope.
