import { pushEach, type Preference } from './push.ts';
import type { ServiceClient } from './supabase.ts';

export const GAME_PUSH_KINDS = ['confirmation-request', 'dispute'] as const;

export type GamePushKind = (typeof GAME_PUSH_KINDS)[number];

const MESSAGES: Record<
  GamePushKind,
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

/**
 * Delivers a game's push to the people in it: a confirmation request to the three who
 * did not log it, a dispute alert to all four. Returns how many phones accepted one.
 */
export async function announceGame(
  service: ServiceClient,
  gameId: string,
  kind: GamePushKind,
): Promise<number> {
  const game = await service
    .from('games')
    .select('logger_id, game_participants (profile_id)')
    .eq('id', gameId)
    .single();
  if (game.error !== null) throw new Error(game.error.message);

  const playing = game.data.game_participants.map((row) => row.profile_id);
  const audience =
    kind === 'confirmation-request'
      ? playing.filter((profileId) => profileId !== game.data.logger_id)
      : playing;

  const { preference, title, body } = MESSAGES[kind];
  const message = { title, body, path: `game/${gameId}` };
  return pushEach(service, preference, audience.map((profileId) => ({ profileId, message })));
}
