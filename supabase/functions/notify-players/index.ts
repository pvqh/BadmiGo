import { callerClient, callerProfileId, json, serviceClient } from '../_shared/supabase.ts';
import type { ServiceClient } from '../_shared/supabase.ts';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

const KINDS = ['confirmation-request', 'dispute', 'confirmed'] as const;

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
 * Delivers a game's push to the people in it. Nothing about a rating is decided here
 * and nothing is written: this reads who played, respects what each of them asked to
 * be told, and hands the rest to Expo.
 *
 * Two kinds of caller. The functions that settle a game hold the service role. A
 * member whose phone has just logged a game asks for the confirmation request
 * itself, and is allowed to only for a game they played in.
 */
Deno.serve(async (request) => {
  const service = serviceClient();

  const body = parse(await request.json().catch(() => null));
  if (body === null) return json({ error: `kind must be one of ${KINDS.join(', ')}` }, 400);

  const participants = await service
    .from('game_participants')
    .select('profile_id')
    .eq('game_id', body.gameId);
  if (participants.error !== null) return json({ error: participants.error.message }, 500);
  if (participants.data.length === 0) return json({ error: 'no such game' }, 404);

  const playing = participants.data.map((row) => row.profile_id);
  const asker = await authorise(service, request, playing);
  if (asker === 'denied') return json({ error: 'not your game to announce' }, 403);

  const game = await service
    .from('games')
    .select('logger_id, status')
    .eq('id', body.gameId)
    .single();
  if (game.error !== null) return json({ error: game.error.message }, 500);

  const audience =
    body.kind === 'confirmation-request'
      ? playing.filter((profileId) => profileId !== game.data.logger_id)
      : playing;

  const tokens = await tokensFor(service, audience, body.kind);
  if (tokens.length === 0) return json({ sent: 0 });

  const sent = await send(tokens, body);
  return json({ sent });
});

/** A member may announce only a game they played in; the service role may announce any. */
async function authorise(
  service: ServiceClient,
  request: Request,
  playing: readonly string[],
): Promise<'service' | 'participant' | 'denied'> {
  const authorization = request.headers.get('Authorization');
  if (authorization === null) return 'denied';

  const role = await callerClient(authorization).rpc('current_role_name');
  if (role.error === null && role.data === 'service_role') return 'service';

  const profileId = await callerProfileId(service, request);
  if (profileId !== null && playing.includes(profileId)) return 'participant';
  return 'denied';
}

/**
 * A silent wake carries no message, so there is nothing for a member to have turned
 * off: the preferences cover the three notifications a phone actually shows.
 */
async function tokensFor(
  service: ServiceClient,
  audience: readonly string[],
  kind: Kind,
): Promise<readonly string[]> {
  let wanted = audience;

  if (kind !== 'confirmed') {
    const column = kind === 'dispute' ? 'dispute_alerts' : 'confirmation_requests';
    const preferences = await service
      .from('notification_preferences')
      .select('profile_id')
      .in('profile_id', [...audience])
      .eq(column, true);
    if (preferences.error !== null) throw new Error(preferences.error.message);
    wanted = preferences.data.map((row) => row.profile_id);
  }

  if (wanted.length === 0) return [];

  const tokens = await service
    .from('push_tokens')
    .select('token')
    .in('profile_id', [...wanted]);
  if (tokens.error !== null) throw new Error(tokens.error.message);
  return tokens.data.map((row) => row.token);
}

const MESSAGES: Record<Kind, { readonly title: string; readonly body: string } | null> = {
  'confirmation-request': {
    title: 'Confirm a game',
    body: 'Someone logged a game you played in. Tap to confirm it.',
  },
  dispute: {
    title: 'A game was disputed',
    body: 'Someone disagrees with a game you played in. Sort it out at the next session.',
  },
  // The widget refresh the spec asks for: it wakes the app and shows nothing.
  confirmed: null,
};

async function send(tokens: readonly string[], body: Body): Promise<number> {
  const message = MESSAGES[body.kind];
  const payload = tokens.map((token) => ({
    to: token,
    data: { gameId: body.gameId, kind: body.kind },
    ...(message === null
      ? { _contentAvailable: true }
      : { title: message.title, body: message.body, sound: 'default' }),
  }));

  const response = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`Expo push refused the batch: ${response.status}`);
  return tokens.length;
}
