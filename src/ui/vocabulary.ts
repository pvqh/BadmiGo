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

/** A rating move, written the way a feed reads it: +24, −11, or ±0. */
export function describeDelta(before: number, after: number): string {
  const delta = after - before;
  if (delta === 0) return '±0';
  return delta > 0 ? `+${delta}` : `−${Math.abs(delta)}`;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** The club reads Vietnamese, whatever language the phone is set to. */
const LOCALE = 'vi-VN';

/** Short and relative, because a feed is read in the few days after a session. */
export function describeWhen(playedAt: string, now: number): string {
  const played = new Date(playedAt);
  const days = Math.floor((startOfDay(now) - startOfDay(played.getTime())) / DAY_MS);

  if (days <= 0) return `hôm nay ${clock(played)}`;
  if (days === 1) return `hôm qua ${clock(played)}`;
  if (days < 7) return `${days} ngày trước`;
  return played.toLocaleDateString(LOCALE, { day: 'numeric', month: 'numeric' });
}

/** A day picked on the feed, `YYYY-MM-DD`, as "Th 7, 22/11". */
export function describeDay(day: string): string {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(year, month - 1, date).toLocaleDateString(LOCALE, {
    weekday: 'short',
    day: 'numeric',
    month: 'numeric',
  });
}

/**
 * The heading a day's games sit under on the feed: "Hôm nay", "Hôm qua", or the
 * weekday and date, because a session is remembered by the day it was played.
 */
export function describeSessionDay(playedAt: string, now: number): string {
  const played = new Date(playedAt);
  const days = Math.floor((startOfDay(now) - startOfDay(played.getTime())) / DAY_MS);
  if (days <= 0) return 'Hôm nay';
  if (days === 1) return 'Hôm qua';
  const label = played.toLocaleDateString(LOCALE, {
    weekday: 'long',
    day: 'numeric',
    month: 'numeric',
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** The calendar day a game was played on, by the phone's clock, for grouping. */
export function dayKey(playedAt: string): number {
  return startOfDay(new Date(playedAt).getTime());
}

/** How long the other participants still have, for a pending game. */
export function describeDeadline(remainingMs: number): string {
  if (remainingMs <= 0) return 'đang tự xác nhận';
  const hours = Math.floor(remainingMs / (60 * 60 * 1000));
  if (hours >= 1) return `còn ${hours} giờ để trả lời`;
  return `còn ${Math.max(1, Math.floor(remainingMs / 60_000))} phút để trả lời`;
}

function startOfDay(at: number): number {
  const date = new Date(at);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function clock(at: Date): string {
  return at.toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' });
}
