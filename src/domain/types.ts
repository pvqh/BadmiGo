export type ProfileId = string;

/** Points the game is played to. The format is recorded but all three are rated equally. */
export type GameFormat = 31 | 21 | 15 | 11;

export const GAME_FORMATS: readonly GameFormat[] = [31, 21, 15, 11];

/** Narrows a value read from the database or a request body. */
export function asGameFormat(value: unknown): GameFormat | null {
  return GAME_FORMATS.find((format) => format === value) ?? null;
}

export type Side = 'a' | 'b';

/** The club's own vocabulary. Used both for a declared seed and for a derived band. */
export type Tier = 'newbie' | 'y' | 'tby' | 'tb-plus' | 'kha';

/** In the order a player would climb them. */
export const TIERS: readonly Tier[] = ['newbie', 'y', 'tby', 'tb-plus', 'kha'];

export function asTier(value: unknown): Tier | null {
  return TIERS.find((tier) => tier === value) ?? null;
}
