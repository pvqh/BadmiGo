import { supabase, unwrap } from './client';
import type { Database } from './database.types';

export type Preferences = Database['public']['Tables']['notification_preferences']['Row'];

/**
 * Where this phone stands on push. iPhone only offers push to a web app that has been
 * added to the home screen, so "needs-install" is a state of its own, not a failure.
 */
export type PushState = 'unsupported' | 'needs-install' | 'blocked' | 'off' | 'on';

const VAPID_PUBLIC_KEY = process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY;

/** The key to subscribe with, or null where this browser or build cannot push. */
function pushKey(): string | null {
  const supported =
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    typeof window !== 'undefined' &&
    'PushManager' in window;
  return supported && VAPID_PUBLIC_KEY !== undefined && VAPID_PUBLIC_KEY !== ''
    ? VAPID_PUBLIC_KEY
    : null;
}

/** True on an iPhone that has the app open in a Safari tab rather than from the home screen. */
export function needsHomeScreenInstall(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    /iPhone|iPad/.test(navigator.userAgent) &&
    !window.matchMedia('(display-mode: standalone)').matches
  );
}

async function registration(): Promise<ServiceWorkerRegistration> {
  const base = process.env.EXPO_BASE_URL ?? '';
  return navigator.serviceWorker.register(`${base}/sw.js`, { scope: `${base}/` });
}

export async function pushState(): Promise<PushState> {
  if (pushKey() === null) return needsHomeScreenInstall() ? 'needs-install' : 'unsupported';
  if (Notification.permission === 'denied') return 'blocked';
  const subscription = await (await registration()).pushManager.getSubscription();
  return subscription === null ? 'off' : 'on';
}

/**
 * Asks for permission and subscribes this phone. Must run straight from a tap: iPhone
 * refuses a permission prompt that no gesture asked for.
 */
export async function turnOnPush(profileId: string): Promise<void> {
  const key = pushKey();
  if (key === null) throw new Error('this browser cannot receive notifications');
  if ((await Notification.requestPermission()) !== 'granted') {
    throw new Error('notifications were not allowed');
  }

  const subscription = await (await registration()).pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: fromBase64Url(key),
  });
  const { endpoint, keys } = subscription.toJSON();
  if (endpoint === undefined || keys === undefined) {
    throw new Error('the browser returned an incomplete subscription');
  }

  // Keyed by the endpoint, so a phone that changes hands moves with its new owner
  // instead of leaving the old one's address behind.
  const { error } = await supabase.from('push_subscriptions').upsert({
    endpoint,
    p256dh: keys.p256dh,
    auth: keys.auth,
    profile_id: profileId,
    updated_at: new Date().toISOString(),
  });
  if (error !== null) throw new Error(error.message);
}

/** Also called on sign-out, so the next member on this phone gets nobody else's pushes. */
export async function turnOffPush(): Promise<void> {
  if (pushKey() === null) return;
  const subscription = await (await registration()).pushManager.getSubscription();
  if (subscription === null) return;

  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('endpoint', subscription.endpoint);
  if (error !== null) throw new Error(error.message);
  await subscription.unsubscribe();
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const base64 = (value + '='.repeat((4 - (value.length % 4)) % 4))
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

/** The row exists from the moment the profile does, so this always finds one. */
export async function readPreferences(profileId: string): Promise<Preferences> {
  return unwrap(
    await supabase
      .from('notification_preferences')
      .select('*')
      .eq('profile_id', profileId)
      .single(),
  );
}

export async function updatePreferences(
  profileId: string,
  changes: Partial<
    Pick<
      Preferences,
      'confirmation_requests' | 'dispute_alerts' | 'weekly_recap' | 'overtaken_on_ladder'
    >
  >,
): Promise<void> {
  const { error } = await supabase
    .from('notification_preferences')
    .update({ ...changes, updated_at: new Date().toISOString() })
    .eq('profile_id', profileId);
  if (error !== null) throw new Error(error.message);
}
