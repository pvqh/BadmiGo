import { isAuthApiError, isAuthSessionMissingError, type AuthError } from '@supabase/supabase-js';
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

/** Supabase Auth's reasons, in the club's language; anything unexpected as it came. */
const AUTH_PROBLEM: Readonly<Record<string, string>> = {
  invalid_credentials: 'Sai tên đăng nhập hoặc mật khẩu.',
  user_already_exists: 'Tên đăng nhập này đã có người dùng. Hãy đăng nhập.',
  weak_password: 'Mật khẩu quá ngắn.',
  over_request_rate_limit: 'Thử quá nhiều lần. Đợi một lát rồi thử lại.',
};

function authProblem(error: AuthError): Error {
  return new Error((error.code === undefined ? undefined : AUTH_PROBLEM[error.code]) ?? error.message);
}

/** Any capitalisation signs in: the address, and so the password, is the lower-cased handle. */
export async function signIn(username: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({
    email: authEmailFor(username),
    password,
  });
  if (error !== null) throw authProblem(error);
}

/**
 * The handle as typed, capitals and all, rides along in the account's metadata, since
 * the auth email can only hold it in lower case. public.create_my_profile copies it
 * into the profile once it has checked it spells the same handle.
 */
export async function signUp(username: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signUp({
    email: authEmailFor(username),
    password,
    options: { data: { username: username.trim() } },
  });
  if (error !== null) throw authProblem(error);
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
  if (error !== null) throw authProblem(error);
}

/**
 * Story 6a. Trimmed here because the table checks the trimmed length but stores what
 * it is given, and a name with a stray space would look like a different person.
 */
export async function changeDisplayName(profileId: string, displayName: string): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ display_name: displayName.trim() })
    .eq('id', profileId);
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
  readonly avatarPath: string | null;
}): Promise<Profile> {
  return unwrap(
    await supabase.rpc('create_my_profile', {
      p_display_name: input.displayName,
      p_gender: input.gender,
      p_seed_tier: input.seedTier,
      ...(input.avatarPath === null ? {} : { p_avatar_path: input.avatarPath }),
    }),
  );
}

/**
 * The handle this account was created with, worked out the way
 * public.create_my_profile does it, so the screen shows what the profile will hold:
 * the capitals typed at signup if they spell the auth email's handle, else the handle.
 */
export async function myUsername(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error !== null) throw new Error(error.message);

  const [handle, domain] = (data.user.email ?? '').split('@');
  if (domain !== USERNAME_EMAIL_DOMAIN) throw new Error('Tài khoản này không có tên đăng nhập');
  const typed: unknown = data.user.user_metadata.username;
  return typeof typed === 'string' && typed.trim().toLowerCase() === handle ? typed.trim() : handle;
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
