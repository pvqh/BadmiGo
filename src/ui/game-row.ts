import type { GameRow } from '../data/games';
import type { ReviewedGame } from '../domain/flags';
import { AUTO_ACCEPT_MS } from '../domain/game-lifecycle';
import type { RatedGame } from '../domain/rating';
import type { ProfileId, Side } from '../domain/types';

/**
 * Reading a game row the way the screens need it. No rules live here: the lifecycle
 * and the rating are decided server-side, and this only unpacks what came back.
 */

export interface Player {
  readonly profileId: ProfileId;
  readonly displayName: string;
  readonly username: string;
}

export interface Lineup {
  readonly a: readonly Player[];
  readonly b: readonly Player[];
}

export function lineupOf(row: GameRow): Lineup {
  const a: Player[] = [];
  const b: Player[] = [];

  for (const participant of row.game_participants) {
    const player = {
      profileId: participant.profile_id,
      displayName: participant.profiles.display_name,
      username: participant.profiles.username,
    };
    (participant.side === 'a' ? a : b).push(player);
  }

  return { a, b };
}

export function winnerOf(row: GameRow): Side {
  return row.score_a > row.score_b ? 'a' : 'b';
}

/** What this game moved for one player, or null for a game that has moved nothing. */
export function moveFor(row: GameRow, profileId: ProfileId) {
  return row.rating_history.find((change) => change.profile_id === profileId) ?? null;
}

export function answerOf(row: GameRow, profileId: ProfileId) {
  return row.game_confirmations.find((answer) => answer.profile_id === profileId) ?? null;
}

export function stillToAnswer(row: GameRow): number {
  return row.game_confirmations.filter((answer) => answer.state === 'pending').length;
}

/**
 * How long the outstanding participants have left before the game accepts itself.
 * Measured from created_at, as the server's sweep does: a backdated game must not
 * shorten anyone's twenty-four hours.
 */
export function autoAcceptsIn(row: GameRow, now: number): number {
  return new Date(row.created_at).getTime() + AUTO_ACCEPT_MS - now;
}

/**
 * The row as the engine sees it, for the stats on a profile. Null when it is not two
 * against two — which the database forbids, but the type cannot.
 */
export function toRatedGame(row: GameRow): RatedGame | null {
  const { a, b } = lineupOf(row);
  if (a.length !== 2 || b.length !== 2) return null;

  return {
    id: row.id,
    playedAt: new Date(row.played_at).getTime(),
    sideA: [a[0].profileId, a[1].profileId],
    sideB: [b[0].profileId, b[1].profileId],
    scoreA: row.score_a,
    scoreB: row.score_b,
  };
}

/** The row as src/domain/flags reads it, to decide whether an admin should look. */
export function toReviewedGame(row: GameRow): ReviewedGame {
  return {
    status: row.status,
    logger: row.logger_id,
    loggedAt: new Date(row.created_at).getTime(),
    answers: row.game_confirmations.map((answer) => ({
      profileId: answer.profile_id,
      respondedAt: answer.responded_at === null ? null : new Date(answer.responded_at).getTime(),
    })),
  };
}
