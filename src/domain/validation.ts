import type { GameFormat, ProfileId, Side } from './types.ts';

/**
 * Setting starts one point below the target and a side must then lead by two,
 * except at the cap, where the next point simply wins.
 */
const HARD_CAP: Record<GameFormat, number> = { 31: 40, 21: 30, 15: 21, 11: 15 };

export interface ProposedGame {
  readonly format: GameFormat;
  readonly sideA: readonly ProfileId[];
  readonly sideB: readonly ProfileId[];
  readonly scoreA: number;
  readonly scoreB: number;
}

export type ValidationProblem =
  | { readonly kind: 'side-size'; readonly side: Side; readonly count: number }
  | { readonly kind: 'duplicate-player'; readonly profileId: ProfileId }
  | { readonly kind: 'invalid-score'; readonly format: GameFormat };

export function validateScore(format: GameFormat, scoreA: number, scoreB: number): boolean {
  if (!Number.isInteger(scoreA) || !Number.isInteger(scoreB)) return false;
  if (scoreA < 0 || scoreB < 0) return false;
  if (scoreA === scoreB) return false;

  const winner = Math.max(scoreA, scoreB);
  const loser = Math.min(scoreA, scoreB);
  const cap = HARD_CAP[format];

  if (winner === format) return loser <= format - 2;
  if (winner === cap) return loser === cap - 1;
  return winner > format && winner < cap && loser === winner - 2;
}

/** Returns every problem rather than the first, so the logger can fix them in one pass. */
export function validateProposedGame(game: ProposedGame): readonly ValidationProblem[] {
  const problems: ValidationProblem[] = [];

  if (game.sideA.length !== 2) {
    problems.push({ kind: 'side-size', side: 'a', count: game.sideA.length });
  }
  if (game.sideB.length !== 2) {
    problems.push({ kind: 'side-size', side: 'b', count: game.sideB.length });
  }

  const seen = new Set<ProfileId>();
  const reported = new Set<ProfileId>();
  for (const profileId of [...game.sideA, ...game.sideB]) {
    if (seen.has(profileId) && !reported.has(profileId)) {
      problems.push({ kind: 'duplicate-player', profileId });
      reported.add(profileId);
    }
    seen.add(profileId);
  }

  if (!validateScore(game.format, game.scoreA, game.scoreB)) {
    problems.push({ kind: 'invalid-score', format: game.format });
  }

  return problems;
}
