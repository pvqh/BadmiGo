import { invoke, supabase, unwrap } from './client';
import type { AdminAction } from './function-contract';

/**
 * The change is saved even when the replay after it fails, so that is said in words:
 * a quiet "done" once left the ladder stale with nobody aware of it.
 */
export async function runAdminAction(body: AdminAction): Promise<void> {
  const { replayed } = await invoke<{ readonly replayed: boolean }>('admin', body);
  if (!replayed && body.action !== 'reset-password') {
    throw new Error('Đã lưu, nhưng chưa tính lại được bảng xếp hạng. Xem log của hàm admin trên Supabase.');
  }
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
