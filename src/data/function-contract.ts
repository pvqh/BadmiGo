import type { Tier } from '../domain/types.ts';

/*
 * What the app and the Edge Functions must agree on, written once. It imports only
 * domain types, so a Deno function imports it from here as it does database.types.ts.
 */

/** Matches minimum_password_length in supabase/config.toml. */
export const MIN_PASSWORD = 8;

/** The actions the admin Edge Function knows. All but reset-password end in a replay. */
export type AdminAction =
  | { readonly action: 'correct-score'; readonly gameId: string; readonly scoreA: number; readonly scoreB: number }
  | { readonly action: 'void'; readonly gameId: string; readonly reason: string }
  | { readonly action: 'resolve'; readonly gameId: string }
  | { readonly action: 'set-seed-tier'; readonly profileId: string; readonly seedTier: Tier }
  | { readonly action: 'merge'; readonly keepId: string; readonly mergeId: string }
  | { readonly action: 'reset-password'; readonly profileId: string; readonly password: string }
  | { readonly action: 'delete-account'; readonly profileId: string };
