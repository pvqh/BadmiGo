import { applyGameEvent, REFUSAL_MESSAGE } from '../_shared/game-state.ts';
import { callerProfileId, json, serve, serviceClient } from '../_shared/supabase.ts';
import type { GameEvent } from '../../../src/domain/game-lifecycle.ts';

/**
 * A participant's answer to a logged game. The three answers a phone may send are
 * here; void and resolve are the admin's and do not belong on this route.
 */
const ANSWERS = ['confirm', 'dispute', 'cancel'] as const;

type Answer = (typeof ANSWERS)[number];

interface Body {
  readonly gameId: string;
  readonly answer: Answer;
}

function parse(payload: unknown): Body | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const { gameId, answer } = payload as Record<string, unknown>;
  if (typeof gameId !== 'string' || gameId === '') return null;
  if (typeof answer !== 'string') return null;
  if (!ANSWERS.includes(answer as Answer)) return null;
  return { gameId, answer: answer as Answer };
}

serve(async (request) => {
  const service = serviceClient();

  const profileId = await callerProfileId(service, request);
  if (profileId === null) return json({ error: 'Hãy đăng nhập trước' }, 401);

  const body = parse(await request.json().catch(() => null));
  if (body === null) {
    return json({ error: 'Câu trả lời không hợp lệ' }, 400);
  }

  const event: GameEvent = { kind: body.answer, profileId };
  const outcome = await applyGameEvent(service, body.gameId, event);

  if (!outcome.ok) {
    const status =
      outcome.reason === 'game-not-found' ? 404 : outcome.reason === 'contended' ? 503 : 409;
    return json({ error: REFUSAL_MESSAGE[outcome.reason] }, status);
  }

  /*
   * The game has moved; ratings have not. Replaying here rather than on a schedule is
   * what makes a confirming player see the ladder change. A failure past this point
   * leaves the record right and the ladder stale, which rating_replay_state shows, so
   * it is reported rather than turned into a failed confirmation the client retries.
   */
  let replayed = false;
  if (outcome.state.status === 'confirmed') {
    const replay = await service.functions.invoke('replay-ratings');
    if (replay.error !== null) console.error('replay after confirmation failed', replay.error);
    replayed = replay.error === null;
  }

  // The dispute stands whether or not the alert goes out; a lost one is only logged.
  if (outcome.state.status === 'disputed') {
    const alert = await service.functions.invoke('notify-players', {
      body: { gameId: body.gameId, kind: 'dispute' },
    });
    if (alert.error !== null) console.error('dispute alert failed', alert.error);
  }

  return json({ status: outcome.state.status, replayed });
});
