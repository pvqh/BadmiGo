import { AUTO_ACCEPT_MS, type GameStatus } from './game-lifecycle.ts';
import type { ProfileId } from './types.ts';

/**
 * Why a game is on the admin's review list (story 70). Two signals, both read off the
 * record itself rather than guessed from scores:
 *
 * - `disputed`: frozen until an admin resolves or voids it.
 * - `nobody-answered`: confirmed by the twenty-four-hour clock alone, so the only
 *   person who ever vouched for it is the one who logged it.
 */
export type Flag = 'disputed' | 'nobody-answered';

export interface ReviewedGame {
  readonly status: GameStatus;
  readonly logger: ProfileId;
  readonly loggedAt: number;
  readonly answers: readonly {
    readonly profileId: ProfileId;
    readonly respondedAt: number | null;
  }[];
}

/** A disputed game is never also confirmed, so a game carries at most one flag. */
export function flagFor(game: ReviewedGame): Flag | null {
  if (game.status === 'disputed') return 'disputed';
  if (game.status !== 'confirmed') return null;

  // The clock stamps every answer it fills in at the moment it fires, which is never
  // inside the window, so an answer inside it is one a player gave.
  const vouched = game.answers.some(
    (answer) =>
      answer.profileId !== game.logger &&
      answer.respondedAt !== null &&
      answer.respondedAt - game.loggedAt < AUTO_ACCEPT_MS,
  );
  return vouched ? null : 'nobody-answered';
}
