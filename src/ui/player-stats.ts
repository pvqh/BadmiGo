import type { GameRow } from '../data/games';
import {
  headToHead,
  partnerBreakdown,
  performanceVsExpectation,
  record,
  type Expectation,
  type OpponentTally,
  type PartnerTally,
  type Strength,
  type Tally,
} from '../domain/stats';
import type { ProfileId } from '../domain/types';
import { lineupOf, toRatedGame } from './game-row';

export interface PlayerStats {
  readonly record: Tally;
  readonly thisMonth: number;
  readonly partners: readonly PartnerTally[];
  readonly rivals: readonly OpponentTally[];
  readonly expectation: Expectation | null;
  readonly names: ReadonlyMap<ProfileId, string>;
}

/**
 * Everything a profile shows, worked out from the player's own confirmed games. The
 * arithmetic is all in src/domain/stats; this only turns rows into what it takes and
 * decides when there is not enough to say anything.
 */
export function statsFor(input: {
  readonly rows: readonly { readonly games: GameRow }[];
  readonly profileId: ProfileId;
  readonly strengths: readonly {
    readonly profile_id: ProfileId;
    readonly mu: number;
    readonly sigma: number;
  }[];
  readonly monthStart: number;
}): PlayerStats {
  const games = input.rows.flatMap((row) => {
    const rated = toRatedGame(row.games);
    return rated === null ? [] : [rated];
  });

  const names = new Map<ProfileId, string>();
  for (const row of input.rows) {
    const { a, b } = lineupOf(row.games);
    for (const player of [...a, ...b]) names.set(player.profileId, player.displayName);
  }

  const strengths = new Map<ProfileId, Strength>(
    input.strengths.map((entry) => [entry.profile_id, { mu: entry.mu, sigma: entry.sigma }]),
  );

  /*
   * An expectation needs a rating for everyone who played, and before the first
   * replay there are none. Checked rather than caught, because the domain throws on
   * a missing player on purpose: quietly skipping a game would flatter the figure.
   */
  const rateable = games.every((game) =>
    [...game.sideA, ...game.sideB].every((id) => strengths.has(id)),
  );

  return {
    record: record(games, input.profileId),
    thisMonth: games.filter((game) => game.playedAt >= input.monthStart).length,
    partners: partnerBreakdown(games, input.profileId),
    rivals: headToHead(games, input.profileId),
    expectation: rateable
      ? performanceVsExpectation({ games, profileId: input.profileId, strengths })
      : null,
    names,
  };
}

/** Midnight on the first of the month the given moment falls in. */
export function startOfMonth(now: number): number {
  const date = new Date(now);
  return new Date(date.getFullYear(), date.getMonth(), 1).getTime();
}
