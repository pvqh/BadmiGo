import type { ProfileId } from '../domain/types';

interface RankedEntry {
  readonly profile_id: ProfileId;
  readonly display_rating: number;
  readonly profiles: { readonly display_name: string };
}

export interface Standing {
  readonly rank: number;
  readonly next: { readonly name: string; readonly gap: number } | null;
}

/**
 * Where a player sits on an already-ordered ladder and who is one place above, so
 * the screen can say how far there is to climb. Display ratings only: this is a
 * presentation of the replay's output, never an input to it.
 */
export function standingOf(
  ranked: readonly RankedEntry[],
  profileId: ProfileId,
): Standing | null {
  const index = ranked.findIndex((entry) => entry.profile_id === profileId);
  if (index === -1) return null;

  const above = ranked[index - 1];
  return {
    rank: index + 1,
    next:
      above === undefined
        ? null
        : {
            name: above.profiles.display_name,
            gap: above.display_rating - ranked[index].display_rating,
          },
  };
}
