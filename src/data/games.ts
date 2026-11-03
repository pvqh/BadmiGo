import { supabase, unwrap } from './client';
import type { Database } from './database.types';
import type { GameFormat, ProfileId } from '../domain/types';

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
  readonly photoPath?: string;
}): Promise<string> {
  const gameId = unwrap(
    await supabase.rpc('log_game', {
      p_format: input.format,
      p_side_a: [...input.sideA],
      p_side_b: [...input.sideB],
      p_score_a: input.scoreA,
      p_score_b: input.scoreB,
      p_photo_path: input.photoPath,
    }),
  );

  // The other three are told by the server, not by this phone staying awake.
  await supabase.functions.invoke('notify-players', {
    body: { gameId, kind: 'confirmation-request' },
  });

  return gameId;
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
export async function answerGame(gameId: string, answer: Answer): Promise<AnswerOutcome> {
  const { data, error } = await supabase.functions.invoke<AnswerOutcome>('confirm-game', {
    body: { gameId, answer },
  });
  if (error !== null) throw new Error(error.message);
  if (data === null) throw new Error('confirm-game returned nothing');
  return data;
}

const FEED_SHAPE = `
  id, format, score_a, score_b, winning_side, played_at, status, photo_path, logger_id,
  game_participants (profile_id, side, profiles (username, display_name)),
  game_confirmations (profile_id, state, responded_at),
  rating_history (profile_id, display_before, display_after)
` as const;

/** The club-wide feed: every confirmed game, newest first, with what it moved. */
export async function readFeed(limit = 30, before?: string) {
  const query = supabase
    .from('games')
    .select(FEED_SHAPE)
    .eq('status', 'confirmed')
    .order('played_at', { ascending: false })
    .limit(limit);

  return unwrap(await (before === undefined ? query : query.lt('played_at', before)));
}

export async function readGame(gameId: string) {
  return unwrap(await supabase.from('games').select(FEED_SHAPE).eq('id', gameId).single());
}

/** The banner on opening the app: games this member has not answered yet. */
export async function readAwaitingMyAnswer(profileId: ProfileId) {
  return unwrap(
    await supabase
      .from('game_confirmations')
      .select(`game_id, games!inner (${FEED_SHAPE})`)
      .eq('profile_id', profileId)
      .eq('state', 'pending')
      .eq('games.status', 'pending'),
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
