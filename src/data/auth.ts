import { isAuthApiError, isAuthSessionMissingError } from '@supabase/supabase-js';
import { supabase, unwrap } from './client';
import type { Database } from './database.types';
import type { Tier } from '../domain/types';

export type Gender = Database['public']['Enums']['gender'];
export type Profile = Database['public']['Tables']['profiles']['Row'];

/**
 * Mirrors public.username_email_domain(). Accounts are username-only, but Supabase
 * Auth wants an email, so each one gets an address derived from the handle that can
 * never receive mail. Change this and the SQL function together or sign-in breaks.
 */
const USERNAME_EMAIL_DOMAIN = 'users.badminton-ladder.invalid';

export function authEmailFor(username: string): string {
  return `${username.trim().toLowerCase()}@${USERNAME_EMAIL_DOMAIN}`;
}

export async function signIn(username: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({
    email: authEmailFor(username),
    password,
  });
  if (error !== null) throw new Error(error.message);
}

export async function signUp(username: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signUp({
    email: authEmailFor(username),
    password,
  });
  if (error !== null) throw new Error(error.message);
}

/**
 * Who is signed in, now and whenever that changes. Reported as a bare id because the
 * app above this module has no business holding a token. supabase-js replays the
 * stored session to a new listener, so this is also how the app learns its state at
 * launch rather than asking separately and racing itself.
 */
export function onAuthChange(listen: (userId: string | null) => void): () => void {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    listen(session === null ? null : session.user.id);
  });
  return () => data.subscription.unsubscribe();
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error !== null) throw new Error(error.message);
}

export async function changePassword(password: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password });
  if (error !== null) throw new Error(error.message);
}

/** The reason a handle cannot be used, or null. Instant, because the rule is a function. */
export async function usernameProblem(username: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('username_problem', { p_username: username });
  if (error !== null) throw new Error(error.message);
  return data;
}

export async function usernameAvailable(username: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('username_available', { p_username: username });
  if (error !== null) throw new Error(error.message);
  return data;
}

/**
 * Turns a signed-in account into a club member. Separate from signUp so an account
 * whose profile step failed can finish it later rather than being stuck half-made.
 */
export async function createMyProfile(input: {
  readonly displayName: string;
  readonly gender: Gender;
  readonly seedTier: Tier;
}): Promise<Profile> {
  return unwrap(
    await supabase.rpc('create_my_profile', {
      p_display_name: input.displayName,
      p_gender: input.gender,
      p_seed_tier: input.seedTier,
    }),
  );
}

/**
 * The handle this account was created with, read back out of its auth email, the
 * same way public.create_my_profile derives it, so the screen shows what the profile
 * will actually hold.
 */
export async function myUsername(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error !== null) throw new Error(error.message);

  const [handle, domain] = (data.user.email ?? '').split('@');
  if (domain !== USERNAME_EMAIL_DOMAIN) throw new Error('this account has no username');
  return handle;
}

/** Null while an account exists but has not finished signing up. */
export async function myProfile(): Promise<Profile | null> {
  const { data: session, error: authError } = await supabase.auth.getUser();
  if (authError !== null) {
    // A network failure must not read as "no profile", or a phone that lost signal
    // would be sent to finish signing up.
    if (!isAuthApiError(authError) && !isAuthSessionMissingError(authError)) {
      throw new Error(authError.message);
    }
    // The server no longer knows this account (a db reset, a deleted user), so the
    // session saved on the phone is stale; dropping it lands on the sign-in screen.
    await supabase.auth.signOut({ scope: 'local' });
    return null;
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .maybeSingle();
  if (error !== null) throw new Error(error.message);
  return data;
}
