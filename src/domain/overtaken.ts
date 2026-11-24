import type { ProfileId } from './types.ts';

/** One row of the ladder as a replay left it. The engine's own `PlayerRating` fits. */
export interface LadderPlace {
  readonly profileId: ProfileId;
  readonly displayRating: number;
  readonly active: boolean;
  readonly inPlacement: boolean;
}

/**
 * Story 63: who was passed on the ladder by a replay, and by whom. Only players
 * ranked both before and after count — someone finishing placement above you has
 * arrived, not passed you. Ties fall back to profile id, the replay's own order.
 */
export function overtaken(
  before: readonly LadderPlace[],
  after: readonly LadderPlace[],
): ReadonlyMap<ProfileId, readonly ProfileId[]> {
  const wasAt = positions(before);
  const both = [...positions(after)].flatMap(([profileId, isAt]) => {
    const was = wasAt.get(profileId);
    return was === undefined ? [] : [{ profileId, was, isAt }];
  });

  const passed = new Map<ProfileId, ProfileId[]>();
  for (const player of both) {
    const by = both
      .filter((other) => other.was > player.was && other.isAt < player.isAt)
      .map((other) => other.profileId);
    if (by.length > 0) passed.set(player.profileId, by.sort());
  }
  return passed;
}

/** Away and still-placing players have no rank, here as on the ladder screen. */
function positions(ladder: readonly LadderPlace[]): Map<ProfileId, number> {
  const ranked = ladder
    .filter((place) => place.active && !place.inPlacement)
    .sort(
      (left, right) =>
        right.displayRating - left.displayRating ||
        (left.profileId < right.profileId ? -1 : 1),
    );
  return new Map(ranked.map((place, index) => [place.profileId, index]));
}
