import { describe, expect, it } from 'vitest';
import { PLACEMENT_GAMES, SIGMA_INITIAL, seedMu } from './rating-scale';
import { replayRatings, type PlayerRating, type RatedGame } from './rating';
import type { ProfileId, Tier } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;
const SEASON_START = Date.UTC(2026, 0, 3);

const day = (n: number) => SEASON_START + n * DAY_MS;

const STRONG = ['sam', 'sia'] as const;
const WEAK = ['wes', 'wren'] as const;

const SEED_TIERS: Readonly<Record<ProfileId, Tier>> = {
  sam: 'kha',
  sia: 'kha',
  wes: 'newbie',
  wren: 'newbie',
};

function seeds(tiers: Readonly<Record<ProfileId, Tier>> = SEED_TIERS) {
  return Object.entries(tiers).map(([profileId, seedTier]) => ({ profileId, seedTier }));
}

function game(fields: {
  id: string;
  playedAt?: number;
  sideA: readonly [ProfileId, ProfileId];
  sideB: readonly [ProfileId, ProfileId];
  scoreA?: number;
  scoreB?: number;
}): RatedGame {
  return {
    playedAt: day(0),
    scoreA: 21,
    scoreB: 15,
    ...fields,
  };
}

function ratingOf(ratings: readonly PlayerRating[], profileId: ProfileId): PlayerRating {
  const found = ratings.find((rating) => rating.profileId === profileId);
  if (found === undefined) throw new Error(`${profileId} is missing from the replay output`);
  return found;
}

/** The same four players meeting repeatedly on one day, side A always winning. */
function repeatedGames(count: number, playedAt = day(0)): RatedGame[] {
  return Array.from({ length: count }, (_, index) =>
    game({ id: `g${index + 1}`, playedAt, sideA: STRONG, sideB: WEAK }),
  );
}

describe('seeding', () => {
  it('starts every player at full uncertainty in their declared order', () => {
    const { ratings } = replayRatings({
      seeds: seeds({ a: 'newbie', b: 'y', c: 'tby', d: 'tb-plus', e: 'kha' }),
      games: [],
      now: day(0),
    });

    const mus = ['a', 'b', 'c', 'd', 'e'].map((id) => ratingOf(ratings, id).mu);
    expect(mus).toEqual([...mus].sort((x, y) => x - y));
    for (const rating of ratings) {
      expect(rating.sigma).toBeCloseTo(SIGMA_INITIAL, 6);
      expect(rating.gamesPlayed).toBe(0);
    }
  });

  it('reports a player who has never played as inactive and in placement', () => {
    const { ratings } = replayRatings({ seeds: seeds(), games: [], now: day(0) });
    const sam = ratingOf(ratings, 'sam');
    expect(sam.active).toBe(false);
    expect(sam.inPlacement).toBe(true);
    expect(sam.lastPlayedAt).toBeNull();
  });
});

describe('surprise asymmetry', () => {
  it('barely moves a favourite who beat a much weaker pair', () => {
    const expected = replayRatings({
      seeds: seeds(),
      games: [game({ id: 'g1', sideA: STRONG, sideB: WEAK })],
      now: day(0),
    });
    const upset = replayRatings({
      seeds: seeds(),
      games: [game({ id: 'g1', sideA: WEAK, sideB: STRONG })],
      now: day(0),
    });

    const favouriteGain = ratingOf(expected.ratings, 'sam').mu - seedMu('kha');
    const underdogGain = ratingOf(upset.ratings, 'wes').mu - seedMu('newbie');

    expect(favouriteGain).toBeGreaterThan(0);
    expect(underdogGain).toBeGreaterThan(favouriteGain * 3);
  });

  it('costs a favourite more for losing than it rewards them for winning', () => {
    const won = replayRatings({
      seeds: seeds(),
      games: [game({ id: 'g1', sideA: STRONG, sideB: WEAK })],
      now: day(0),
    });
    const lost = replayRatings({
      seeds: seeds(),
      games: [game({ id: 'g1', sideA: WEAK, sideB: STRONG })],
      now: day(0),
    });

    const gain = ratingOf(won.ratings, 'sam').mu - seedMu('kha');
    const loss = seedMu('kha') - ratingOf(lost.ratings, 'sam').mu;

    expect(loss).toBeGreaterThan(gain);
  });
});

