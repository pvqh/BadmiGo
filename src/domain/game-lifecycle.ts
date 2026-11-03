import type { ProfileId } from './types.ts';

/** A game nobody responded to is accepted, so one silent player cannot hold the ladder hostage. */
export const AUTO_ACCEPT_MS = 24 * 60 * 60 * 1000;

const CANCELLED_BY_LOGGER = 'cancelled by the logger';

export type GameStatus = 'pending' | 'confirmed' | 'disputed' | 'voided';

export type ConfirmationState = 'pending' | 'confirmed' | 'disputed';

export interface GameState {
  readonly status: GameStatus;
  readonly logger: ProfileId;
  readonly loggedAt: number;
  readonly confirmations: Readonly<Record<ProfileId, ConfirmationState>>;
  readonly voidReason?: string;
}

/**
 * `void` and `resolve` are the admin's events. Who may send them is a row-level
 * security question, not a lifecycle rule, so they carry no actor. `cancel` does,
 * because belonging to the logger is part of the rule itself.
 */
export type GameEvent =
  | { readonly kind: 'confirm'; readonly profileId: ProfileId }
  | { readonly kind: 'dispute'; readonly profileId: ProfileId }
  | { readonly kind: 'cancel'; readonly profileId: ProfileId }
  | { readonly kind: 'void'; readonly reason: string }
  | { readonly kind: 'resolve' }
  | { readonly kind: 'elapse'; readonly now: number };

export type RejectionReason =
  | 'not-a-participant'
  | 'already-responded'
  | 'already-confirmed'
  | 'not-the-logger'
  | 'not-disputed'
  | 'auto-accept-window-open'
  | 'game-is-frozen'
  | 'game-is-voided';

export type Transition =
  | { readonly ok: true; readonly state: GameState }
  | { readonly ok: false; readonly reason: RejectionReason };

const accepted = (state: GameState): Transition => ({ ok: true, state });
const rejected = (reason: RejectionReason): Transition => ({ ok: false, reason });

export function openGame(input: {
  readonly logger: ProfileId;
  readonly participants: readonly ProfileId[];
  readonly loggedAt: number;
}): GameState {
  const confirmations: Record<ProfileId, ConfirmationState> = {};
  for (const profileId of input.participants) {
    confirmations[profileId] = profileId === input.logger ? 'confirmed' : 'pending';
  }
  return {
    status: 'pending',
    logger: input.logger,
    loggedAt: input.loggedAt,
    confirmations,
  };
}

/** The replay input filter: only a confirmed game has ever moved a rating. */
export function countsTowardRatings(state: GameState): boolean {
  return state.status === 'confirmed';
}

export function applyEvent(state: GameState, event: GameEvent): Transition {
  if (state.status === 'voided') return rejected('game-is-voided');

  if (event.kind === 'void') {
    return accepted({ ...state, status: 'voided', voidReason: event.reason });
  }

  if (state.status === 'disputed') {
    return event.kind === 'resolve'
      ? accepted({ ...state, status: 'confirmed' })
      : rejected('game-is-frozen');
  }

  if (state.status === 'confirmed') return rejected('already-confirmed');

  switch (event.kind) {
    case 'confirm':
      return respond(state, event.profileId, 'confirmed');
    case 'dispute':
      return respond(state, event.profileId, 'disputed');
    case 'cancel':
      return event.profileId === state.logger
        ? accepted({ ...state, status: 'voided', voidReason: CANCELLED_BY_LOGGER })
        : rejected('not-the-logger');
    case 'resolve':
      return rejected('not-disputed');
    case 'elapse':
      return event.now - state.loggedAt >= AUTO_ACCEPT_MS
        ? accepted(autoAccept(state))
        : rejected('auto-accept-window-open');
  }
}

function respond(
  state: GameState,
  profileId: ProfileId,
  response: Exclude<ConfirmationState, 'pending'>,
): Transition {
  const current = state.confirmations[profileId];
  if (current === undefined) return rejected('not-a-participant');
  if (current !== 'pending') return rejected('already-responded');

  const confirmations = { ...state.confirmations, [profileId]: response };

  if (response === 'disputed') {
    return accepted({ ...state, status: 'disputed', confirmations });
  }

  const settled = Object.values(confirmations).every((state) => state === 'confirmed');
  return accepted({ ...state, status: settled ? 'confirmed' : 'pending', confirmations });
}

/**
 * A dispute freezes the game the moment it arrives, so a still-pending game holds
 * no response other than pending or confirmed and every outstanding one can accept.
 */
function autoAccept(state: GameState): GameState {
  const confirmations: Record<ProfileId, ConfirmationState> = {};
  for (const profileId of Object.keys(state.confirmations)) {
    confirmations[profileId] = 'confirmed';
  }
  return { ...state, status: 'confirmed', confirmations };
}
