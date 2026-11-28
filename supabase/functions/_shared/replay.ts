import { overtaken } from '../../../src/domain/overtaken.ts';
import { replayRatings } from '../../../src/domain/rating.ts';
import type { Json } from '../../../src/data/database.types.ts';
import { pushEach } from './push.ts';
import { parseReplayInput } from './replay-input.ts';
import type { ServiceClient } from './supabase.ts';

const PERMISSION_DENIED = '42501';

export type ReplayOutcome =
  | { readonly ok: true; readonly games: number; readonly players: number; readonly durationMs: number }
  | { readonly ok: false; readonly denied: boolean; readonly message: string };

/**
 * Rebuilds every rating from the confirmed-game history. This is the only code path
 * that writes a rating, and it always replays from zero — at this club's volume a few
 * thousand games is cheap, and one path cannot disagree with another.
 *
 * Run in-process by every function that changes rating input, rather than by calling
 * the replay-ratings function over HTTP: that call had to pass the gateway with the
 * service key, and the gateway refused the key the platform hands a function, so for
 * a while no confirmation or admin action rebuilt the ladder.
 *
 * replay_input and apply_replay are granted to service_role alone, so a client acting
 * as a club member comes back `denied` rather than getting a free rebuild.
 */
export async function replayClub(client: ServiceClient): Promise<ReplayOutcome> {
  const input = await client.rpc('replay_input');
  if (input.error !== null) {
    return { ok: false, denied: input.error.code === PERMISSION_DENIED, message: input.error.message };
  }

  const started = Date.now();
  const { seeds, games } = parseReplayInput(input.data);
  const result = replayRatings({ seeds, games, now: started });
  const durationMs = Date.now() - started;

  const applied = await client.rpc('apply_replay', {
    p_ratings: asJson(result.ratings),
    p_history: asJson(result.history),
    p_duration_ms: durationMs,
  });
  if (applied.error !== null) return { ok: false, denied: false, message: applied.error.message };

  // apply_replay hands back the ladder it replaced.
  const before = applied.data.map((row) => ({
    profileId: row.profile_id,
    displayRating: row.display_rating,
    active: row.is_active,
    inPlacement: row.in_placement,
  }));
  // The ladder is already rebuilt; a push that fails must not report the replay as failed.
  await announcePasses(client, overtaken(before, result.ratings)).catch((error) =>
    console.error('overtaken notifications failed', error),
  );

  return { ok: true, games: games.length, players: result.ratings.length, durationMs };
}

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
        title: 'Bạn vừa bị vượt trên bảng xếp hạng',
        body: `${by.map((id) => nameOf.get(id) ?? 'Ai đó').join(', ')} vừa vượt lên trên bạn.`,
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
