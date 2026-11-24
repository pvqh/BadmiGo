import { describe, expect, it } from 'vitest';
import type { GameFormat } from './types';
import { validateProposedGame, validateScore } from './validation';

const LINEUP = { sideA: ['ann', 'bo'], sideB: ['cal', 'dee'] } as const;

function game(fields: Partial<Parameters<typeof validateProposedGame>[0]> = {}) {
  return { format: 21 as GameFormat, ...LINEUP, scoreA: 21, scoreB: 15, ...fields };
}

describe('validateScore', () => {
  const cases: ReadonlyArray<readonly [GameFormat, readonly [number, number][], readonly [number, number][]]> = [
    [
      31,
      [[31, 0], [31, 29], [32, 30], [35, 33], [39, 37], [40, 39]],
      [[31, 30], [31, 31], [30, 29], [32, 29], [40, 38], [41, 39], [21, 15]],
    ],
    [
      21,
      [[21, 0], [21, 19], [22, 20], [25, 23], [29, 27], [30, 29]],
      [[21, 20], [21, 21], [20, 19], [22, 19], [23, 20], [30, 28], [31, 29], [32, 30]],
    ],
    [
      15,
      [[15, 0], [15, 13], [16, 14], [20, 18], [21, 20]],
      [[15, 14], [16, 13], [14, 13], [21, 19], [22, 20], [30, 29]],
    ],
    [
      11,
      [[11, 0], [11, 9], [12, 10], [14, 12], [15, 14]],
      [[11, 10], [12, 9], [10, 9], [15, 13], [16, 14], [21, 19]],
    ],
  ];

  for (const [format, valid, invalid] of cases) {
    describe(`to ${format}`, () => {
      it.each(valid)(`accepts %i-%i`, (winner, loser) => {
        expect(validateScore(format, winner, loser)).toBe(true);
      });

      it.each(valid)(`accepts %i-%i with the sides swapped`, (winner, loser) => {
        expect(validateScore(format, loser, winner)).toBe(true);
      });

      it.each(invalid)(`rejects %i-%i`, (a, b) => {
        expect(validateScore(format, a, b)).toBe(false);
        expect(validateScore(format, b, a)).toBe(false);
      });
    });
  }

  it('rejects a draw', () => {
    expect(validateScore(21, 21, 21)).toBe(false);
    expect(validateScore(21, 0, 0)).toBe(false);
  });

  it('rejects negative and fractional scores', () => {
    expect(validateScore(21, 21, -1)).toBe(false);
    expect(validateScore(21, 21.5, 15)).toBe(false);
    expect(validateScore(21, 21, Number.NaN)).toBe(false);
  });
});

describe('validateProposedGame', () => {
  it('accepts four distinct players, two per side, and a legal score', () => {
    expect(validateProposedGame(game())).toEqual([]);
  });

  it('reports a side without exactly two players', () => {
    expect(validateProposedGame(game({ sideA: ['ann'] }))).toEqual([
      { kind: 'side-size', side: 'a', count: 1 },
    ]);
    expect(validateProposedGame(game({ sideB: ['cal', 'dee', 'eve'] }))).toEqual([
      { kind: 'side-size', side: 'b', count: 3 },
    ]);
    expect(validateProposedGame(game({ sideA: [], sideB: [] }))).toEqual([
      { kind: 'side-size', side: 'a', count: 0 },
      { kind: 'side-size', side: 'b', count: 0 },
    ]);
  });

  it('reports a player named twice on the same side', () => {
    expect(validateProposedGame(game({ sideA: ['ann', 'ann'] }))).toEqual([
      { kind: 'duplicate-player', profileId: 'ann' },
    ]);
  });

  it('reports a player named on both sides', () => {
    expect(validateProposedGame(game({ sideB: ['ann', 'dee'] }))).toEqual([
      { kind: 'duplicate-player', profileId: 'ann' },
    ]);
  });

  it('reports an illegal score', () => {
    expect(validateProposedGame(game({ scoreA: 21, scoreB: 20 }))).toEqual([
      { kind: 'invalid-score', format: 21 },
    ]);
  });

  it('reports every problem at once so the logger sees all of them', () => {
    expect(validateProposedGame(game({ sideA: ['ann'], sideB: ['ann', 'ann'], scoreB: 20 }))).toEqual([
      { kind: 'side-size', side: 'a', count: 1 },
      { kind: 'duplicate-player', profileId: 'ann' },
      { kind: 'invalid-score', format: 21 },
    ]);
  });
});
