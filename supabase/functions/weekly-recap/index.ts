import { recapFor } from '../../../src/domain/recap.ts';
import type { RatingChange } from '../../../src/domain/rating.ts';
import { pushEach } from '../_shared/push.ts';
import { parseReplayInput } from '../_shared/replay-input.ts';
import { callerClient, json } from '../_shared/supabase.ts';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const PERMISSION_DENIED = '42501';

/**
 * Story 62: the Sunday-evening recap. Scheduled weekly; every member who played in
 * the last seven days and wants the recap is told what their weekend came to. The
 * numbers are the replay's own, read back from rating_history, never recomputed.
 *
 * Runs as its caller, and replay_input is granted to service_role alone, so a member
 * cannot have the club's recap sent on demand.
 */
Deno.serve(async (request) => {
  const authorization = request.headers.get('Authorization');
  if (authorization === null) return json({ error: 'sign in first' }, 401);
  const caller = callerClient(authorization);

  const input = await caller.rpc('replay_input');
  if (input.error !== null) {
    const denied = input.error.code === PERMISSION_DENIED;
    return json({ error: input.error.message }, denied ? 403 : 500);
  }

  const to = Date.now();
  const from = to - WEEK_MS;
  const games = parseReplayInput(input.data).games.filter(
    (game) => game.playedAt >= from && game.playedAt < to,
  );
  if (games.length === 0) return json({ players: 0, sent: 0 });

  const history = await caller
    .from('rating_history')
    .select('game_id, profile_id, mu_before, mu_after, display_before, display_after')
    .in('game_id', games.map((game) => game.id));
  if (history.error !== null) return json({ error: history.error.message }, 500);

  const changes: RatingChange[] = history.data.map((row) => ({
    gameId: row.game_id,
    profileId: row.profile_id,
    muBefore: row.mu_before,
    muAfter: row.mu_after,
    displayBefore: row.display_before,
    displayAfter: row.display_after,
  }));

  const players = new Set(games.flatMap((game) => [...game.sideA, ...game.sideB]));
  const messages = [...players].flatMap((profileId) => {
    const recap = recapFor({ profileId, games, changes });
    if (recap === null) return [];
    const moved = recap.ratingAfter - recap.ratingBefore;
    return [
      {
        profileId,
        message: {
          title: 'Tuần qua của bạn',
          body:
            `${recap.games} trận, thắng ${recap.wins}. Điểm ${recap.ratingBefore} → ` +
            `${recap.ratingAfter} (${moved >= 0 ? '+' : ''}${moved}).`,
          path: 'me',
        },
      },
    ];
  });

  const sent = await pushEach(caller, 'weekly_recap', messages);
  return json({ players: messages.length, sent });
});
