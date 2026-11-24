import { overtaken } from '../../../src/domain/overtaken.ts';
import { replayRatings } from '../../../src/domain/rating.ts';
import type { Json } from '../../../src/data/database.types.ts';
import { pushEach } from '../_shared/push.ts';
import { parseReplayInput } from '../_shared/replay-input.ts';
import { callerClient, json, type ServiceClient } from '../_shared/supabase.ts';

const PERMISSION_DENIED = '42501';

/**
 * Rebuilds every rating from the confirmed-game history. This is the only code path
 * that writes a rating, and it always replays from zero — at this club's volume a few
 * thousand games is cheap, and one path cannot disagree with another.
 *
 * It runs as whoever called it, and replay_input and apply_replay are granted to
 * service_role alone, so a club member with a valid token gets 403 from the database
 * rather than a free rebuild on request.
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

  const started = Date.now();
  const { seeds, games } = parseReplayInput(input.data);
  const result = replayRatings({ seeds, games, now: started });
  const durationMs = Date.now() - started;

  const applied = await caller.rpc('apply_replay', {
    p_ratings: asJson(result.ratings),
    p_history: asJson(result.history),
    p_duration_ms: durationMs,
  });
  if (applied.error !== null) return json({ error: applied.error.message }, 500);

  // apply_replay hands back the ladder it replaced.
  const before = applied.data.map((row) => ({
    profileId: row.profile_id,
    displayRating: row.display_rating,
    active: row.is_active,
    inPlacement: row.in_placement,
  }));
  // The ladder is already rebuilt; a push that fails must not report the replay as failed.
  await announcePasses(caller, overtaken(before, result.ratings)).catch((error) =>
    console.error('overtaken notifications failed', error),
  );

  return json({ games: games.length, players: result.ratings.length, durationMs });
});

async function announcePasses(
  service: ServiceClient,
  passed: ReadonlyMap<string, readonly string[]>,
): Promise<void> {
  if (passed.size === 0) return;

  const names = await service.from('profiles').select('id, display_name');
  if (names.error !== null) throw new Error(names.error.message);
  const nameOf = new Map(names.data.map((row) => [row.id, row.display_name]));

  await pushEach(
    service,
    'overtaken_on_ladder',
    [...passed].map(([profileId, by]) => ({
      profileId,
      message: {
        title: 'You were passed on the ladder',
        body: `${by.map((id) => nameOf.get(id) ?? 'Someone').join(', ')} moved above you.`,
        path: '',
      },
    })),
  );
}

/**
 * The engine returns readonly interfaces. They serialize to json exactly as the SQL
 * expects, but an interface has no index signature so TypeScript will not call one
 * `Json`. This cast is the entire cost of spelling the payload the way the engine
 * spells it rather than translating field by field and letting the two drift.
 */
function asJson(value: readonly object[]): Json {
  return value as unknown as Json;
}
