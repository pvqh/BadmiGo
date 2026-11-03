import { supabase, unwrap } from './client';
import type { ProfileId } from '../domain/types';

/**
 * The ladder, strongest first. Ranking and the men's and women's splits are applied
 * by the screen: every rating in here is derived server-side, and which of them to
 * number is a presentation question, not a rating one.
 */
export async function readLadder() {
  return unwrap(
    await supabase
      .from('player_ratings')
      .select(
        'profile_id, display_rating, tier, games_played, in_placement, is_active, ' +
          'last_played_at, profiles!inner (username, display_name, gender)',
      )
      .order('display_rating', { ascending: false }),
  );
}

/** Null until the first replay has run, which is a real state on a new database. */
export async function readRating(profileId: ProfileId) {
  const { data, error } = await supabase
    .from('player_ratings')
    .select('*, profiles!inner (username, display_name, gender, seed_tier)')
    .eq('profile_id', profileId)
    .maybeSingle();
  if (error !== null) throw new Error(error.message);
  return data;
}

/** A player's rating over time, oldest first, for the graph on their profile. */
export async function readRatingHistory(profileId: ProfileId) {
  return unwrap(
    await supabase
      .from('rating_history')
      .select('game_id, display_before, display_after, games!inner (played_at)')
      .eq('profile_id', profileId)
      .order('played_at', { referencedTable: 'games', ascending: true }),
  );
}

/** When the ladder was last rebuilt, so a stale screen can say so rather than lie. */
export async function readReplayState() {
  return unwrap(
    await supabase
      .from('rating_replay_state')
      .select('last_replay_at, games_replayed, duration_ms')
      .single(),
  );
}

export async function searchPlayers(term: string) {
  const pattern = `%${term.trim()}%`;
  return unwrap(
    await supabase
      .from('profiles')
      .select('id, username, display_name, gender')
      .or(`display_name.ilike.${pattern},username.ilike.${pattern}`)
      .order('display_name')
      .limit(20),
  );
}
