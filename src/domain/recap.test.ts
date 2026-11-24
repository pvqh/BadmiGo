import { describe, expect, it } from 'vitest';
import { recapFor } from './recap';
import type { RatedGame, RatingChange } from './rating';
import type { ProfileId } from './types';

const SATURDAY = Date.UTC(2026, 10, 21, 9);
const HOUR_MS = 60 * 60 * 1000;

function game(
  id: string,
  playedAt: number,
  sideA: readonly [ProfileId, ProfileId],
  sideB: readonly [ProfileId, ProfileId],
  scoreA: number,
  scoreB: number,
): RatedGame {
  return { id, playedAt, sideA, sideB, scoreA, scoreB };
}

function change(gameId: string, displayBefore: number, displayAfter: number): RatingChange {
  return { gameId, profileId: 'ann', muBefore: 0, muAfter: 0, displayBefore, displayAfter };
}

describe('recapFor', () => {
  it('counts the games and wins and the rating from first to last', () => {
    const games = [
      game('g1', SATURDAY, ['ann', 'bo'], ['cy', 'di'], 21, 15),
      game('g2', SATURDAY + HOUR_MS, ['cy', 'ann'], ['bo', 'di'], 18, 21),
      game('g3', SATURDAY + 24 * HOUR_MS, ['bo', 'di'], ['ann', 'cy'], 19, 21),
    ];
    const changes = [change('g1', 600, 612), change('g2', 612, 604), change('g3', 604, 615)];

    expect(recapFor({ profileId: 'ann', games, changes })).toEqual({
      games: 3,
      wins: 2,
      ratingBefore: 600,
      ratingAfter: 615,
    });
  });

  it('orders by when the games were played, not the order they arrive in', () => {
    const games = [
      game('late', SATURDAY + HOUR_MS, ['ann', 'bo'], ['cy', 'di'], 21, 15),
      game('early', SATURDAY, ['ann', 'bo'], ['cy', 'di'], 21, 15),
    ];
    const changes = [change('late', 610, 620), change('early', 600, 610)];

    const recap = recapFor({ profileId: 'ann', games, changes });
    expect(recap?.ratingBefore).toBe(600);
    expect(recap?.ratingAfter).toBe(620);
  });

  it('ignores games the player was not in', () => {
    const games = [
      game('not-hers', SATURDAY, ['bo', 'cy'], ['di', 'ed'], 21, 15),
      game('hers', SATURDAY, ['ann', 'bo'], ['cy', 'di'], 15, 21),
    ];
    const changes = [change('hers', 600, 590)];

    expect(recapFor({ profileId: 'ann', games, changes })).toEqual({
      games: 1,
      wins: 0,
      ratingBefore: 600,
      ratingAfter: 590,
    });
  });

  it('has nothing to say to a player who did not play', () => {
    const games = [game('g1', SATURDAY, ['bo', 'cy'], ['di', 'ed'], 21, 15)];
    expect(recapFor({ profileId: 'ann', games, changes: [] })).toBeNull();
  });
});
