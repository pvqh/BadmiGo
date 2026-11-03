import {
  applyEvent,
  type ConfirmationState,
  type GameEvent,
  type GameState,
  type RejectionReason,
} from '../../../src/domain/game-lifecycle.ts';
import type { ServiceClient } from './supabase.ts';

export type ApplyOutcome =
  | { readonly ok: true; readonly state: GameState }
  | { readonly ok: false; readonly reason: RejectionReason | 'game-not-found' | 'contended' };

/** Enough for two participants answering at the same instant; a third is a real queue. */
const ATTEMPTS = 3;

const SERIALIZATION_FAILURE = '40001';

/**
 * Reads the game, lets src/domain/game-lifecycle decide, and writes the decision —
 * retrying from the read if someone else answered in between. The rule stays in the
 * domain; all this adds is the state to apply it to and the atomicity to record it.
 */
export async function applyGameEvent(
  service: ServiceClient,
  gameId: string,
  event: GameEvent,
): Promise<ApplyOutcome> {
  for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
    const state = await readGameState(service, gameId);
    if (state === null) return { ok: false, reason: 'game-not-found' };

    const transition = applyEvent(state, event);
    if (!transition.ok) return { ok: false, reason: transition.reason };

    if (await persist(service, gameId, state, transition.state)) {
      return { ok: true, state: transition.state };
    }
  }
  return { ok: false, reason: 'contended' };
}

async function readGameState(
  service: ServiceClient,
  gameId: string,
): Promise<GameState | null> {
  const game = await service
    .from('games')
    .select('logger_id, created_at, status, void_reason')
    .eq('id', gameId)
    .maybeSingle();
  if (game.error !== null) throw new Error(game.error.message);
  if (game.data === null) return null;

  /*
   * Confirmations hang off game_participants rather than games, so that a row can
   * only exist for someone who actually played. The price is this second read.
   */
  const answers = await service
    .from('game_confirmations')
    .select('profile_id, state')
    .eq('game_id', gameId);
  if (answers.error !== null) throw new Error(answers.error.message);

  const confirmations: Record<string, ConfirmationState> = {};
  for (const answer of answers.data) {
    confirmations[answer.profile_id] = answer.state;
  }

  return {
    status: game.data.status,
    logger: game.data.logger_id,
    loggedAt: Date.parse(game.data.created_at),
    confirmations,
    ...(game.data.void_reason === null ? {} : { voidReason: game.data.void_reason }),
  };
}

/** False when the state moved on under us and the decision has to be made again. */
async function persist(
  service: ServiceClient,
  gameId: string,
  expected: GameState,
  decided: GameState,
): Promise<boolean> {
  const { error } = await service.rpc('persist_game_state', {
    p_game_id: gameId,
    p_expected_status: expected.status,
    p_expected_confirmations: asRows(expected),
    p_status: decided.status,
    p_confirmations: asRows(decided),
    p_void_reason: decided.voidReason,
  });

  if (error === null) return true;
  if (error.code === SERIALIZATION_FAILURE) return false;
  throw new Error(error.message);
}

function asRows(state: GameState): { profileId: string; state: ConfirmationState }[] {
  return Object.entries(state.confirmations).map(([profileId, answer]) => ({
    profileId,
    state: answer,
  }));
}
