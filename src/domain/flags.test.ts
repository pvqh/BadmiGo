import { describe, expect, it } from 'vitest';
import { flagFor, type ReviewedGame } from './flags';
import { AUTO_ACCEPT_MS } from './game-lifecycle';

const LOGGED = Date.UTC(2026, 10, 21, 9);
const HOUR_MS = 60 * 60 * 1000;

function game(fields: Partial<ReviewedGame>): ReviewedGame {
  return {
    status: 'confirmed',
    logger: 'ann',
    loggedAt: LOGGED,
    answers: [
      { profileId: 'ann', respondedAt: LOGGED },
      { profileId: 'bo', respondedAt: LOGGED + HOUR_MS },
      { profileId: 'cy', respondedAt: LOGGED + HOUR_MS },
      { profileId: 'di', respondedAt: LOGGED + HOUR_MS },
    ],
    ...fields,
  };
}

describe('flagFor', () => {
  it('flags nothing on a game the other three confirmed themselves', () => {
    expect(flagFor(game({}))).toBeNull();
  });

  it('flags a disputed game, which only an admin can settle', () => {
    expect(flagFor(game({ status: 'disputed' }))).toBe('disputed');
  });

  it('flags a game the clock accepted when none of the other three ever answered', () => {
    const accepted = LOGGED + AUTO_ACCEPT_MS;
    const flagged = game({
      answers: [
        { profileId: 'ann', respondedAt: LOGGED },
        { profileId: 'bo', respondedAt: accepted },
        { profileId: 'cy', respondedAt: accepted },
        { profileId: 'di', respondedAt: accepted },
      ],
    });
    expect(flagFor(flagged)).toBe('nobody-answered');
  });

  it('does not flag a clock-accepted game that one other player confirmed in time', () => {
    const accepted = LOGGED + AUTO_ACCEPT_MS;
    const vouched = game({
      answers: [
        { profileId: 'ann', respondedAt: LOGGED },
        { profileId: 'bo', respondedAt: LOGGED + HOUR_MS },
        { profileId: 'cy', respondedAt: accepted },
        { profileId: 'di', respondedAt: accepted },
      ],
    });
    expect(flagFor(vouched)).toBeNull();
  });

  it('treats an answer one moment inside the window as a real answer', () => {
    const justInTime = LOGGED + AUTO_ACCEPT_MS - 1;
    const answered = game({
      answers: [
        { profileId: 'ann', respondedAt: LOGGED },
        { profileId: 'bo', respondedAt: justInTime },
        { profileId: 'cy', respondedAt: LOGGED + AUTO_ACCEPT_MS },
        { profileId: 'di', respondedAt: LOGGED + AUTO_ACCEPT_MS },
      ],
    });
    expect(flagFor(answered)).toBeNull();
  });

  it('never flags a pending or voided game: one is not settled, the other is gone', () => {
    expect(flagFor(game({ status: 'pending' }))).toBeNull();
    expect(flagFor(game({ status: 'voided' }))).toBeNull();
  });
});
