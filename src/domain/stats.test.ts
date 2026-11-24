import { describe, expect, it } from 'vitest';
import {
  headToHead,
  partnerBreakdown,
  performanceVsExpectation,
  record,
  type Strength,
} from './stats';
import type { RatedGame } from './rating';
import type { ProfileId } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;
const SEASON_START = Date.UTC(2026, 0, 3);

function game(fields: {
  id: string;
  sideA: readonly [ProfileId, ProfileId];
  sideB: readonly [ProfileId, ProfileId];
  scoreA: number;
  scoreB: number;
  playedAt?: number;
}): RatedGame {
  return { playedAt: SEASON_START, ...fields };
}

/**
 * Hand-computed fixture. Alice plays four games: she wins with bob and loses with
 * him, wins with cara, and loses with eve.
 */
const FIXTURE: readonly RatedGame[] = [
  game({ id: 'g1', sideA: ['alice', 'bob'], sideB: ['cara', 'dan'], scoreA: 21, scoreB: 15 }),
  game({ id: 'g2', sideA: ['alice', 'bob'], sideB: ['cara', 'dan'], scoreA: 15, scoreB: 21 }),
  game({ id: 'g3', sideA: ['alice', 'cara'], sideB: ['bob', 'dan'], scoreA: 21, scoreB: 11 }),
  game({ id: 'g4', sideA: ['eve', 'alice'], sideB: ['bob', 'cara'], scoreA: 11, scoreB: 21 }),
];

const EVEN: Strength = { mu: 25, sigma: 5 };

function strengths(entries: Readonly<Record<ProfileId, Strength>>) {
  return new Map(Object.entries(entries));
}

describe('win/loss record', () => {
  it('counts only the games the player appeared in', () => {
    expect(record(FIXTURE, 'alice')).toEqual({ played: 4, won: 2, lost: 2 });
    expect(record(FIXTURE, 'eve')).toEqual({ played: 1, won: 0, lost: 1 });
  });

  it('reads a win from the score rather than the side', () => {
    expect(record(FIXTURE, 'bob')).toEqual({ played: 4, won: 2, lost: 2 });
  });

  it('is all zeroes for a player who has not played', () => {
    expect(record(FIXTURE, 'frank')).toEqual({ played: 0, won: 0, lost: 0 });
  });
});

describe('partner breakdown', () => {
  it('counts each partner, best win rate first', () => {
    expect(partnerBreakdown(FIXTURE, 'alice')).toEqual([
      { partnerId: 'cara', played: 1, won: 1, lost: 0 },
      { partnerId: 'bob', played: 2, won: 1, lost: 1 },
      { partnerId: 'eve', played: 1, won: 0, lost: 1 },
    ]);
  });

  it('never counts an opponent as a partner', () => {
    expect(partnerBreakdown(FIXTURE, 'eve').map((entry) => entry.partnerId)).toEqual(['alice']);
  });

  it('breaks a win-rate tie by the number of games played', () => {
    const games = [
      game({ id: 'a', sideA: ['alice', 'bob'], sideB: ['cara', 'dan'], scoreA: 21, scoreB: 9 }),
      game({ id: 'b', sideA: ['alice', 'eve'], sideB: ['cara', 'dan'], scoreA: 21, scoreB: 9 }),
      game({ id: 'c', sideA: ['alice', 'eve'], sideB: ['cara', 'dan'], scoreA: 21, scoreB: 9 }),
    ];
    expect(partnerBreakdown(games, 'alice').map((entry) => entry.partnerId)).toEqual([
      'eve',
      'bob',
    ]);
  });
});

describe('head to head', () => {
  it('counts each opponent, most-played rivalry first', () => {
    expect(headToHead(FIXTURE, 'alice')).toEqual([
      { opponentId: 'cara', played: 3, won: 1, lost: 2 },
      { opponentId: 'dan', played: 3, won: 2, lost: 1 },
      { opponentId: 'bob', played: 2, won: 1, lost: 1 },
    ]);
  });
});

