import { replayRatings, type PlayerSeed, type RatedGame } from '../../../src/domain/rating.ts';
import type { Tier } from '../../../src/domain/types.ts';
import type { Json } from '../../../src/data/database.types.ts';
import { callerClient, json } from '../_shared/supabase.ts';

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
  const { seeds, games } = parse(input.data);
  const result = replayRatings({ seeds, games, now: started });
  const durationMs = Date.now() - started;

  const applied = await caller.rpc('apply_replay', {
    p_ratings: asJson(result.ratings),
    p_history: asJson(result.history),
    p_duration_ms: durationMs,
  });
  if (applied.error !== null) return json({ error: applied.error.message }, 500);

  return json({ games: games.length, players: result.ratings.length, durationMs });
});

/**
 * The engine returns readonly interfaces. They serialize to json exactly as the SQL
 * expects, but an interface has no index signature so TypeScript will not call one
 * `Json`. This cast is the entire cost of spelling the payload the way the engine
 * spells it rather than translating field by field and letting the two drift.
 */
function asJson(value: readonly object[]): Json {
  return value as unknown as Json;
}

/**
 * The payload crosses from Postgres as json, so it is narrowed rather than asserted.
 * A replay that quietly rated a malformed game is the one fault in this system that
 * replaying history cannot undo, because history is what would be wrong.
 */
function parse(payload: unknown): {
  readonly seeds: readonly PlayerSeed[];
  readonly games: readonly RatedGame[];
} {
  const root = asRecord(payload, 'replay input');
  return {
    seeds: asArray(root.seeds, 'seeds').map(parseSeed),
    games: asArray(root.games, 'games').map(parseGame),
  };
}

const TIERS: readonly Tier[] = ['newbie', 'y', 'tby', 'tb-plus', 'kha'];

function parseSeed(payload: unknown): PlayerSeed {
  const seed = asRecord(payload, 'seed');
  const seedTier = seed.seedTier;
  if (typeof seedTier !== 'string' || !TIERS.includes(seedTier as Tier)) {
    throw new Error(`seed tier ${String(seedTier)} is not one of the club tiers`);
  }
  return { profileId: asString(seed.profileId, 'seed profileId'), seedTier: seedTier as Tier };
}

function parseGame(payload: unknown): RatedGame {
  const game = asRecord(payload, 'game');
  return {
    id: asString(game.id, 'game id'),
    playedAt: asNumber(game.playedAt, 'playedAt'),
    sideA: asPair(game.sideA, 'sideA'),
    sideB: asPair(game.sideB, 'sideB'),
    scoreA: asNumber(game.scoreA, 'scoreA'),
    scoreB: asNumber(game.scoreB, 'scoreB'),
  };
}

function asRecord(value: unknown, what: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${what} is not an object`);
  }
  return value as Record<string, unknown>;
}

function asArray(value: unknown, what: string): readonly unknown[] {
  if (!Array.isArray(value)) throw new Error(`${what} is not an array`);
  return value;
}

function asString(value: unknown, what: string): string {
  if (typeof value !== 'string' || value === '') throw new Error(`${what} is not a string`);
  return value;
}

function asNumber(value: unknown, what: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${what} is not a number`);
  }
  return value;
}

function asPair(value: unknown, what: string): readonly [string, string] {
  const side = asArray(value, what);
  if (side.length !== 2) throw new Error(`${what} holds ${side.length} players, not two`);
  return [asString(side[0], what), asString(side[1], what)];
}
