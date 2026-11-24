import { invoke, supabase, unwrap } from './client';
import type { AdminAction } from './function-contract';

export async function runAdminAction(body: AdminAction): Promise<void> {
  await invoke('admin', body);
}

/** Story 72. Row-level security lets an admin change is_admin directly. */
export async function setAdmin(profileId: string, isAdmin: boolean): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ is_admin: isAdmin })
    .eq('id', profileId);
  if (error !== null) throw new Error(error.message);
}

export async function readMembers() {
  return unwrap(
    await supabase
      .from('profiles')
      .select('id, username, display_name, seed_tier, is_admin, created_at')
      .order('display_name'),
  );
}

export type Member = Awaited<ReturnType<typeof readMembers>>[number];
