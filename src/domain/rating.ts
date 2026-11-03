import { rate, type Rating, type Team } from 'openskill';
import {
  IDLE_GRACE_DAYS,
  PLACEMENT_GAMES,
  SIGMA_INITIAL,
  displayRating,
  inflateSigmaForIdleTime,
  seedMu,
  tierFor,
} from './rating-scale.ts';
import type { ProfileId, Tier } from './types.ts';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * A confirmed game, as the replay sees it. Scores are carried because the record
 * keeps them, but only which side scored more is ever read: margin of victory is
 * deliberately not an input to the rating.
 */
export interface RatedGame {
  readonly id: string;
  readonly playedAt: number;
  readonly sideA: readonly [ProfileId, ProfileId];
  readonly sideB: readonly [ProfileId, ProfileId];
  readonly scoreA: number;
  readonly scoreB: number;
}

export interface PlayerSeed {
  readonly profileId: ProfileId;
  readonly seedTier: Tier;
}

export interface PlayerRating {
  readonly profileId: ProfileId;
  readonly mu: number;
  readonly sigma: number;
  readonly gamesPlayed: number;
  readonly displayRating: number;
  readonly tier: Tier;
  readonly inPlacement: boolean;
  readonly active: boolean;
  readonly lastPlayedAt: number | null;
}

export interface RatingChange {
  readonly gameId: string;
  readonly profileId: ProfileId;
  readonly muBefore: number;
  readonly muAfter: number;
  readonly displayBefore: number;
  readonly displayAfter: number;
}

export interface ReplayResult {
  /** Already in ladder order: strongest first, ties broken by profile id. */
  readonly ratings: readonly PlayerRating[];
  readonly history: readonly RatingChange[];
}

interface Accumulator {
  mu: number;
  sigma: number;
  gamesPlayed: number;
  lastPlayedAt: number | null;
}

/**
 * The only way a rating is ever produced. Callers pass the confirmed games only —
 * pending, disputed and voided games are filtered out before they get here.
 */
export function replayRatings(input: {
  readonly seeds: readonly PlayerSeed[];
  readonly games: readonly RatedGame[];
  readonly now: number;
}): ReplayResult {
  const players = new Map<ProfileId, Accumulator>();
  for (const seed of input.seeds) {
    players.set(seed.profileId, {
      mu: seedMu(seed.seedTier),
      sigma: SIGMA_INITIAL,
      gamesPlayed: 0,
      lastPlayedAt: null,
    });
  }

  const history: RatingChange[] = [];
  for (const game of inPlayOrder(input.games)) {
    history.push(...rateGame(game, players));
  }

  return { ratings: summarise(players, input.now), history };
}

/** Sorted here rather than trusted from the caller, so the same games cannot drift. */
function inPlayOrder(games: readonly RatedGame[]): readonly RatedGame[] {
  return [...games].sort((left, right) => {
    if (left.playedAt !== right.playedAt) return left.playedAt - right.playedAt;
    if (left.id === right.id) return 0;
    return left.id < right.id ? -1 : 1;
  });
}

function rateGame(game: RatedGame, players: Map<ProfileId, Accumulator>): RatingChange[] {
  const lineup = [...game.sideA, ...game.sideB];
  const playing = lineup.map((profileId) => resolve(players, profileId, game.id));

  const before = playing.map((player) => ({ mu: player.mu, sigma: player.sigma }));

  for (const player of playing) {
    if (player.lastPlayedAt !== null) {
      player.sigma = inflateSigmaForIdleTime(player.sigma, game.playedAt - player.lastPlayedAt);
    }
  }

  const sideA = [playing[0], playing[1]];
  const sideB = [playing[2], playing[3]];
  const sideAWon = game.scoreA > game.scoreB;
  const winningSide = sideAWon ? sideA : sideB;
  const losingSide = sideAWon ? sideB : sideA;

  const [wonRatings, lostRatings] = rate([
    winningSide.map(toRating),
    losingSide.map(toRating),
  ]);
  settle(winningSide, wonRatings, game.playedAt);
  settle(losingSide, lostRatings, game.playedAt);

  return playing.map((player, index) => ({
    gameId: game.id,
    profileId: lineup[index],
    muBefore: before[index].mu,
    muAfter: player.mu,
    displayBefore: displayRating(before[index].mu, before[index].sigma),
    displayAfter: displayRating(player.mu, player.sigma),
  }));
}

function resolve(
  players: Map<ProfileId, Accumulator>,
  profileId: ProfileId,
  gameId: string,
): Accumulator {
  const player = players.get(profileId);
  if (player === undefined) {
    throw new Error(`game ${gameId} names ${profileId}, who has no seed tier`);
  }
  return player;
}

const toRating = (player: Accumulator): Rating => ({ mu: player.mu, sigma: player.sigma });

function settle(side: readonly Accumulator[], rated: Team, playedAt: number): void {
  side.forEach((player, index) => {
    player.mu = rated[index].mu;
    player.sigma = rated[index].sigma;
    player.gamesPlayed += 1;
    player.lastPlayedAt = playedAt;
  });
}

function summarise(
  players: Map<ProfileId, Accumulator>,
  now: number,
): readonly PlayerRating[] {
  const ratings = [...players.entries()].map(([profileId, player]) => {
    const rating = displayRating(player.mu, player.sigma);
    return {
      profileId,
      mu: player.mu,
      sigma: player.sigma,
      gamesPlayed: player.gamesPlayed,
      displayRating: rating,
      tier: tierFor(rating),
      inPlacement: player.gamesPlayed < PLACEMENT_GAMES,
      active:
        player.lastPlayedAt !== null && now - player.lastPlayedAt <= IDLE_GRACE_DAYS * DAY_MS,
      lastPlayedAt: player.lastPlayedAt,
    };
  });

  return ratings.sort((left, right) => {
    if (left.displayRating !== right.displayRating) {
      return right.displayRating - left.displayRating;
    }
    if (left.profileId === right.profileId) return 0;
    return left.profileId < right.profileId ? -1 : 1;
  });
}
