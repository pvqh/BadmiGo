import { describe, expect, it } from 'vitest';
import { PLACEMENT_GAMES, tierFor } from '../domain/rating-scale';
import { replayRatings, type PlayerRating } from '../domain/rating';
import { TIERS } from '../domain/types';
import { simulateSeason, syntheticClub, type SyntheticPlayer } from './club';

const SEED = 20261103;

const club = syntheticClub(SEED);
const season = simulateSeason(club, { seed: SEED });
const seasonEnd = Math.max(...season.map((game) => game.playedAt));

function replay(games: readonly typeof season[number][], seeded = true) {
  return replayRatings({
    seeds: club.map((player) => ({
      profileId: player.profileId,
      seedTier: seeded ? player.seedTier : 'tby',
    })),
    games,
    now: seasonEnd,
  });
}

function ranked(ratings: readonly PlayerRating[]): readonly PlayerRating[] {
  return ratings.filter((rating) => !rating.inPlacement);
}

function recovery(ratings: readonly PlayerRating[]): number {
  const trueSkill = new Map(club.map((player) => [player.profileId, player.trueSkill]));
  return spearman(
    ranked(ratings).map((rating) => [trueSkill.get(rating.profileId) ?? 0, rating.displayRating]),
  );
}

function truePlayer(profileId: string): SyntheticPlayer {
  const found = club.find((player) => player.profileId === profileId);
  if (found === undefined) throw new Error(`${profileId} is not in the synthetic club`);
  return found;
}

describe('the club this app is for', () => {
  it('plays roughly three hundred games a month', () => {
    expect(season.length).toBeGreaterThan(250);
    expect(season.length).toBeLessThan(360);
  });

  it('gives everyone enough games to leave placement', () => {
    const { ratings } = replay(season);
    expect(ranked(ratings)).toHaveLength(club.length);
  });
});

describe('ranking recovery', () => {
  it('recovers the true ranking it was never told', () => {
    const correlation = recovery(replay(season).ratings);
    expect(correlation).toBeGreaterThan(0.8);
  });

  it('is already usable by the end of placement', () => {
    const { ratings } = replay(gamesUntilEveryoneHasPlayed(PLACEMENT_GAMES));
    expect(recovery(ratings)).toBeGreaterThan(0.6);
  });

  /**
   * The harness showed recovery reaching its ceiling as soon as the club leaves
   * placement and then holding, rather than climbing all month. The ceiling is the
   * carrying problem the spec calls out: OpenSkill cannot tell a strong player from
   * a weak one who is reliably partnered with strong ones.
   */
  it('settles within the first third of a month and then holds', () => {
    const [early, whole] = [1 / 3, 1].map((fraction) =>
      recovery(replay(season.slice(0, Math.floor(season.length * fraction))).ratings),
    );

    expect(early).toBeGreaterThan(0.75);
    expect(whole).toBeGreaterThan(early - 0.05);
  });

  it('is helped, not hurt, by letting players declare a seed tier', () => {
    const upToPlacement = gamesUntilEveryoneHasPlayed(PLACEMENT_GAMES);
    const seeded = recovery(replay(upToPlacement, true).ratings);
    const unseeded = recovery(replay(upToPlacement, false).ratings);
    expect(seeded).toBeGreaterThan(unseeded);
  });
});

describe('tier bands', () => {
  it('gives every ranked player a number the ladder can tell apart', () => {
    const { ratings } = replay(season);
    const flattened = ranked(ratings).filter((rating) => rating.displayRating === 0);
    expect(flattened).toEqual([]);
  });

  it('labels almost everyone within one tier of the level they declared', () => {
    const players = ranked(replay(season).ratings);
    const close = players.filter((rating) => {
      const got = TIERS.indexOf(rating.tier);
      const declared = TIERS.indexOf(truePlayer(rating.profileId).seedTier);
      return Math.abs(got - declared) <= 1;
    });

    expect(close.length / players.length).toBeGreaterThan(0.9);
  });

  it('separates the club levels in the right order', () => {
    const { ratings } = replay(season);
    const medians = TIERS.map((tier) =>
      median(
        ranked(ratings)
          .filter((rating) => truePlayer(rating.profileId).seedTier === tier)
          .map((rating) => rating.displayRating),
      ),
    );

    expect(medians).toEqual([...medians].sort((left, right) => left - right));
  });

  it('reports where the bands actually fall, for the Decision Log', () => {
    const { ratings } = replay(season);
    const rows = TIERS.map((tier) => {
      const displays = ranked(ratings)
        .filter((rating) => truePlayer(rating.profileId).seedTier === tier)
        .map((rating) => rating.displayRating)
        .sort((left, right) => left - right);
      return {
        trueTier: tier,
        n: displays.length,
        min: displays[0],
        median: median(displays),
        max: displays[displays.length - 1],
        landedIn: [...new Set(displays.map(tierFor))].join(', '),
      };
    });

    console.table(rows);
    console.log('games simulated:', season.length);
    console.log('ranking recovery (Spearman):', recovery(ratings).toFixed(3));
    expect(rows).toHaveLength(TIERS.length);
  });
});

/** The earliest prefix of the season in which every player has reached `target` games. */
function gamesUntilEveryoneHasPlayed(target: number): readonly typeof season[number][] {
  const played = new Map<string, number>();
  for (let count = 0; count < season.length; count += 1) {
    const game = season[count];
    for (const profileId of [...game.sideA, ...game.sideB]) {
      played.set(profileId, (played.get(profileId) ?? 0) + 1);
    }
    const everyone = club.every((player) => (played.get(player.profileId) ?? 0) >= target);
    if (everyone) return season.slice(0, count + 1);
  }
  return season;
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function spearman(pairs: ReadonlyArray<readonly [number, number]>): number {
  const left = ranksOf(pairs.map((pair) => pair[0]));
  const right = ranksOf(pairs.map((pair) => pair[1]));
  return pearson(left, right);
}

/** Average ranks, so tied display ratings do not bias the correlation. */
function ranksOf(values: readonly number[]): readonly number[] {
  const order = values
    .map((value, index) => ({ value, index }))
    .sort((a, b) => a.value - b.value);

  const ranks = new Array<number>(values.length);
  let position = 0;
  while (position < order.length) {
    let end = position;
    while (end + 1 < order.length && order[end + 1].value === order[position].value) end += 1;
    const shared = (position + end) / 2 + 1;
    for (let index = position; index <= end; index += 1) ranks[order[index].index] = shared;
    position = end + 1;
  }
  return ranks;
}

function pearson(left: readonly number[], right: readonly number[]): number {
  const n = left.length;
  const meanLeft = left.reduce((sum, value) => sum + value, 0) / n;
  const meanRight = right.reduce((sum, value) => sum + value, 0) / n;

  let covariance = 0;
  let varianceLeft = 0;
  let varianceRight = 0;
  for (let index = 0; index < n; index += 1) {
    const dLeft = left[index] - meanLeft;
    const dRight = right[index] - meanRight;
    covariance += dLeft * dRight;
    varianceLeft += dLeft * dLeft;
    varianceRight += dRight * dRight;
  }

  return covariance / Math.sqrt(varianceLeft * varianceRight);
}
