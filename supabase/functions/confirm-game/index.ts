import { applyGameEvent } from '../_shared/game-state.ts';
import { callerProfileId, json, serviceClient } from '../_shared/supabase.ts';
import type { GameEvent, GameStatus } from '../../../src/domain/game-lifecycle.ts';

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

Deno.serve(async (request) => {
  const service = serviceClient();

  const profileId = await callerProfileId(service, request);
  if (profileId === null) return json({ error: 'sign in first' }, 401);

  const body = parse(await request.json().catch(() => null));
  if (body === null) {
    return json({ error: `answer must be one of ${ANSWERS.join(', ')}` }, 400);
  }

  const event: GameEvent = { kind: body.answer, profileId };
  const outcome = await applyGameEvent(service, body.gameId, event);

  if (!outcome.ok) {
    if (outcome.reason === 'game-not-found') return json({ error: 'no such game' }, 404);
    if (outcome.reason === 'contended') return json({ error: 'try again' }, 503);
    return json({ rejection: outcome.reason }, 409);
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
    replayed = replay.error === null;
  }

  const notify = notificationFor(outcome.state.status);
  if (notify !== null) {
    await service.functions.invoke('notify-players', {
      body: { gameId: body.gameId, kind: notify },
    });
  }

  return json({ status: outcome.state.status, replayed });
});

function notificationFor(status: GameStatus): 'confirmed' | 'dispute' | null {
  if (status === 'confirmed') return 'confirmed';
  if (status === 'disputed') return 'dispute';
  return null;
}
