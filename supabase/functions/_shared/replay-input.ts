import type { PlayerSeed, RatedGame } from '../../../src/domain/rating.ts';
import { asTier } from '../../../src/domain/types.ts';

/**
 * The payload crosses from Postgres as json, so it is narrowed rather than asserted.
 * A replay that quietly rated a malformed game is the one fault in this system that
 * replaying history cannot undo, because history is what would be wrong.
 */
export function parseReplayInput(payload: unknown): {
  readonly seeds: readonly PlayerSeed[];
  readonly games: readonly RatedGame[];
} {
  const root = asRecord(payload, 'replay input');
  return {
    seeds: asArray(root.seeds, 'seeds').map(parseSeed),
    games: asArray(root.games, 'games').map(parseGame),
  };
}

function parseSeed(payload: unknown): PlayerSeed {
  const seed = asRecord(payload, 'seed');
  const seedTier = asTier(seed.seedTier);
  if (seedTier === null) {
    throw new Error(`seed tier ${String(seed.seedTier)} is not one of the club tiers`);
  }
  return { profileId: asString(seed.profileId, 'seed profileId'), seedTier };
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
