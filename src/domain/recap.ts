import type { RatedGame, RatingChange } from './rating.ts';
import type { ProfileId } from './types.ts';

/** Story 62: what one player's weekend came to. */
export interface Recap {
  readonly games: number;
  readonly wins: number;
  readonly ratingBefore: number;
  readonly ratingAfter: number;
}

/**
 * Over whichever games the caller chose as the week. Null for a player with none of
 * them, so nobody is sent a recap of nothing. Ratings come from the replay's own
 * per-game changes, never recomputed.
 */
export function recapFor(input: {
  readonly profileId: ProfileId;
  readonly games: readonly RatedGame[];
  readonly changes: readonly RatingChange[];
}): Recap | null {
  const played = input.games
    .filter((game) => [...game.sideA, ...game.sideB].includes(input.profileId))
    .sort((left, right) => left.playedAt - right.playedAt);

  const changeFor = new Map(
    input.changes
      .filter((change) => change.profileId === input.profileId)
      .map((change) => [change.gameId, change]),
  );
  const first = changeFor.get(played[0]?.id ?? '');
  const last = changeFor.get(played[played.length - 1]?.id ?? '');
  if (first === undefined || last === undefined) return null;

  const wins = played.filter((game) => {
    const onA = game.sideA.includes(input.profileId);
    return onA === game.scoreA > game.scoreB;
  }).length;

  return {
    games: played.length,
    wins,
    ratingBefore: first.displayBefore,
    ratingAfter: last.displayAfter,
  };
}
