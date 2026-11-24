import { applyGameEvent } from '../_shared/game-state.ts';
import { callerClient, json } from '../_shared/supabase.ts';

/**
 * Sweeps games nobody answered, so one member who does not open the app cannot hold
 * the ladder hostage. The twenty-four hours belong to src/domain/game-lifecycle: this
 * offers every pending game an elapse event and the reducer decides which are ripe.
 *
 * Scheduled hourly. Runs as its caller, and the write it ends in is granted to
 * service_role alone, so a club member cannot sweep the club's pending games.
 */
Deno.serve(async (request) => {
  const authorization = request.headers.get('Authorization');
  if (authorization === null) return json({ error: 'sign in first' }, 401);
  const caller = callerClient(authorization);

  /*
   * Checked up front rather than left to the write at the end of the loop: the first
   * privileged call is deep inside, so without this a member would get a 500 on the
   * one run that had a ripe game and a 200 on every other.
   */
  const role = await caller.rpc('current_role_name');
  if (role.error !== null || role.data !== 'service_role') {
    return json({ error: 'the sweep belongs to the scheduler' }, 403);
  }

  const pending = await caller.from('games').select('id').eq('status', 'pending');
  if (pending.error !== null) return json({ error: pending.error.message }, 500);

  const now = Date.now();
  const accepted: string[] = [];
  for (const game of pending.data) {
    const outcome = await applyGameEvent(caller, game.id, { kind: 'elapse', now });
    if (outcome.ok) accepted.push(game.id);
  }

  // One replay for the whole sweep. `replayed` is what the scheduler's log is read
  // for, so a quiet hour reports false rather than claiming a replay that never ran.
  let replayed = false;
  if (accepted.length > 0) {
    const replay = await caller.functions.invoke('replay-ratings');
    if (replay.error !== null) console.error('replay after auto-accept failed', replay.error);
    replayed = replay.error === null;
  }

  return json({ swept: pending.data.length, accepted: accepted.length, replayed });
});
