import { predictWin } from 'openskill';
import type { RatedGame } from './rating.ts';
import type { ProfileId } from './types.ts';

/**
 * The secondary stats, derived from the same confirmed-game list the replay reads.
 * Pure, like everything in this folder: no clock, no I/O. A caller that wants "this
 * month" filters the games before calling in.
 */

export interface Tally {
  readonly played: number;
  readonly won: number;
  readonly lost: number;
}

export interface PartnerTally extends Tally {
  readonly partnerId: ProfileId;
}

export interface OpponentTally extends Tally {
  readonly opponentId: ProfileId;
}

export interface Strength {
  readonly mu: number;
  readonly sigma: number;
}

export interface Expectation {
  readonly games: number;
  readonly wins: number;
  readonly expectedWins: number;
  /** Wins above expectation per game. Zero is exactly as predicted. */
  readonly perGame: number;
}

interface Appearance {
  readonly partnerId: ProfileId;
  readonly opponents: readonly [ProfileId, ProfileId];
  readonly won: boolean;
}

export function record(games: readonly RatedGame[], profileId: ProfileId): Tally {
  return tally(appearances(games, profileId));
}

/** Every partner, the ones the player wins most with first. */
export function partnerBreakdown(
  games: readonly RatedGame[],
  profileId: ProfileId,
): readonly PartnerTally[] {
  const counted = new Map<ProfileId, Appearance[]>();
  for (const appearance of appearances(games, profileId)) {
    group(counted, appearance.partnerId).push(appearance);
  }

  return [...counted.entries()]
    .map(([partnerId, together]) => ({ partnerId, ...tally(together) }))
    .sort(byWinRate((entry) => entry.partnerId));
}

/** Every opponent, the longest-running rivalry first. */
export function headToHead(
  games: readonly RatedGame[],
  profileId: ProfileId,
): readonly OpponentTally[] {
  const counted = new Map<ProfileId, Appearance[]>();
  for (const appearance of appearances(games, profileId)) {
    for (const opponentId of appearance.opponents) {
      group(counted, opponentId).push(appearance);
    }
  }

  return [...counted.entries()]
    .map(([opponentId, met]) => ({ opponentId, ...tally(met) }))
    .sort(byVolume((entry) => entry.opponentId));
}

/**
 * Wins above what the other three players' ratings predicted, which is the one
 * figure in the app a player cannot inherit from a strong partner: the player
 * themselves is replaced by an average club member before the prediction is made.
 *
 * Null for a player who has not played. Throws rather than guesses if a participant
 * has no rating, because a silently skipped game would quietly flatter them.
 */
export function performanceVsExpectation(input: {
  readonly games: readonly RatedGame[];
  readonly profileId: ProfileId;
  readonly strengths: ReadonlyMap<ProfileId, Strength>;
}): Expectation | null {
  const mine = appearances(input.games, input.profileId);
  if (mine.length === 0) return null;

  const lineups = mine.map((appearance) => ({
    partner: strengthOf(input.strengths, appearance.partnerId),
    opponents: appearance.opponents.map((id) => strengthOf(input.strengths, id)),
  }));

  const standIn = clubAverage(input.strengths, input.profileId);
  const expectedWins = lineups.reduce((total, lineup) => {
    const [chance] = predictWin([[standIn, lineup.partner], lineup.opponents]);
    return total + chance;
  }, 0);

  const { played, won } = tally(mine);
  return { games: played, wins: won, expectedWins, perGame: (won - expectedWins) / played };
}

/** Which side the player was on, who with, who against, and whether they won. */
function appearances(
  games: readonly RatedGame[],
  profileId: ProfileId,
): readonly Appearance[] {
  const found: Appearance[] = [];

  for (const game of games) {
    const sideAWon = game.scoreA > game.scoreB;
    const onSideA = game.sideA.indexOf(profileId);
    if (onSideA !== -1) {
      found.push({
        partnerId: game.sideA[1 - onSideA],
        opponents: game.sideB,
        won: sideAWon,
      });
      continue;
    }

    const onSideB = game.sideB.indexOf(profileId);
    if (onSideB !== -1) {
      found.push({
        partnerId: game.sideB[1 - onSideB],
        opponents: game.sideA,
        won: !sideAWon,
      });
    }
  }

  return found;
}

function tally(appearances: readonly Appearance[]): Tally {
  const won = appearances.filter((appearance) => appearance.won).length;
  return { played: appearances.length, won, lost: appearances.length - won };
}

function group(
  counted: Map<ProfileId, Appearance[]>,
  profileId: ProfileId,
): Appearance[] {
  const existing = counted.get(profileId);
  if (existing !== undefined) return existing;

  const started: Appearance[] = [];
  counted.set(profileId, started);
  return started;
}

/** Ties break by volume and then by id, so the same games always sort the same way. */
function byWinRate<T extends Tally>(idOf: (entry: T) => ProfileId) {
  return (left: T, right: T): number => {
    const difference = right.won / right.played - left.won / left.played;
    if (difference !== 0) return difference;
    return byVolume(idOf)(left, right);
  };
}

function byVolume<T extends Tally>(idOf: (entry: T) => ProfileId) {
  return (left: T, right: T): number => {
    if (left.played !== right.played) return right.played - left.played;
    if (idOf(left) === idOf(right)) return 0;
    return idOf(left) < idOf(right) ? -1 : 1;
  };
}

function strengthOf(
  strengths: ReadonlyMap<ProfileId, Strength>,
  profileId: ProfileId,
): Strength {
  const strength = strengths.get(profileId);
  if (strength === undefined) {
    throw new Error(`${profileId} has no rating, so no expectation can be formed`);
  }
  return strength;
}

/**
 * The average club member, with the player themselves left out. Leaving them out is
 * the whole mechanism: the figure then depends only on who they played with and
 * against, never on how good the ladder already thinks they are.
 */
function clubAverage(
  strengths: ReadonlyMap<ProfileId, Strength>,
  exclude: ProfileId,
): Strength {
  let mu = 0;
  let sigma = 0;
  let counted = 0;

  for (const [profileId, strength] of strengths) {
    if (profileId === exclude) continue;
    mu += strength.mu;
    sigma += strength.sigma;
    counted += 1;
  }

  if (counted === 0) {
    throw new Error('an expectation needs at least one other player to average');
  }
  return { mu: mu / counted, sigma: sigma / counted };
}
