/**
 * The one end-to-end check. It proves the wiring, not the rules: four members
 * register, one logs a game, the other three confirm it, and the derived tables come
 * out holding ratings that moved in the right direction.
 *
 * Every rule it touches is tested properly against the pure domain core. What cannot
 * be tested there is exactly what this covers — row-level security, the grants, the
 * atomic writes, and whether a Deno function can reach the domain at all.
 *
 *   npx supabase start && npm run smoke
 */
import { call, check, checksPassed, local, register, type Member } from './smoke-client.ts';

async function main(): Promise<void> {
  const run = Math.random().toString(36).slice(2, 8);
  console.log(`\nregistering four members (run ${run})`);
  const members = await Promise.all([0, 1, 2, 3].map((index) => register(index, run)));
  check(members.length === 4, 'four members registered and completed a profile');

  const [logger, partner, left, right] = members;

  console.log('\nlogging a game, with the two newbies beating the two strongest');
  const logged = await call('/rest/v1/rpc/log_game', {
    token: left.token,
    body: {
      p_format: 21,
      p_side_a: [logger.profileId, partner.profileId],
      p_side_b: [left.profileId, right.profileId],
      p_score_a: 18,
      p_score_b: 21,
    },
  });
  check(logged.status === 200, 'the logger could log a game');
  const gameId = logged.body as string;

  const seen = await call(`/rest/v1/game_confirmations?game_id=eq.${gameId}&select=*`, {
    token: logger.token,
  });
  const answers = seen.body as { profile_id: string; state: string }[];
  check(answers.length === 4, 'the game carries one confirmation row per participant');
  check(
    answers.filter((answer) => answer.state === 'confirmed').length === 1,
    'only the logger starts confirmed',
  );

  console.log('\na player who was not in the game cannot answer for it');
  const outsider = await register(1, `${run}x`);
  const refused = await call('/functions/v1/confirm-game', {
    token: outsider.token,
    body: { gameId, answer: 'confirm' },
  });
  check(refused.status === 409, 'a stranger is refused by the lifecycle, not by luck');
  check(
    (refused.body as { rejection: string }).rejection === 'not-a-participant',
    'and told exactly why',
  );

  console.log('\na club member cannot rebuild the ladder on request');
  const denied = await call('/functions/v1/replay-ratings', {
    token: logger.token,
    body: {},
  });
  check(denied.status === 403, 'replay-ratings is the service role only');

  console.log('\nthe other three confirm');
  for (const member of [logger, partner, right]) {
    const answer = await call('/functions/v1/confirm-game', {
      token: member.token,
      body: { gameId, answer: 'confirm' },
    });
    check(answer.status === 200, `${member.username} confirmed`);
  }

  const settled = await call(`/rest/v1/games?id=eq.${gameId}&select=status,winning_side`, {
    token: logger.token,
  });
  const game = (settled.body as { status: string; winning_side: string }[])[0];
  check(game.status === 'confirmed', 'the game is confirmed once all four have answered');
  check(game.winning_side === 'b', 'the winning side was derived from the scores');

  await assertNoPhoneCanWrite(logger);

  await assertRatingsMoved(gameId, members);

  await assertAdminCorrects(gameId, members);

  await assertMerge(members, run);

  await assertUsernameOnly(run);

  console.log(`\n${checksPassed()} checks passed\n`);
}

/**
 * The admin route: refused to a member, and for an admin a corrected score ends in a
 * replay without anyone asking for one (story 67).
 */
async function assertAdminCorrects(gameId: string, members: readonly Member[]): Promise<void> {
  console.log('\nthe admin');
  const [admin, partner, left] = members;

  const refused = await call('/functions/v1/admin', {
    token: left.token,
    body: { action: 'resolve', gameId },
  });
  check(refused.status === 403, 'a member who is not an admin is refused');

  const promoted = await call(`/rest/v1/profiles?id=eq.${admin.profileId}`, {
    token: local.SERVICE_ROLE_KEY,
    method: 'PATCH',
    body: { is_admin: true },
  });
  check(promoted.status < 300, 'the service role can appoint the first admin');

  const corrected = await call('/functions/v1/admin', {
    token: admin.token,
    body: { action: 'correct-score', gameId, scoreA: 21, scoreB: 18 },
  });
  check(corrected.status === 200, 'an admin can correct a score');
  check((corrected.body as { replayed: boolean }).replayed, 'and the correction replayed');

  const changes = await call(
    `/rest/v1/rating_history?game_id=eq.${gameId}&profile_id=eq.${admin.profileId}` +
      '&select=mu_before,mu_after',
    { token: admin.token },
  );
  const change = (changes.body as { mu_before: number; mu_after: number }[])[0];
  check(change.mu_after > change.mu_before, 'the side that now won the game gained skill');

  const invalid = await call('/functions/v1/admin', {
    token: admin.token,
    body: { action: 'correct-score', gameId, scoreA: 21, scoreB: 20 },
  });
  check(invalid.status === 409, 'an impossible score is refused by the domain rules');

  const reset = await call('/functions/v1/admin', {
    token: admin.token,
    body: { action: 'reset-password', profileId: partner.profileId, password: 'temporary-9' },
  });
  check(reset.status === 200, 'an admin can set a temporary password');

  const signIn = await call('/auth/v1/token?grant_type=password', {
    token: local.ANON_KEY,
    body: { email: `${partner.username}@users.badminton-ladder.invalid`, password: 'temporary-9' },
  });
  check(signIn.status === 200, 'and the member can sign in with it');
}

