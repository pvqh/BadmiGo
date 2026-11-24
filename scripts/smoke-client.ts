/**
 * The plumbing the smoke check runs on: the local stack's keys, one HTTP helper, and
 * registering a member the way the app does. The checks themselves are in smoke.ts.
 */
import { execSync } from 'node:child_process';

export interface Local {
  readonly API_URL: string;
  readonly ANON_KEY: string;
  readonly SERVICE_ROLE_KEY: string;
}

function localCredentials(): Local {
  const output = execSync('npx supabase status -o json', { encoding: 'utf8' });
  const status: unknown = JSON.parse(output);
  if (typeof status !== 'object' || status === null) throw new Error('supabase status gave no json');
  const { API_URL, ANON_KEY, SERVICE_ROLE_KEY } = status as Record<string, unknown>;
  if (typeof API_URL !== 'string' || typeof ANON_KEY !== 'string'
    || typeof SERVICE_ROLE_KEY !== 'string') {
    throw new Error('supabase status is missing the local keys; is the stack running?');
  }
  return { API_URL, ANON_KEY, SERVICE_ROLE_KEY };
}

export const local = localCredentials();

let checks = 0;

export function check(condition: boolean, what: string): void {
  if (!condition) throw new Error(`FAILED: ${what}`);
  checks += 1;
  console.log(`  ok  ${what}`);
}

export async function call(
  path: string,
  options: { token: string; body?: unknown; method?: string },
): Promise<{ status: number; body: unknown }> {
  const response = await fetch(`${local.API_URL}${path}`, {
    method: options.method ?? (options.body === undefined ? 'GET' : 'POST'),
    headers: {
      apikey: local.ANON_KEY,
      Authorization: `Bearer ${options.token}`,
      'Content-Type': 'application/json',
    },
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
  });
  const text = await response.text();
  return { status: response.status, body: text === '' ? null : JSON.parse(text) };
}

export interface Member {
  readonly username: string;
  readonly token: string;
  readonly profileId: string;
}

const SEEDS = ['kha', 'tb-plus', 'newbie', 'newbie'] as const;

export async function register(index: number, run: string): Promise<Member> {
  const username = `smoke_${run}_${index}`;
  const signUp = await call('/auth/v1/signup', {
    token: local.ANON_KEY,
    body: { email: `${username}@users.badminton-ladder.invalid`, password: 'correct-horse-9' },
  });
  if (signUp.status !== 200) throw new Error(`signup failed: ${JSON.stringify(signUp.body)}`);

  const { access_token: token, user } = signUp.body as {
    access_token: string;
    user: { id: string };
  };

  const profile = await call('/rest/v1/rpc/create_my_profile', {
    token,
    body: {
      p_display_name: `Smoke ${index}`,
      p_gender: index % 2 === 0 ? 'male' : 'female',
      p_seed_tier: SEEDS[index],
    },
  });
  if (profile.status !== 200) throw new Error(`profile failed: ${JSON.stringify(profile.body)}`);

  return { username, token, profileId: user.id };
}

export function checksPassed(): number {
  return checks;
}
