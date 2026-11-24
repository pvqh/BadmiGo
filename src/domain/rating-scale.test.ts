import { describe, expect, it } from 'vitest';
import {
  PLACEMENT_GAMES,
  SIGMA_INITIAL,
  displayRating,
  inflateSigmaForIdleTime,
  nextTier,
  seedMu,
  tierFor,
} from './rating-scale';
import type { Tier } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Where sigma actually plateaus at this club's volume, measured by the simulation
 * harness. The tier bands are placed against this, not against a settled-low guess.
 */
const SETTLED_SIGMA = 5.2;

describe('seed tiers', () => {
  const ascending: readonly Tier[] = ['newbie', 'y', 'tby', 'tb-plus', 'kha'];

  it('orders the five declared levels', () => {
    const mus = ascending.map(seedMu);
    expect(mus).toEqual([...mus].sort((a, b) => a - b));
    expect(new Set(mus).size).toBe(ascending.length);
  });

  it('starts every player at full uncertainty, so a seed is only a hint', () => {
    expect(SIGMA_INITIAL).toBeCloseTo(25 / 3, 4);
  });
});

describe('displayRating', () => {
  it('never goes negative', () => {
    expect(displayRating(0, SIGMA_INITIAL)).toBe(0);
    expect(displayRating(5, SIGMA_INITIAL)).toBe(0);
  });

  it('tells the weakest settled players apart instead of flattening them to zero', () => {
    const weakest = displayRating(seedMu('newbie'), SETTLED_SIGMA);
    expect(weakest).toBeGreaterThan(0);
    expect(weakest).toBeLessThan(displayRating(seedMu('y'), SETTLED_SIGMA));
  });

  it('rises with skill and falls with uncertainty', () => {
    expect(displayRating(30, 2)).toBeGreaterThan(displayRating(25, 2));
    expect(displayRating(30, 2)).toBeGreaterThan(displayRating(30, 3));
  });

  it('is a whole number', () => {
    expect(Number.isInteger(displayRating(27.3456, 1.9871))).toBe(true);
  });

  it('places a settled player of each seed level in that seed level band', () => {
    expect(tierFor(displayRating(seedMu('newbie'), SETTLED_SIGMA))).toBe('newbie');
    expect(tierFor(displayRating(seedMu('y'), SETTLED_SIGMA))).toBe('y');
    expect(tierFor(displayRating(seedMu('tby'), SETTLED_SIGMA))).toBe('tby');
    expect(tierFor(displayRating(seedMu('tb-plus'), SETTLED_SIGMA))).toBe('tb-plus');
    expect(tierFor(displayRating(seedMu('kha'), SETTLED_SIGMA))).toBe('kha');
  });
});

describe('tierFor', () => {
  const boundaries: ReadonlyArray<readonly [number, Tier]> = [
    [0, 'newbie'],
    [399, 'newbie'],
    [400, 'y'],
    [599, 'y'],
    [600, 'tby'],
    [879, 'tby'],
    [880, 'tb-plus'],
    [1119, 'tb-plus'],
    [1120, 'kha'],
    [2000, 'kha'],
  ];

  it.each(boundaries)('puts %i in %s', (rating, tier) => {
    expect(tierFor(rating)).toBe(tier);
  });
});

describe('placement', () => {
  it('lasts five games', () => {
    expect(PLACEMENT_GAMES).toBe(5);
  });
});

describe('inflateSigmaForIdleTime', () => {
  const settled = 1.5;

  it('leaves a player who keeps turning up alone', () => {
    expect(inflateSigmaForIdleTime(settled, 0)).toBe(settled);
    expect(inflateSigmaForIdleTime(settled, 7 * DAY_MS)).toBe(settled);
    expect(inflateSigmaForIdleTime(settled, 21 * DAY_MS)).toBe(settled);
  });

  it('makes a player who was away responsive again', () => {
    const afterAMonth = inflateSigmaForIdleTime(settled, 30 * DAY_MS);
    expect(afterAMonth).toBeGreaterThan(settled);
    expect(afterAMonth).toBeLessThan(SIGMA_INITIAL);
  });

  it('inflates further the longer the absence', () => {
    const gaps = [22, 28, 35, 42, 60].map((days) =>
      inflateSigmaForIdleTime(settled, days * DAY_MS),
    );
    expect(gaps).toEqual([...gaps].sort((a, b) => a - b));
  });

  it('never exceeds the uncertainty a brand new player carries', () => {
    expect(inflateSigmaForIdleTime(settled, 3650 * DAY_MS)).toBe(SIGMA_INITIAL);
    expect(inflateSigmaForIdleTime(SIGMA_INITIAL, 3650 * DAY_MS)).toBe(SIGMA_INITIAL);
  });

  it('never deflates a player who is already more uncertain than a newcomer', () => {
    expect(inflateSigmaForIdleTime(SIGMA_INITIAL, 30 * DAY_MS)).toBe(SIGMA_INITIAL);
  });
});

describe('the next tier up', () => {
  it('names the tier above and how far off its floor is', () => {
    expect(nextTier(593)).toEqual({ tier: 'tby', floor: 600, from: 400 });
    expect(nextTier(0)).toEqual({ tier: 'y', floor: 400, from: 0 });
  });

  it('starts counting at a tier floor exactly', () => {
    expect(nextTier(600)).toEqual({ tier: 'tb-plus', floor: 880, from: 600 });
  });

  it('agrees with tierFor about where each band begins', () => {
    for (const rating of [0, 399, 400, 599, 600, 879, 880, 1119]) {
      const next = nextTier(rating);
      expect(next === null ? null : tierFor(next.floor)).toBe(next?.tier ?? null);
      expect(next === null ? null : tierFor(next.floor - 1)).toBe(tierFor(rating));
    }
  });

  it('has nothing above Khá', () => {
    expect(nextTier(1120)).toBeNull();
    expect(nextTier(1500)).toBeNull();
  });
});
