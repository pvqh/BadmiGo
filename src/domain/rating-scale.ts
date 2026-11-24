import type { Tier } from './types.ts';

/**
 * Every tunable rating parameter lives in this file. CLAUDE.md forbids changing any
 * of them without re-running the simulation harness and reporting the before/after
 * ranking recovery, so keeping them in one small place keeps that promise auditable.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** OpenSkill's library default, used for every player so a seed is only a hint. */
export const SIGMA_INITIAL = 25 / 3;

export const PLACEMENT_GAMES = 5;

/** A player is off the ladder, and their sigma starts to widen, after this long away. */
export const IDLE_GRACE_DAYS = 21;

/**
 * PROVISIONAL. Days of absence beyond the grace period after which uncertainty is
 * back to a newcomer's. Chosen so a month away leaves a player meaningfully
 * responsive again; the simulation harness has not yet been run against it.
 */
const SIGMA_RECOVERY_DAYS = 21;

const DISPLAY_SCALE = 40;

/**
 * How many standard deviations below mu the player-facing number sits. OpenSkill's
 * own default is 3, which the simulation harness showed is far too conservative at
 * this club's volume: sigma plateaus near 5.2 rather than settling low, so a third
 * of the club was flattened to a display rating of zero. See the Decision Log.
 */
const DISPLAY_CONFIDENCE_Z = 1.5;

const SEED_MU: Record<Tier, number> = {
  newbie: 16,
  y: 21,
  tby: 25,
  'tb-plus': 30,
  kha: 36,
};

/** Confirmed against the simulation harness on 2026-11-03. See the Decision Log. */
const TIER_FLOOR = { kha: 1120, 'tb-plus': 880, tby: 600, y: 400 } as const;

export function seedMu(tier: Tier): number {
  return SEED_MU[tier];
}

export function displayRating(mu: number, sigma: number): number {
  return Math.max(0, Math.round((mu - DISPLAY_CONFIDENCE_Z * sigma) * DISPLAY_SCALE));
}

export function tierFor(rating: number): Tier {
  if (rating >= TIER_FLOOR.kha) return 'kha';
  if (rating >= TIER_FLOOR['tb-plus']) return 'tb-plus';
  if (rating >= TIER_FLOOR.tby) return 'tby';
  if (rating >= TIER_FLOOR.y) return 'y';
  return 'newbie';
}

const TIER_LADDER = [
  { tier: 'y', floor: TIER_FLOOR.y },
  { tier: 'tby', floor: TIER_FLOOR.tby },
  { tier: 'tb-plus', floor: TIER_FLOOR['tb-plus'] },
  { tier: 'kha', floor: TIER_FLOOR.kha },
] as const satisfies readonly { readonly tier: Tier; readonly floor: number }[];

/**
 * The tier above a display rating, its floor, and the floor of the band the rating is
 * in now, so a profile can draw progress through the band. Null at the top.
 */
export function nextTier(
  rating: number,
): { readonly tier: Tier; readonly floor: number; readonly from: number } | null {
  const index = TIER_LADDER.findIndex((band) => rating < band.floor);
  if (index === -1) return null;
  return {
    tier: TIER_LADDER[index].tier,
    floor: TIER_LADDER[index].floor,
    from: index === 0 ? 0 : TIER_LADDER[index - 1].floor,
  };
}

/**
 * Applied when a returning player next plays, never while they are away, so an
 * inactive player's stored rating is preserved exactly as they left it.
 */
export function inflateSigmaForIdleTime(sigma: number, idleMs: number): number {
  const idleDays = idleMs / DAY_MS;
  if (idleDays <= IDLE_GRACE_DAYS) return sigma;
  if (sigma >= SIGMA_INITIAL) return SIGMA_INITIAL;

  const recovered = (idleDays - IDLE_GRACE_DAYS) / SIGMA_RECOVERY_DAYS;
  if (recovered >= 1) return SIGMA_INITIAL;

  return sigma + (SIGMA_INITIAL - sigma) * recovered;
}
