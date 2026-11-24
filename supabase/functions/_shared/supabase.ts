import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../src/data/database.types.ts';

export type ServiceClient = SupabaseClient<Database>;

export function required(name: string): string {
  const value = Deno.env.get(name);
  if (value === undefined || value === '') {
    throw new Error(`${name} is missing from the function environment`);
  }
  return value;
}

/**
 * The service role owns the derived tables and every game status change, so this is
 * the only client the functions use. Sessions are never persisted: each request
 * carries its own credential.
 */
export function serviceClient(): ServiceClient {
  return createClient<Database>(
    required('SUPABASE_URL'),
    required('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

/** The profile behind a request's bearer token, or null if it does not carry one. */
export async function callerProfileId(
  service: ServiceClient,
  request: Request,
): Promise<string | null> {
  const header = request.headers.get('Authorization');
  if (header === null) return null;

  const { data, error } = await service.auth.getUser(header.replace(/^Bearer\s+/i, ''));
  if (error !== null || data.user === null) return null;
  return data.user.id;
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * A client acting as whoever made the request, so the database decides what they may
 * do. The privileged work is granted to service_role alone, which means a function
 * need not re-implement that check and cannot forget to.
 */
export function callerClient(authorization: string): ServiceClient {
  return createClient<Database>(required('SUPABASE_URL'), required('SUPABASE_ANON_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization } },
  });
}
