import { supabase } from './client';

/** Matches the avatars bucket in the usernames-and-avatars migration. */
const BUCKET = 'avatars';

/**
 * Story 6b. Stores an already-shrunk JPEG in the member's own folder and returns its
 * path. Works before the profile exists, so the picture can be chosen at signup. A new
 * name every time, so a changed picture is a new URL and no phone shows the old one.
 */
export async function uploadAvatar(picture: Blob): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error !== null) throw new Error(error.message);

  const path = `${data.user.id}/${Date.now()}.jpg`;
  const upload = await supabase.storage
    .from(BUCKET)
    .upload(path, picture, { contentType: 'image/jpeg' });
  if (upload.error !== null) throw new Error(upload.error.message);
  return path;
}

/**
 * Points the profile at a new picture, or at none, then deletes the one it replaced.
 * That delete is only tidying: a leftover file is a few kilobytes nobody can see, so
 * failing to delete it does not undo a change the member has already seen succeed.
 */
export async function changeAvatar(input: {
  readonly profileId: string;
  readonly previous: string | null;
  readonly next: string | null;
}): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ avatar_path: input.next })
    .eq('id', input.profileId);
  if (error !== null) throw new Error(error.message);

  if (input.previous !== null && input.previous !== input.next) {
    await supabase.storage.from(BUCKET).remove([input.previous]);
  }
}

/** The bucket is public, so this is string formatting, not a request. */
export function avatarUrl(path: string): string {
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}