describe('performance vs expectation', () => {
  it('is null for a player who has not played', () => {
    expect(
      performanceVsExpectation({
        games: FIXTURE,
        profileId: 'frank',
        strengths: strengths({ alice: EVEN, bob: EVEN, cara: EVEN, dan: EVEN, eve: EVEN }),
      }),
    ).toBeNull();
  });

  it('is near zero when an evenly matched player wins exactly half', () => {
    const games = [
      game({ id: 'a', sideA: ['alice', 'bob'], sideB: ['cara', 'dan'], scoreA: 21, scoreB: 15 }),
      game({ id: 'b', sideA: ['alice', 'bob'], sideB: ['cara', 'dan'], scoreA: 15, scoreB: 21 }),
    ];
    const result = performanceVsExpectation({
      games,
      profileId: 'alice',
      strengths: strengths({ alice: EVEN, bob: EVEN, cara: EVEN, dan: EVEN }),
    });

    expect(result).not.toBeNull();
    expect(result?.perGame).toBeCloseTo(0, 2);
  });

  it('credits a player who wins more than their partner and opponents predict', () => {
    const games = [
      game({ id: 'a', sideA: ['alice', 'weak'], sideB: ['ace', 'star'], scoreA: 21, scoreB: 15 }),
      game({ id: 'b', sideA: ['alice', 'weak'], sideB: ['ace', 'star'], scoreA: 21, scoreB: 15 }),
    ];
    const result = performanceVsExpectation({
      games,
      profileId: 'alice',
      strengths: strengths({
        alice: EVEN,
        weak: { mu: 14, sigma: 4 },
        ace: { mu: 34, sigma: 4 },
        star: { mu: 34, sigma: 4 },
      }),
    });

    expect(result?.perGame).toBeGreaterThan(0.4);
  });

  it('debits a player carried by a strong partner who still loses', () => {
    const games = [
      game({ id: 'a', sideA: ['alice', 'star'], sideB: ['weak', 'tiny'], scoreA: 15, scoreB: 21 }),
      game({ id: 'b', sideA: ['alice', 'star'], sideB: ['weak', 'tiny'], scoreA: 15, scoreB: 21 }),
    ];
    const result = performanceVsExpectation({
      games,
      profileId: 'alice',
      strengths: strengths({
        alice: EVEN,
        star: { mu: 34, sigma: 4 },
        weak: { mu: 14, sigma: 4 },
        tiny: { mu: 14, sigma: 4 },
      }),
    });

    expect(result?.perGame).toBeLessThan(-0.4);
  });

  it('cannot be inherited from a partner: a player own rating never moves it', () => {
    const games = [
      game({ id: 'a', sideA: ['alice', 'star'], sideB: ['weak', 'tiny'], scoreA: 21, scoreB: 15 }),
    ];
    const club = { star: { mu: 34, sigma: 4 }, weak: { mu: 14, sigma: 4 }, tiny: EVEN };

    const asNewbie = performanceVsExpectation({
      games,
      profileId: 'alice',
      strengths: strengths({ ...club, alice: { mu: 16, sigma: 8.3333 } }),
    });
    const asChampion = performanceVsExpectation({
      games,
      profileId: 'alice',
      strengths: strengths({ ...club, alice: { mu: 36, sigma: 2 } }),
    });

    expect(asNewbie).toEqual(asChampion);
  });

  it('counts a win as one and a loss as zero against the expected total', () => {
    const games = [
      game({ id: 'a', sideA: ['alice', 'bob'], sideB: ['cara', 'dan'], scoreA: 21, scoreB: 15 }),
      game({
        id: 'b',
        sideA: ['alice', 'bob'],
        sideB: ['cara', 'dan'],
        scoreA: 21,
        scoreB: 15,
        playedAt: SEASON_START + DAY_MS,
      }),
    ];
    const result = performanceVsExpectation({
      games,
      profileId: 'alice',
      strengths: strengths({ alice: EVEN, bob: EVEN, cara: EVEN, dan: EVEN }),
    });

    expect(result?.games).toBe(2);
    expect(result?.wins).toBe(2);
    expect(result?.expectedWins).toBeCloseTo(1, 2);
    expect(result?.perGame).toBeCloseTo(0.5, 2);
  });

  it('refuses a game naming a player it has no strength for', () => {
    expect(() =>
      performanceVsExpectation({
        games: FIXTURE,
        profileId: 'alice',
        strengths: strengths({ alice: EVEN, bob: EVEN, cara: EVEN }),
      }),
    ).toThrow(/dan/);
  });
});
