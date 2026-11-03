import { supabase, unwrap } from './client';
import type { Database } from './database.types';
import type { Tier } from '../domain/types';

export type Gender = Database['public']['Enums']['gender'];
export type Profile = Database['public']['Tables']['profiles']['Row'];

/**
 * Mirrors public.username_email_domain(). A username-only account has no real
 * address, so its Supabase Auth email is derived from the handle rather than looked
 * up — which is what keeps every member's real email out of reach of anyone who can
 * guess a username. Change this and the SQL function together or sign-in breaks.
 */
const USERNAME_EMAIL_DOMAIN = 'users.badminton-ladder.invalid';

/** Anything with an @ in it is already an address; anything else is a handle. */
export function authEmailFor(usernameOrEmail: string): string {
  const entered = usernameOrEmail.trim().toLowerCase();
  return entered.includes('@') ? entered : `${entered}@${USERNAME_EMAIL_DOMAIN}`;
}

export async function signIn(usernameOrEmail: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({
    email: authEmailFor(usernameOrEmail),
    password,
  });
  if (error !== null) throw new Error(error.message);
}

export async function signUp(usernameOrEmail: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signUp({
    email: authEmailFor(usernameOrEmail),
    password,
  });
  if (error !== null) throw new Error(error.message);
}

/** Google and Apple both hand back an identity token the app exchanges for a session. */
export async function signInWithIdToken(
  provider: 'google' | 'apple',
  token: string,
): Promise<void> {
  const { error } = await supabase.auth.signInWithIdToken({ provider, token });
  if (error !== null) throw new Error(error.message);
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error !== null) throw new Error(error.message);
}

export async function requestPasswordReset(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase());
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
 * Turns a signed-in account into a club member. Every way in — username, email,
 * Google, Apple — finishes here, so there is one path to a profile.
 */
export async function createMyProfile(input: {
  readonly username: string;
  readonly displayName: string;
  readonly gender: Gender;
  readonly seedTier: Tier;
}): Promise<Profile> {
  return unwrap(
    await supabase.rpc('create_my_profile', {
      p_username: input.username,
      p_display_name: input.displayName,
      p_gender: input.gender,
      p_seed_tier: input.seedTier,
    }),
  );
}

/** Null while an account exists but has not finished signing up. */
export async function myProfile(): Promise<Profile | null> {
  const { data: session } = await supabase.auth.getUser();
  if (session.user === null) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .maybeSingle();
  if (error !== null) throw new Error(error.message);
  return data;
}
