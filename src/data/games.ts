import { invoke, supabase, unwrap } from './client';
import type { Database } from './database.types';
import type { GameFormat, ProfileId } from '../domain/types';

export type Game = Database['public']['Tables']['games']['Row'];

/**
 * One call, because a game is nine rows and a phone cannot open a transaction. The
 * score is checked by src/domain/validation before this is reached; the server adds
 * the structural guards and the daily cap.
 *
 * A photo is uploaded first, into the logger's own folder, which is the only place
 * the storage policy and the games table will accept it from.
 */
export async function logGame(input: {
  readonly format: GameFormat;
  readonly sideA: readonly [ProfileId, ProfileId];
  readonly sideB: readonly [ProfileId, ProfileId];
  readonly scoreA: number;
  readonly scoreB: number;
  readonly loggerId: ProfileId;
  readonly photo: Blob | null;
}): Promise<string> {
  const photoPath =
    input.photo === null ? undefined : await uploadPhoto(input.loggerId, input.photo);

  const gameId = unwrap(
    await supabase.rpc('log_game', {
      p_format: input.format,
      p_side_a: [...input.sideA],
      p_side_b: [...input.sideB],
      p_score_a: input.scoreA,
      p_score_b: input.scoreB,
      p_photo_path: photoPath,
    }),
  );

  // The other three are told by the server, not by this phone staying awake.
  await supabase.functions.invoke('notify-players', {
    body: { gameId, kind: 'confirmation-request' },
  });

  return gameId;
}

const PHOTO_BUCKET = 'game-photos';

async function uploadPhoto(loggerId: ProfileId, photo: Blob): Promise<string> {
  const path = `${loggerId}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, photo, { contentType: 'image/jpeg' });
  if (error !== null) throw new Error(error.message);
  return path;
}

/** The bucket is private, so a photo is shown through a link that expires. */
export async function photoUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrl(path, 3600);
  if (error !== null) throw new Error(error.message);
  return data.signedUrl;
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
  photo_path, logger_id,
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
