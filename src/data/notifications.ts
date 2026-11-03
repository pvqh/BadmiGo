import { supabase, unwrap } from './client';
import type { Database } from './database.types';

export type Preferences = Database['public']['Tables']['notification_preferences']['Row'];

/**
 * Registers this handset. Keyed by the token rather than by the member, so the same
 * phone changing hands moves with it instead of leaving a stale address behind.
 */
export async function registerDevice(profileId: string, token: string): Promise<void> {
  const { error } = await supabase
    .from('push_tokens')
    .upsert({ token, profile_id: profileId, updated_at: new Date().toISOString() });
  if (error !== null) throw new Error(error.message);
}

export async function forgetDevice(token: string): Promise<void> {
  const { error } = await supabase.from('push_tokens').delete().eq('token', token);
  if (error !== null) throw new Error(error.message);
}

/** The row exists from the moment the profile does, so this always finds one. */
export async function readPreferences(profileId: string): Promise<Preferences> {
  return unwrap(
    await supabase
      .from('notification_preferences')
      .select('*')
      .eq('profile_id', profileId)
      .single(),
  );
}

export async function updatePreferences(
  profileId: string,
  changes: Partial<
    Pick<
      Preferences,
      'confirmation_requests' | 'dispute_alerts' | 'weekly_recap' | 'overtaken_on_ladder'
    >
  >,
): Promise<void> {
  const { error } = await supabase
    .from('notification_preferences')
    .update({ ...changes, updated_at: new Date().toISOString() })
    .eq('profile_id', profileId);
  if (error !== null) throw new Error(error.message);
}
