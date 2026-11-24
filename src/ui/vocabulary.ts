import type { Tier } from '../domain/types';

/**
 * The club's own words, spelled for the screen. The domain uses the slugs; nothing
 * outside this file should write these labels, so they cannot drift into synonyms.
 */
export const TIER_LABEL: Record<Tier, string> = {
  newbie: 'Newbie',
  y: 'Y',
  tby: 'TB',
  'tb-plus': 'TB+',
  kha: 'Khá',
};

/** Declared at signup, in the order a player would climb them. */
export const TIER_ORDER: readonly Tier[] = ['newbie', 'y', 'tby', 'tb-plus', 'kha'];

/** A rating move, written the way a feed reads it: +24, -11, or level. */
export function describeDelta(before: number, after: number): string {
  const delta = after - before;
  if (delta === 0) return 'level';
  return delta > 0 ? `+${delta}` : `${delta}`;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Short and relative, because a feed is read in the few days after a session. */
export function describeWhen(playedAt: string, now: number): string {
  const played = new Date(playedAt);
  const days = Math.floor((startOfDay(now) - startOfDay(played.getTime())) / DAY_MS);

  if (days <= 0) return `today ${clock(played)}`;
  if (days === 1) return `yesterday ${clock(played)}`;
  if (days < 7) return `${days} days ago`;
  return played.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/** How long the other participants still have, for a pending game. */
export function describeDeadline(remainingMs: number): string {
  if (remainingMs <= 0) return 'accepting now';
  const hours = Math.floor(remainingMs / (60 * 60 * 1000));
  if (hours >= 1) return `${hours}h left to answer`;
  return `${Math.max(1, Math.floor(remainingMs / 60_000))}m left to answer`;
}

function startOfDay(at: number): number {
  const date = new Date(at);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function clock(at: Date): string {
  return at.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}
