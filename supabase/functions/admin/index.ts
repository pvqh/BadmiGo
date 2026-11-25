import { MIN_PASSWORD, type AdminAction } from '../../../src/data/function-contract.ts';
import type { GameEvent } from '../../../src/domain/game-lifecycle.ts';
import { asGameFormat, asTier } from '../../../src/domain/types.ts';
import { validateScore } from '../../../src/domain/validation.ts';
import { applyGameEvent } from '../_shared/game-state.ts';
import { callerProfileId, json, preflight, serviceClient, type ServiceClient } from '../_shared/supabase.ts';

/**
 * Everything an admin does that a club member's own token must not (stories 5 and
 * 65–69). The service role does the writing, so the caller is checked here first; and
 * every action that changes what the ratings are computed from ends in a replay, so an
 * admin never leaves the ladder stale (story 67).
 *
 * Appointing another admin (story 72) is not here: row-level security already lets an
 * admin set is_admin directly, and it moves no rating.
 */
Deno.serve(async (request) => {
  const early = preflight(request);
  if (early !== null) return early;

  const service = serviceClient();

  const callerId = await callerProfileId(service, request);
  if (callerId === null) return json({ error: 'Hãy đăng nhập trước' }, 401);
  const caller = await service.from('profiles').select('is_admin').eq('id', callerId).maybeSingle();
  if (caller.error !== null) return json({ error: caller.error.message }, 500);
  if (caller.data?.is_admin !== true) return json({ error: 'Chỉ admin mới làm được việc này' }, 403);

  const body = parse(await request.json().catch(() => null));
  if (body === null) return json({ error: 'Không có thao tác quản trị này' }, 400);

  const problem = await perform(service, body);
  if (problem !== null) return json({ error: problem }, 409);

  if (body.action === 'reset-password') return json({ replayed: false });

  const replay = await service.functions.invoke('replay-ratings');
  if (replay.error !== null) console.error('replay after admin action failed', replay.error);
  return json({ replayed: replay.error === null });
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
      const { error } = await service
        .from('profiles')
        .update({ seed_tier: body.seedTier })
        .eq('id', body.profileId);
      return error === null ? null : error.message;
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
  }
}

async function applyEvent(
  service: ServiceClient,
  gameId: string,
  event: GameEvent,
): Promise<string | null> {
  const outcome = await applyGameEvent(service, gameId, event);
  return outcome.ok ? null : outcome.reason;
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
    default:
      return null;
  }
}
