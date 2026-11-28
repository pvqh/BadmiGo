import { announceGame, GAME_PUSH_KINDS, type GamePushKind } from '../_shared/game-push.ts';
import { callerProfileId, json, serve, serviceClient } from '../_shared/supabase.ts';

interface Body {
  readonly gameId: string;
  readonly kind: GamePushKind;
}

function parse(payload: unknown): Body | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const { gameId, kind } = payload as Record<string, unknown>;
  if (typeof gameId !== 'string' || gameId === '') return null;
  if (typeof kind !== 'string' || !GAME_PUSH_KINDS.includes(kind as GamePushKind)) return null;
  return { gameId, kind: kind as GamePushKind };
}

/**
 * A member whose phone has just logged a game asks for the confirmation request
 * itself, and may only for a game they played in. The dispute alert is sent by
 * confirm-game directly.
 */
serve(async (request) => {
  const service = serviceClient();

  const asker = await callerProfileId(service, request);
  if (asker === null) return json({ error: 'Hãy đăng nhập trước' }, 401);

  const body = parse(await request.json().catch(() => null));
  if (body === null) return json({ error: 'Không có loại thông báo này' }, 400);

  // A member hears "not yours" for a game that does not exist too, so the reply
  // cannot be used to tell which games exist.
  const playing = await service
    .from('game_participants')
    .select('profile_id')
    .eq('game_id', body.gameId)
    .eq('profile_id', asker)
    .maybeSingle();
  if (playing.error !== null) return json({ error: playing.error.message }, 500);
  if (playing.data === null) return json({ error: 'Bạn không ở trong trận này' }, 403);

  return json({ sent: await announceGame(service, body.gameId, body.kind) });
});
