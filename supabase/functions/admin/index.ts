import { MIN_PASSWORD, type AdminAction } from '../../../src/data/function-contract.ts';
import type { GameEvent } from '../../../src/domain/game-lifecycle.ts';
import { asGameFormat, asTier } from '../../../src/domain/types.ts';
import { validateScore } from '../../../src/domain/validation.ts';
import { applyGameEvent, REFUSAL_MESSAGE } from '../_shared/game-state.ts';
import { replayClub } from '../_shared/replay.ts';
import { callerProfileId, json, serve, serviceClient, type ServiceClient } from '../_shared/supabase.ts';

/**
 * Everything an admin does that a club member's own token must not (stories 5,
 * 65–69 and 79). The service role does the writing, so the caller is checked here first; and
 * every action that changes what the ratings are computed from ends in a replay, so an
 * admin never leaves the ladder stale (story 67).
 *
 * Appointing another admin (story 72) is not here: row-level security already lets an
 * admin set is_admin directly, and it moves no rating.
 */
serve(async (request) => {
  const service = serviceClient();

  const callerId = await callerProfileId(service, request);
  if (callerId === null) return json({ error: 'Hãy đăng nhập trước' }, 401);
  const caller = await service.from('profiles').select('is_admin').eq('id', callerId).maybeSingle();
  if (caller.error !== null) return json({ error: caller.error.message }, 500);
  if (caller.data?.is_admin !== true) return json({ error: 'Chỉ admin mới làm được việc này' }, 403);

  const body = parse(await request.json().catch(() => null));
  if (body === null) return json({ error: 'Không có thao tác quản trị này' }, 400);

  // An admin who deleted themselves could leave the club with no admin at all.
  if (body.action === 'delete-account' && body.profileId === callerId) {
    return json({ error: 'Bạn không thể tự xoá tài khoản của mình' }, 409);
  }

  const problem = await perform(service, body);
  if (problem !== null) return json({ error: problem }, 409);

  if (body.action === 'reset-password') return json({ replayed: false });

  const replay = await replayClub(service);
  if (!replay.ok) console.error('replay after admin action failed', replay.message);
  return json({ replayed: replay.ok });
});

/** Null when done; otherwise the reason it was refused, in words for the admin. */
async function perform(service: ServiceClient, body: AdminAction): Promise<string | null> {
  switch (body.action) {
    case 'correct-score':
      return correctScore(service, body.gameId, body.scoreA, body.scoreB);
    case 'void':
      return applyEvent(service, body.gameId, { kind: 'void', reason: body.reason });
    case 'resolve':
      return applyEvent(service, body.gameId, { kind: 'resolve' });
    case 'set-seed-tier': {
      // Selected back, because an update that matches nobody is not an error to Postgres.
      const { data, error } = await service
        .from('profiles')
        .update({ seed_tier: body.seedTier })
        .eq('id', body.profileId)
        .select('id')
        .maybeSingle();
      if (error !== null) return error.message;
      return data === null ? 'Không tìm thấy người chơi này' : null;
    }
    case 'merge': {
      // Deletes the duplicate's login in the same transaction, so a failure leaves both.
      const { error } = await service.rpc('merge_profiles', {
        p_keep: body.keepId,
        p_merge: body.mergeId,
      });
      return error === null ? null : error.message;
    }
    case 'reset-password': {
      const { error } = await service.auth.admin.updateUserById(body.profileId, {
        password: body.password,
      });
      return error === null ? null : error.message;
    }
    case 'delete-account':
      return deleteAccount(service, body.profileId);
  }
}

async function applyEvent(
  service: ServiceClient,
  gameId: string,
  event: GameEvent,
): Promise<string | null> {
  const outcome = await applyGameEvent(service, gameId, event);
  return outcome.ok ? null : REFUSAL_MESSAGE[outcome.reason];
}

/**
 * Story 79. The database refuses anyone who has played, so only an account with no
 * games goes. The picture is removed afterwards and is not worth failing over: an
 * orphaned file is a few kilobytes, a half-deleted account is not.
 */
async function deleteAccount(service: ServiceClient, profileId: string): Promise<string | null> {
  const profile = await service.from('profiles').select('avatar_path').eq('id', profileId).maybeSingle();
  if (profile.error !== null) return profile.error.message;
  if (profile.data === null) return 'Không tìm thấy tài khoản này';

  const { error } = await service.rpc('delete_profile', { p_profile: profileId });
  if (error !== null) return error.message;

  const avatar = profile.data.avatar_path;
  if (avatar !== null) {
    const removed = await service.storage.from('avatars').remove([avatar]);
    if (removed.error !== null) console.error('avatar of a deleted account not removed', removed.error);
  }
  return null;
}

/**
 * Story 65. The score rules are src/domain/validation's, the same ones the log screen
 * checks; a voided game is history and is not corrected.
 */
async function correctScore(
  service: ServiceClient,
  gameId: string,
  scoreA: number,
  scoreB: number,
): Promise<string | null> {
  const game = await service.from('games').select('format, status').eq('id', gameId).maybeSingle();
  if (game.error !== null) return game.error.message;
  if (game.data === null) return 'Không tìm thấy trận này';
  if (game.data.status === 'voided') return 'Trận đã gỡ thì không sửa được';
  const format = asGameFormat(game.data.format);
  if (format === null) return `Câu lạc bộ không đánh trận tới ${game.data.format}`;
  if (!validateScore(format, scoreA, scoreB)) {
    return `${scoreA}–${scoreB} không phải tỉ số hợp lệ cho trận tới ${format}`;
  }

  const { error } = await service
    .from('games')
    .update({ score_a: scoreA, score_b: scoreB })
    .eq('id', gameId);
  return error === null ? null : error.message;
}

function parse(payload: unknown): AdminAction | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const body = payload as Record<string, unknown>;
  const text = (key: string) =>
    typeof body[key] === 'string' && body[key] !== '' ? (body[key] as string) : null;
  const whole = (key: string) => (Number.isInteger(body[key]) ? (body[key] as number) : null);

  switch (body.action) {
    case 'correct-score': {
      const gameId = text('gameId');
      const scoreA = whole('scoreA');
      const scoreB = whole('scoreB');
      if (gameId === null || scoreA === null || scoreB === null) return null;
      return { action: 'correct-score', gameId, scoreA, scoreB };
    }
    case 'void': {
      const gameId = text('gameId');
      const reason = text('reason');
      return gameId === null || reason === null ? null : { action: 'void', gameId, reason };
    }
    case 'resolve': {
      const gameId = text('gameId');
      return gameId === null ? null : { action: 'resolve', gameId };
    }
    case 'set-seed-tier': {
      const profileId = text('profileId');
      const seedTier = asTier(body.seedTier);
      if (profileId === null || seedTier === null) return null;
      return { action: 'set-seed-tier', profileId, seedTier };
    }
    case 'merge': {
      const keepId = text('keepId');
      const mergeId = text('mergeId');
      return keepId === null || mergeId === null ? null : { action: 'merge', keepId, mergeId };
    }
    case 'reset-password': {
      const profileId = text('profileId');
      const password = text('password');
      if (profileId === null || password === null || password.length < MIN_PASSWORD) return null;
      return { action: 'reset-password', profileId, password };
    }
    case 'delete-account': {
      const profileId = text('profileId');
      return profileId === null ? null : { action: 'delete-account', profileId };
    }
    default:
      return null;
  }
}
