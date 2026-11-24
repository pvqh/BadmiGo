import webpush from 'web-push';
import { required, type ServiceClient } from './supabase.ts';

/** Each notification kind has its own switch in Settings (story 64). */
export type Preference =
  | 'confirmation_requests'
  | 'dispute_alerts'
  | 'weekly_recap'
  | 'overtaken_on_ladder';

/** `path` is relative to the app's address, so the service worker resolves it. */
export interface Message {
  readonly title: string;
  readonly body: string;
  readonly path: string;
}

/** Delivered, and pushed to an address the browser has since thrown away. */
const GONE = new Set([404, 410]);

/**
 * Sends each member their message on every phone they turned notifications on for,
 * if they want this kind. Returns how many phones accepted one. Subscriptions the push
 * service reports as gone are deleted, so a reinstalled app does not accumulate dead
 * addresses.
 */
export async function pushEach(
  service: ServiceClient,
  preference: Preference,
  messages: readonly { readonly profileId: string; readonly message: Message }[],
): Promise<number> {
  if (messages.length === 0) return 0;

  const wanted = await service
    .from('notification_preferences')
    .select('profile_id')
    .in('profile_id', messages.map((entry) => entry.profileId))
    .eq(preference, true);
  if (wanted.error !== null) throw new Error(wanted.error.message);
  const willing = new Set(wanted.data.map((row) => row.profile_id));

  const subscriptions = await service
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth, profile_id')
    .in('profile_id', [...willing]);
  if (subscriptions.error !== null) throw new Error(subscriptions.error.message);

  webpush.setVapidDetails(
    required('VAPID_SUBJECT'),
    required('VAPID_PUBLIC_KEY'),
    required('VAPID_PRIVATE_KEY'),
  );

  let delivered = 0;
  for (const { profileId, message } of messages) {
    if (!willing.has(profileId)) continue;
    for (const subscription of subscriptions.data) {
      if (subscription.profile_id !== profileId) continue;
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          JSON.stringify(message),
        );
        delivered += 1;
      } catch (error) {
        if (error instanceof webpush.WebPushError && GONE.has(error.statusCode)) {
          await service.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint);
        } else {
          console.error('push failed', subscription.endpoint, error);
        }
      }
    }
  }
  return delivered;
}
