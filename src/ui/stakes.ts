import { previewGame, type PreviewedChange } from '../domain/rating-preview';
import type { ProfileId } from '../domain/types';

export interface Strength {
  readonly profile_id: ProfileId;
  readonly mu: number;
  readonly sigma: number;
  readonly last_played_at: string | null;
}

/**
 * Story 19: what the game is worth to each of the four, before it is submitted.
 * Untrusted by design — the server decides the real numbers once all four agree —
 * but the same arithmetic, so it is not a different answer. Null until all four have
 * a rating, which they do after their first confirmed game.
 */
export function stakesFor(
  lineup: readonly ProfileId[],
  strengths: readonly Strength[] | undefined,
  now: number,
): ReadonlyMap<ProfileId, PreviewedChange> | null {
  if (strengths === undefined || lineup.length !== 4) return null;

  const known = lineup.flatMap((profileId) => {
    const strength = strengths.find((entry) => entry.profile_id === profileId);
    if (strength === undefined) return [];
    const lastPlayedAt =
      strength.last_played_at === null ? null : new Date(strength.last_played_at).getTime();
    return [{ profileId, mu: strength.mu, sigma: strength.sigma, lastPlayedAt }];
  });
  if (known.length !== 4) return null;

  const changes = previewGame({ sideA: [known[0], known[1]], sideB: [known[2], known[3]], now });
  return new Map(changes.map((change) => [change.profileId, change]));
}
