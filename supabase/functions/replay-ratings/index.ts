import { replayClub } from '../_shared/replay.ts';
import { callerClient, json, serve } from '../_shared/supabase.ts';

/**
 * A rebuild on request, for when the ladder must be redone by hand. The functions
 * that change rating input run the same replay themselves.
 *
 * It runs as whoever called it, so a club member with a valid token gets 403 from
 * the database rather than a free rebuild.
 */
serve(async (request) => {
  const authorization = request.headers.get('Authorization');
  if (authorization === null) return json({ error: 'sign in first' }, 401);

  const outcome = await replayClub(callerClient(authorization));
  if (!outcome.ok) return json({ error: outcome.message }, outcome.denied ? 403 : 500);

  return json({ games: outcome.games, players: outcome.players, durationMs: outcome.durationMs });
});
