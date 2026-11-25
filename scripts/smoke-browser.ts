/**
 * What only goes wrong between a browser and the server: CORS, refusals reaching the
 * screen as sentences, filters built from typed text, and a phone changing hands.
 * Called from smoke.ts once an admin exists and the game is confirmed.
 */
import { call, check, local, type Member } from './smoke-client.ts';

export async function assertBrowserEdges(gameId: string, members: readonly Member[]): Promise<void> {
  console.log('\nwhat a browser on another origin sees');
  // Not the second member: the admin checks reset their password, which ended their session.
  const [admin, , left] = members;

  // Every header supabase-js may send, x-retry-count included.
  const preflight = await fetch(`${local.API_URL}/functions/v1/confirm-game`, {
    method: 'OPTIONS',
    headers: {
      Origin: 'https://pvqh.github.io',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'authorization, x-client-info, apikey, content-type, x-retry-count',
    },
  });
  const allowed = preflight.headers.get('Access-Control-Allow-Headers') ?? '';
  check(preflight.headers.get('Access-Control-Allow-Origin') === '*', 'the preflight allows any origin');
  check(allowed.includes('x-retry-count'), "and every header the SDK sends, from the SDK's own list");

  const late = await call('/functions/v1/confirm-game', {
    token: left.token,
    body: { gameId, answer: 'confirm' },
  });
  check(late.status === 409, 'answering a confirmed game is refused');
  check(
    (late.body as { error: string }).error === 'Trận này đã được xác nhận rồi',
    'with a sentence, not a slug',
  );

  const stranger = await call('/functions/v1/notify-players', {
    token: left.token,
    body: { gameId: crypto.randomUUID(), kind: 'confirmation-request' },
  });
  check(stranger.status === 403, 'a game that does not exist looks the same as one that is not yours');

  const nobody = await call('/functions/v1/admin', {
    token: admin.token,
    body: { action: 'set-seed-tier', profileId: crypto.randomUUID(), seedTier: 'y' },
  });
  check(nobody.status === 409, 'a seed tier for a member who does not exist is refused');

  const term = 'Smoke, "0" (x)\\';
  const pattern = `"%${term.replace(/["\\]/g, '\\$&')}%"`;
  const search = await call(
    `/rest/v1/profiles?select=id&or=${encodeURIComponent(`(display_name.ilike.${pattern},username.ilike.${pattern})`)}`,
    { token: admin.token },
  );
  check(search.status === 200, 'a name with a comma, quotes and brackets is searched, not a broken filter');

  const newest = await call(
    '/rest/v1/games?select=id,played_at&status=eq.confirmed&order=played_at.desc,id.desc&limit=1',
    { token: admin.token },
  );
  const [top] = newest.body as { id: string; played_at: string }[];
  const cursor = `(played_at.lt."${top.played_at}",and(played_at.eq."${top.played_at}",id.lt.${top.id}))`;
  const older = await call(
    `/rest/v1/games?select=id&status=eq.confirmed&or=${encodeURIComponent(cursor)}`,
    { token: admin.token },
  );
  check(
    older.status === 200 && !(older.body as { id: string }[]).some((game) => game.id === top.id),
    'the next feed page starts after the last game shown',
  );

  console.log('\na phone changing hands');
  const endpoint = `https://push.example/${crypto.randomUUID()}`;
  for (const owner of [admin, left]) {
    const claimed = await call('/rest/v1/rpc/claim_push_subscription', {
      token: owner.token,
      body: { p_endpoint: endpoint, p_p256dh: 'key', p_auth: 'secret' },
    });
    check(claimed.status < 300, `${owner.username} can claim the phone's endpoint`);
  }
  const held = await call(
    `/rest/v1/push_subscriptions?select=profile_id&endpoint=eq.${encodeURIComponent(endpoint)}`,
    { token: local.SERVICE_ROLE_KEY },
  );
  check(
    (held.body as { profile_id: string }[])[0]?.profile_id === left.profileId,
    'and it now belongs to the second owner alone',
  );
}