describe('uncertainty asymmetry', () => {
  it('moves a player further in their first game than in their twenty-first', () => {
    const { history } = replayRatings({
      seeds: seeds(),
      games: repeatedGames(21),
      now: day(0),
    });

    const samMoves = history.filter((change) => change.profileId === 'sam');
    const firstMove = Math.abs(samMoves[0].muAfter - samMoves[0].muBefore);
    const lastMove = Math.abs(samMoves[20].muAfter - samMoves[20].muBefore);

    expect(samMoves).toHaveLength(21);
    expect(firstMove).toBeGreaterThan(lastMove);
  });

  it('narrows uncertainty as games accumulate', () => {
    const { ratings } = replayRatings({ seeds: seeds(), games: repeatedGames(21), now: day(0) });
    expect(ratingOf(ratings, 'sam').sigma).toBeLessThan(SIGMA_INITIAL);
  });
});

describe('placement', () => {
  it('ends on exactly the tenth game', () => {
    const upTo = (count: number) =>
      ratingOf(
        replayRatings({ seeds: seeds(), games: repeatedGames(count), now: day(0) }).ratings,
        'sam',
      );

    expect(upTo(PLACEMENT_GAMES - 1).inPlacement).toBe(true);
    expect(upTo(PLACEMENT_GAMES - 1).gamesPlayed).toBe(PLACEMENT_GAMES - 1);
    expect(upTo(PLACEMENT_GAMES).inPlacement).toBe(false);
    expect(upTo(PLACEMENT_GAMES).gamesPlayed).toBe(PLACEMENT_GAMES);
  });
});

describe('margin of victory', () => {
  it('rates a 21-0 win exactly the same as a 21-19 win', () => {
    const thrashing = replayRatings({
      seeds: seeds(),
      games: [game({ id: 'g1', sideA: STRONG, sideB: WEAK, scoreA: 21, scoreB: 0 })],
      now: day(0),
    });
    const squeaker = replayRatings({
      seeds: seeds(),
      games: [game({ id: 'g1', sideA: STRONG, sideB: WEAK, scoreA: 21, scoreB: 19 })],
      now: day(0),
    });

    expect(thrashing).toEqual(squeaker);
  });

  it('reads the winner from the score rather than the side order', () => {
    const sideAWon = replayRatings({
      seeds: seeds(),
      games: [game({ id: 'g1', sideA: STRONG, sideB: WEAK, scoreA: 21, scoreB: 15 })],
      now: day(0),
    });
    const sideBWon = replayRatings({
      seeds: seeds(),
      games: [game({ id: 'g1', sideA: WEAK, sideB: STRONG, scoreA: 15, scoreB: 21 })],
      now: day(0),
    });

    expect(ratingOf(sideAWon.ratings, 'sam').mu).toBeCloseTo(
      ratingOf(sideBWon.ratings, 'sam').mu,
      9,
    );
  });
});

