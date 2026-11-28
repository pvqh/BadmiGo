import { describe, expect, it } from 'vitest';
import {
  applyEvent,
  countsTowardRatings,
  openGame,
  type GameEvent,
  type GameState,
  type Transition,
} from './game-lifecycle';

const PARTICIPANTS = ['ann', 'bo', 'cal', 'dee'] as const;

function pending(): GameState {
  return openGame({ logger: 'ann', participants: PARTICIPANTS });
}

function expectOk(transition: Transition): GameState {
  if (!transition.ok) throw new Error(`expected a legal transition, got ${transition.reason}`);
  return transition.state;
}

/** Drives a game out of pending, so the transitions out of each later status can be tested. */
function stateWith(status: GameState['status']): GameState {
  switch (status) {
    case 'pending':
      return pending();
    case 'confirmed':
      return ['bo', 'cal', 'dee'].reduce(
        (game, profileId) => expectOk(applyEvent(game, { kind: 'confirm', profileId })),
        pending(),
      );
    case 'disputed':
      return expectOk(applyEvent(pending(), { kind: 'dispute', profileId: 'bo' }));
    case 'voided':
      return expectOk(applyEvent(pending(), { kind: 'void', reason: 'did not happen' }));
  }
}

describe('openGame', () => {
  it('starts pending with the logger already counted as confirmed', () => {
    const game = pending();
    expect(game.status).toBe('pending');
    expect(game.confirmations).toEqual({
      ann: 'confirmed',
      bo: 'pending',
      cal: 'pending',
      dee: 'pending',
    });
  });

  it('moves nobody until it is confirmed', () => {
    expect(countsTowardRatings(pending())).toBe(false);
  });
});

describe('confirming', () => {
  it('stays pending until the last participant responds', () => {
    let game = pending();
    game = expectOk(applyEvent(game, { kind: 'confirm', profileId: 'bo' }));
    expect(game.status).toBe('pending');
    game = expectOk(applyEvent(game, { kind: 'confirm', profileId: 'cal' }));
    expect(game.status).toBe('pending');
    game = expectOk(applyEvent(game, { kind: 'confirm', profileId: 'dee' }));
    expect(game.status).toBe('confirmed');
    expect(countsTowardRatings(game)).toBe(true);
  });

  it('refuses someone who was not in the game', () => {
    expect(applyEvent(pending(), { kind: 'confirm', profileId: 'eve' })).toEqual({
      ok: false,
      reason: 'not-a-participant',
    });
  });

  it('refuses a second response from the same participant', () => {
    const game = expectOk(applyEvent(pending(), { kind: 'confirm', profileId: 'bo' }));
    expect(applyEvent(game, { kind: 'confirm', profileId: 'bo' })).toEqual({
      ok: false,
      reason: 'already-responded',
    });
  });

  it('refuses the logger, who is already confirmed', () => {
    expect(applyEvent(pending(), { kind: 'confirm', profileId: 'ann' })).toEqual({
      ok: false,
      reason: 'already-responded',
    });
  });
});

describe('disputing', () => {
  it('freezes the game immediately', () => {
    const game = expectOk(applyEvent(pending(), { kind: 'dispute', profileId: 'bo' }));
    expect(game.status).toBe('disputed');
    expect(game.confirmations.bo).toBe('disputed');
    expect(countsTowardRatings(game)).toBe(false);
  });

  it('freezes the game even when everyone else has confirmed', () => {
    let game = pending();
    game = expectOk(applyEvent(game, { kind: 'confirm', profileId: 'bo' }));
    game = expectOk(applyEvent(game, { kind: 'confirm', profileId: 'cal' }));
    game = expectOk(applyEvent(game, { kind: 'dispute', profileId: 'dee' }));
    expect(game.status).toBe('disputed');
    expect(countsTowardRatings(game)).toBe(false);
  });

  it('refuses someone who was not in the game', () => {
    expect(applyEvent(pending(), { kind: 'dispute', profileId: 'eve' })).toEqual({
      ok: false,
      reason: 'not-a-participant',
    });
  });
});

describe('cancelling while pending', () => {
  it('lets the logger withdraw their own game', () => {
    const game = expectOk(applyEvent(pending(), { kind: 'cancel', profileId: 'ann' }));
    expect(game.status).toBe('voided');
    expect(game.voidReason).toBe('cancelled by the logger');
    expect(countsTowardRatings(game)).toBe(false);
  });

  it('refuses any other participant', () => {
    expect(applyEvent(pending(), { kind: 'cancel', profileId: 'bo' })).toEqual({
      ok: false,
      reason: 'not-the-logger',
    });
  });

  it('refuses the logger once the game is confirmed', () => {
    expect(applyEvent(stateWith('confirmed'), { kind: 'cancel', profileId: 'ann' })).toEqual({
      ok: false,
      reason: 'already-confirmed',
    });
  });
});

describe('admin events', () => {
  it('voids a confirmed game, removing it from the replay input', () => {
    const game = expectOk(
      applyEvent(stateWith('confirmed'), { kind: 'void', reason: 'wrong players' }),
    );
    expect(game.status).toBe('voided');
    expect(game.voidReason).toBe('wrong players');
    expect(countsTowardRatings(game)).toBe(false);
  });

  it('resolves a dispute into a confirmed game', () => {
    const game = expectOk(applyEvent(stateWith('disputed'), { kind: 'resolve' }));
    expect(game.status).toBe('confirmed');
    expect(countsTowardRatings(game)).toBe(true);
  });

  it('refuses to resolve a game that is not disputed', () => {
    expect(applyEvent(pending(), { kind: 'resolve' })).toEqual({ ok: false, reason: 'not-disputed' });
  });
});

describe('illegal transitions', () => {
  const everyEvent: readonly GameEvent[] = [
    { kind: 'confirm', profileId: 'bo' },
    { kind: 'dispute', profileId: 'bo' },
    { kind: 'cancel', profileId: 'ann' },
    { kind: 'void', reason: 'any' },
    { kind: 'resolve' },
  ];

  it.each(everyEvent)('a voided game accepts no $kind', (event) => {
    expect(applyEvent(stateWith('voided'), event)).toEqual({ ok: false, reason: 'game-is-voided' });
  });

  const notAdminEvent = (event: GameEvent) => event.kind !== 'void' && event.kind !== 'resolve';

  it.each(everyEvent.filter(notAdminEvent))('a disputed game accepts no $kind', (event) => {
    expect(applyEvent(stateWith('disputed'), event)).toEqual({
      ok: false,
      reason: 'game-is-frozen',
    });
  });

  it.each(everyEvent.filter((event) => event.kind !== 'void'))(
    'a confirmed game accepts no $kind',
    (event) => {
      expect(applyEvent(stateWith('confirmed'), event)).toEqual({
        ok: false,
        reason: 'already-confirmed',
      });
    },
  );

  it('never mutates the state it was given', () => {
    const game = pending();
    applyEvent(game, { kind: 'confirm', profileId: 'bo' });
    expect(game.confirmations.bo).toBe('pending');
    expect(game.status).toBe('pending');
  });
});
