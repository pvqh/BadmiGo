import { pushEach, type Message, type Preference } from '../_shared/push.ts';
import { callerClient, callerProfileId, json, serve, serviceClient } from '../_shared/supabase.ts';
import type { ServiceClient } from '../_shared/supabase.ts';

const KINDS = ['confirmation-request', 'dispute'] as const;

type Kind = (typeof KINDS)[number];

interface Body {
  readonly gameId: string;
  readonly kind: Kind;
}

function parse(payload: unknown): Body | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const { gameId, kind } = payload as Record<string, unknown>;
  if (typeof gameId !== 'string' || gameId === '') return null;
  if (typeof kind !== 'string' || !KINDS.includes(kind as Kind)) return null;
  return { gameId, kind: kind as Kind };
}

/**
 * Delivers a game's push to the people in it. Nothing about a rating is decided here:
 * this reads who played and hands them to the shared sender, which respects what each
 * of them asked to be told.
 *
 * Two kinds of caller. The functions that settle a game hold the service role. A
 * member whose phone has just logged a game asks for the confirmation request
 * itself, and is allowed to only for a game they played in.
 */
serve(async (request) => {
  const service = serviceClient();

  const asker = await askerOf(service, request);
  if (asker === null) return json({ error: 'Hãy đăng nhập trước' }, 401);

  const body = parse(await request.json().catch(() => null));
  if (body === null) return json({ error: 'Không có loại thông báo này' }, 400);

  const participants = await service
    .from('game_participants')
    .select('profile_id')
    .eq('game_id', body.gameId);
  if (participants.error !== null) return json({ error: participants.error.message }, 500);

  // A member hears "not yours" for a game that does not exist too, so the reply
  // cannot be used to tell which games exist.
  const playing = participants.data.map((row) => row.profile_id);
  if (asker !== SERVICE && !playing.includes(asker)) {
    return json({ error: 'Bạn không ở trong trận này' }, 403);
  }
  if (playing.length === 0) return json({ error: 'Không tìm thấy trận này' }, 404);

  const game = await service
    .from('games')
    .select('logger_id')
    .eq('id', body.gameId)
    .single();
  if (game.error !== null) return json({ error: game.error.message }, 500);

  const audience =
    body.kind === 'confirmation-request'
      ? playing.filter((profileId) => profileId !== game.data.logger_id)
      : playing;

  const { preference, title, body: text } = MESSAGES[body.kind];
  const message: Message = { title, body: text, path: `game/${body.gameId}` };
  const sent = await pushEach(
    service,
    preference,
    audience.map((profileId) => ({ profileId, message })),
  );
  return json({ sent });
});

const SERVICE = Symbol('service role');

/**
 * The service role may announce any game; a member, only one they played in, which
 * is checked once the game is read. Null for a caller who is neither.
 */
async function askerOf(
  service: ServiceClient,
  request: Request,
): Promise<typeof SERVICE | string | null> {
  const authorization = request.headers.get('Authorization');
  if (authorization === null) return null;

  const role = await callerClient(authorization).rpc('current_role_name');
  if (role.error === null && role.data === 'service_role') return SERVICE;

  return callerProfileId(service, request);
}

const MESSAGES: Record<
  Kind,
  { readonly preference: Preference; readonly title: string; readonly body: string }
> = {
  'confirmation-request': {
    preference: 'confirmation_requests',
    title: 'Xác nhận trận đấu',
    body: 'Có người vừa ghi một trận bạn đã chơi. Chạm để xác nhận.',
  },
  dispute: {
    preference: 'dispute_alerts',
    title: 'Một trận bị phản đối',
    body: 'Có người không đồng ý với một trận bạn đã chơi. Cùng xem lại ở buổi chơi sau nhé.',
  },
};