/**
 * Story 69. A merge deletes the duplicate's login in the same transaction as its
 * profile, so the duplicate can never sign in again and make a fresh one.
 */
async function assertMerge(members: readonly Member[], run: string): Promise<void> {
  console.log('\nmerging a duplicate');
  const [admin, , , left] = members;

  const sameGame = await call('/functions/v1/admin', {
    token: admin.token,
    body: { action: 'merge', keepId: admin.profileId, mergeId: left.profileId },
  });
  check(sameGame.status === 409, 'two accounts from the same game are not merged');

  const duplicate = await register(2, `${run}_dup`);
  const merged = await call('/functions/v1/admin', {
    token: admin.token,
    body: { action: 'merge', keepId: admin.profileId, mergeId: duplicate.profileId },
  });
  check(merged.status === 200, 'an admin can merge a duplicate account');

  const signIn = await call('/auth/v1/token?grant_type=password', {
    token: local.ANON_KEY,
    body: { email: `${duplicate.username}@users.badminton-ladder.invalid`, password: 'correct-horse-9' },
  });
  check(signIn.status === 400, 'and the duplicate can no longer sign in');
}

/** Supabase Auth will make an account for any address; only a username one may join. */
async function assertUsernameOnly(run: string): Promise<void> {
  console.log('\nusername-only membership');
  const signUp = await call('/auth/v1/signup', {
    token: local.ANON_KEY,
    body: { email: `smoke-${run}@example.com`, password: 'correct-horse-9' },
  });
  const { access_token: token } = signUp.body as { access_token: string };

  const profile = await call('/rest/v1/rpc/create_my_profile', {
    token,
    body: { p_display_name: 'Real Email', p_gender: 'male', p_seed_tier: 'y' },
  });
  check(profile.status >= 400, 'an account made with a real email cannot become a member');
}

async function assertRatingsMoved(gameId: string, members: readonly Member[]): Promise<void> {
  console.log('\nthe derived tables');
  const ids = members.map((member) => member.profileId).join(',');

  const changes = await call(
    `/rest/v1/rating_history?game_id=eq.${gameId}&select=profile_id,mu_before,mu_after`,
    { token: members[0].token },
  );
  const history = changes.body as { profile_id: string; mu_before: number; mu_after: number }[];
  check(history.length === 4, 'rating_history holds a row for each of the four players');

  const ratings = await call(
    `/rest/v1/player_ratings?profile_id=in.(${ids})` +
      '&select=profile_id,mu,sigma,games_played,display_rating,tier,in_placement,is_active',
    { token: members[0].token },
  );
  const ladder = ratings.body as {
    profile_id: string;
    games_played: number;
    in_placement: boolean;
    is_active: boolean;
    display_rating: number;
  }[];
  check(ladder.length === 4, 'every player who played has a rating');
  check(
    ladder.every((player) => player.games_played === 1),
    'each of them is one game in',
  );
  check(
    ladder.every((player) => player.in_placement),
    'and all four are still in placement after one game',
  );
  check(
    ladder.every((player) => player.is_active),
    'all four count as active, having just played',
  );

  const byId = new Map(history.map((change) => [change.profile_id, change]));
  const winners = [members[2], members[3]].map((member) => byId.get(member.profileId));
  const losers = [members[0], members[1]].map((member) => byId.get(member.profileId));
  check(
    winners.every((change) => change !== undefined && change.mu_after > change.mu_before),
    'the winners gained skill',
  );
  check(
    losers.every((change) => change !== undefined && change.mu_after < change.mu_before),
    'the losers lost skill',
  );

  const winnerGain = winners[0];
  const loserDrop = losers[0];
  if (winnerGain === undefined || loserDrop === undefined) throw new Error('missing a change');
  check(
    winnerGain.mu_after - winnerGain.mu_before > 1,
    'beating the two strongest players moved the underdog a long way',
  );

  const state = await call(
    '/rest/v1/rating_replay_state?select=last_replay_at,games_replayed',
    { token: members[0].token },
  );
  const replay = (state.body as { last_replay_at: string; games_replayed: number }[])[0];
  check(replay.last_replay_at !== null, 'the replay recorded when it ran');
  check(replay.games_replayed >= 1, 'and how many games it read');
}

/**
 * The guarantees that are configuration rather than code, and so would break
 * silently: a phone cannot write a rating, invent a game, or make itself an admin.
 */
async function assertNoPhoneCanWrite(member: Member): Promise<void> {
  console.log("\nwhat a phone cannot do");

  const rating = await call("/rest/v1/player_ratings", {
    token: member.token,
    body: {
      profile_id: member.profileId, mu: 99, sigma: 1, games_played: 500,
      display_rating: 99999, tier: "kha", in_placement: false, is_active: true,
    },
  });
  check(rating.status >= 400, "a member cannot write a rating");

  const game = await call("/rest/v1/games", {
    token: member.token,
    body: { logger_id: member.profileId, format: 21, score_a: 21, score_b: 0 },
  });
  check(game.status >= 400, "a member cannot insert a game outside log_game");

  const promote = await call(`/rest/v1/profiles?id=eq.${member.profileId}`, {
    token: member.token,
    method: "PATCH",
    body: { is_admin: true },
  });
  check(promote.status >= 400, "a member cannot make themselves an admin");

  const after = await call(`/rest/v1/profiles?id=eq.${member.profileId}&select=is_admin`, {
    token: member.token,
  });
  check(
    (after.body as { is_admin: boolean }[])[0].is_admin === false,
    "and is still not one",
  );
}

await main();