describe('inactivity', () => {
  it('widens a returning player uncertainty rather than leaving it settled', () => {
    const weekly = [...repeatedGames(10), game({ id: 'last', playedAt: day(7), sideA: STRONG, sideB: WEAK })];
    const afterAnAbsence = [
      ...repeatedGames(10),
      game({ id: 'last', playedAt: day(60), sideA: STRONG, sideB: WEAK }),
    ];

    const kept = replayRatings({ seeds: seeds(), games: weekly, now: day(60) });
    const returned = replayRatings({ seeds: seeds(), games: afterAnAbsence, now: day(60) });

    expect(ratingOf(returned.ratings, 'sam').sigma).toBeGreaterThan(
      ratingOf(kept.ratings, 'sam').sigma,
    );
  });

  it('preserves the rating of a player who stopped turning up', () => {
    const played = replayRatings({ seeds: seeds(), games: repeatedGames(10), now: day(0) });
    const muchLater = replayRatings({ seeds: seeds(), games: repeatedGames(10), now: day(365) });

    expect(ratingOf(muchLater.ratings, 'sam').mu).toBe(ratingOf(played.ratings, 'sam').mu);
    expect(ratingOf(muchLater.ratings, 'sam').sigma).toBe(ratingOf(played.ratings, 'sam').sigma);
  });

  it('drops a player off the active ladder once they stop playing', () => {
    const games = repeatedGames(10);
    expect(ratingOf(replayRatings({ seeds: seeds(), games, now: day(20) }).ratings, 'sam').active).toBe(
      true,
    );
    expect(ratingOf(replayRatings({ seeds: seeds(), games, now: day(30) }).ratings, 'sam').active).toBe(
      false,
    );
  });
});

describe('determinism', () => {
  it('produces identical output however the games arrive', () => {
    const games = [
      game({ id: 'c', playedAt: day(2), sideA: STRONG, sideB: WEAK }),
      game({ id: 'a', playedAt: day(0), sideA: [STRONG[0], WEAK[0]] as const, sideB: [STRONG[1], WEAK[1]] as const }),
      game({ id: 'b', playedAt: day(1), sideA: WEAK, sideB: STRONG }),
    ];

    const inOrder = replayRatings({ seeds: seeds(), games: [...games].reverse(), now: day(5) });
    const shuffled = replayRatings({ seeds: seeds(), games, now: day(5) });

    expect(shuffled).toEqual(inOrder);
  });

  it('orders games played at the same instant by id, so a tie cannot drift', () => {
    const sameInstant = [
      game({ id: 'b', sideA: WEAK, sideB: STRONG }),
      game({ id: 'a', sideA: STRONG, sideB: WEAK }),
    ];

    const first = replayRatings({ seeds: seeds(), games: sameInstant, now: day(0) });
    const second = replayRatings({ seeds: seeds(), games: [...sameInstant].reverse(), now: day(0) });

    expect(first).toEqual(second);
    expect(first.history.map((change) => change.gameId)).toEqual(['a', 'a', 'a', 'a', 'b', 'b', 'b', 'b']);
  });

  it('repeats exactly when run twice', () => {
    const input = { seeds: seeds(), games: repeatedGames(12), now: day(3) };
    expect(replayRatings(input)).toEqual(replayRatings(input));
  });
});

describe('history', () => {
  it('records one row per participant per game', () => {
    const { history } = replayRatings({ seeds: seeds(), games: repeatedGames(3), now: day(0) });
    expect(history).toHaveLength(12);
  });

  it('leaves no gap between a player consecutive games, so a graph can be drawn', () => {
    const { history } = replayRatings({ seeds: seeds(), games: repeatedGames(5), now: day(0) });
    const samMoves = history.filter((change) => change.profileId === 'sam');

    for (let index = 1; index < samMoves.length; index += 1) {
      expect(samMoves[index].muBefore).toBe(samMoves[index - 1].muAfter);
      expect(samMoves[index].displayBefore).toBe(samMoves[index - 1].displayAfter);
    }
  });

  it('starts a player first row at their seed', () => {
    const { history } = replayRatings({ seeds: seeds(), games: repeatedGames(1), now: day(0) });
    const samFirst = history.find((change) => change.profileId === 'sam');
    expect(samFirst?.muBefore).toBe(seedMu('kha'));
  });
});

describe('unknown players', () => {
  it('refuses a game naming someone with no seed, rather than inventing one', () => {
    expect(() =>
      replayRatings({
        seeds: seeds({ sam: 'kha', sia: 'kha', wes: 'newbie' }),
        games: [game({ id: 'g1', sideA: STRONG, sideB: WEAK })],
        now: day(0),
      }),
    ).toThrow(/wren/);
  });
});

