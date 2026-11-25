import { invoke, supabase, unwrap } from './client';
import type { Database } from './database.types';
import type { GameFormat, ProfileId } from '../domain/types';
import { searchPlayers } from './ladder';

export { Refused } from './client';

export type Game = Database['public']['Tables']['games']['Row'];

/**
 * One call, because a game is nine rows and a phone cannot open a transaction. The
 * score is checked by src/domain/validation before this is reached; the server adds
 * the structural guards and the daily cap.
 */
export async function logGame(input: {
  readonly format: GameFormat;
  readonly sideA: readonly [ProfileId, ProfileId];
  readonly sideB: readonly [ProfileId, ProfileId];
  readonly scoreA: number;
  readonly scoreB: number;
}): Promise<{ readonly gameId: string; readonly notified: boolean }> {
  const gameId = unwrap(
    await supabase.rpc('log_game', {
      p_format: input.format,
      p_side_a: [...input.sideA],
      p_side_b: [...input.sideB],
      p_score_a: input.scoreA,
      p_score_b: input.scoreB,
    }),
  );

  // The other three are told by the server, not by this phone staying awake. The game
  // is logged either way; a lost push is only worth a line telling the logger to ask.
  const notified = await invoke('notify-players', { gameId, kind: 'confirmation-request' }).then(
    () => true,
    () => false,
  );

  return { gameId, notified };
}

export type Answer = 'confirm' | 'dispute' | 'cancel';

export interface AnswerOutcome {
  readonly status: Database['public']['Enums']['game_status'];
  readonly replayed: boolean;
}

/**
 * Answers a logged game. The lifecycle decision is made server-side from the same
 * reducer the app uses to predict it, so a refusal here is a reason, not a failure.
 */
export function answerGame(gameId: string, answer: Answer): Promise<AnswerOutcome> {
  return invoke<AnswerOutcome>('confirm-game', { gameId, answer });
}

const FEED_SHAPE = `
  id, format, score_a, score_b, winning_side, played_at, created_at, status, void_reason,
  logger_id,
  game_participants (profile_id, side, profiles (username, display_name)),
  game_confirmations (profile_id, state, responded_at),
  rating_history (profile_id, display_before, display_after)
` as const;

/** Where the last page ended. The id breaks ties, since games can share a timestamp. */
export interface FeedCursor {
  readonly playedAt: string;
  readonly id: string;
}

export const FEED_PAGE = 30;

/** The club-wide feed: every confirmed game, newest first, with what it moved. */
export async function readFeed(before: FeedCursor | null = null) {
  const query = supabase
    .from('games')
    .select(FEED_SHAPE)
    .eq('status', 'confirmed')
    .order('played_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(FEED_PAGE);

  return unwrap(
    await (before === null
      ? query
      : query.or(
          `played_at.lt."${before.playedAt}",and(played_at.eq."${before.playedAt}",id.lt.${before.id})`,
        )),
  );
}

export interface FeedSearch {
  /** Part of a display name or username; empty means anyone. */
  readonly term: string;
  /** A day as a date input gives it, `YYYY-MM-DD`, or null for any day. */
  readonly day: string | null;
}

/** Enough for a whole session day, which runs to about forty games. */
const SEARCH_LIMIT = 100;

/**
 * Story 46a: confirmed games by player name, by day, or both, newest first. Names are
 * matched as the player picker matches them, then the games are filtered through an
 * aliased embed for the reason given on readMyPendingGames. The embed is selected
 * even with no name, so both kinds of search return the same row type.
 */
export async function searchFeed({ term, day }: FeedSearch) {
  let query = supabase
    .from('games')
    .select(`${FEED_SHAPE}, who:game_participants!inner (profile_id)`)
    .eq('status', 'confirmed')
    .order('played_at', { ascending: false })
    .limit(SEARCH_LIMIT);

  if (term.trim().length > 0) {
    const players = await searchPlayers(term);
    if (players.length === 0) return [];
    query = query.in(
      'who.profile_id',
      players.map((player) => player.id),
    );
  }

  if (day !== null) {
    const { from, to } = dayBounds(day);
    query = query.gte('played_at', from).lt('played_at', to);
  }

  return unwrap(await query);
}

/**
 * Midnight to midnight on the phone's own clock, which is the day the feed means by
 * "today" and "yesterday": a game at 23:30 on Saturday belongs to Saturday.
 */
function dayBounds(day: string): { readonly from: string; readonly to: string } {
  const [year, month, date] = day.split('-').map(Number);
  return {
    from: new Date(year, month - 1, date).toISOString(),
    to: new Date(year, month - 1, date + 1).toISOString(),
  };
}

/**
 * A game as every screen reads it: the row, its four players, their answers, and
 * what it moved. Named off the query rather than restated, so a change to
 * FEED_SHAPE reaches the screens through the compiler.
 */
export type GameRow = Awaited<ReturnType<typeof readFeed>>[number];

export async function readGame(gameId: string) {
  return unwrap(await supabase.from('games').select(FEED_SHAPE).eq('id', gameId).single());
}

/**
 * Every pending game this member is in, newest first — the banner on opening the
 * app, and the only route to a game the logger wants to cancel. Who still owes an
 * answer is read from the confirmations already carried in each row, so the screen
 * needs no second query to tell the two apart.
 *
 * Filtered through a separately aliased embed: filtering on game_participants itself
 * would also trim the lineup each row carries down to this one member.
 */
export async function readMyPendingGames(profileId: ProfileId) {
  return unwrap(
    await supabase
      .from('games')
      .select(`${FEED_SHAPE}, mine:game_participants!inner (profile_id)`)
      .eq('mine.profile_id', profileId)
      .eq('status', 'pending')
      .order('played_at', { ascending: false }),
  );
}

/**
 * What the admin reviews (story 70): every disputed game, and the confirmed games
 * logged since `since`. Which of them to flag is src/domain/flags' decision.
 */
export async function readGamesForReview(since: string) {
  return unwrap(
    await supabase
      .from('games')
      .select(FEED_SHAPE)
      .or(`status.eq.disputed,and(status.eq.confirmed,created_at.gte.${since})`)
      .order('created_at', { ascending: false }),
  );
}

/** Every confirmed game a player appeared in, for their profile and their stats. */
export async function readGamesFor(profileId: ProfileId) {
  return unwrap(
    await supabase
      .from('game_participants')
      .select(`game_id, side, games!inner (${FEED_SHAPE})`)
      .eq('profile_id', profileId)
      .eq('games.status', 'confirmed'),
  );
}
