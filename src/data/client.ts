import { createClient, type PostgrestSingleResponse } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Database } from './database.types';

/*
 * Spelled out rather than looked up by name: Expo inlines process.env.EXPO_PUBLIC_*
 * at build time by literal substitution, so a dynamic read is undefined in a built
 * app and would fail on a phone while passing every test here.
 */
function required(name: string, value: string | undefined): string {
  if (value === undefined || value === '') {
    throw new Error(`${name} is missing. Copy .env.example to .env and fill it in.`);
  }
  return value;
}

/**
 * The only Supabase client in the app. Everything above src/data reads through this
 * module's siblings and never touches it, so the rest of the app has no idea where
 * its data comes from.
 *
 * The session lives in AsyncStorage so a member stays signed in between sessions.
 * detectSessionInUrl is a browser concern and there is no browser here.
 */
export const supabase = createClient<Database>(
  required('EXPO_PUBLIC_SUPABASE_URL', process.env.EXPO_PUBLIC_SUPABASE_URL),
  required('EXPO_PUBLIC_SUPABASE_ANON_KEY', process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY),
  {
    auth: {
      storage: AsyncStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  },
);

/**
 * Turns supabase-js's two-field result into a value or a throw, once, here.
 *
 * Typed with the library's own response rather than a hand-written `{ data, error }`:
 * given two independently nullable fields, TypeScript infers a single-row query's
 * row type as null, and every caller downstream silently ends up holding a `never`.
 */
export function unwrap<T>(result: PostgrestSingleResponse<T>): T {
  if (result.error !== null) throw new Error(result.error.message);
  if (result.data === null) throw new Error('the request succeeded but returned nothing');
  return result.data;
}
