import { describe, expect, it } from 'vitest';
import { standingOf } from './standing';

const ladder = [
  { profile_id: 'a', display_rating: 1200, profiles: { display_name: 'An' } },
  { profile_id: 'b', display_rating: 1150, profiles: { display_name: 'Bình' } },
  { profile_id: 'c', display_rating: 1150, profiles: { display_name: 'Chi' } },
];

describe('standingOf', () => {
  it('names the player one place above and the points between', () => {
    expect(standingOf(ladder, 'b')).toEqual({ rank: 2, next: { name: 'An', gap: 50 } });
  });

  it('has nobody to chase at the top', () => {
    expect(standingOf(ladder, 'a')).toEqual({ rank: 1, next: null });
  });

  it('reports a level rating as a gap of zero', () => {
    expect(standingOf(ladder, 'c')).toEqual({ rank: 3, next: { name: 'Bình', gap: 0 } });
  });

  it('is null for a player who is not ranked', () => {
    expect(standingOf(ladder, 'z')).toBeNull();
  });
});
