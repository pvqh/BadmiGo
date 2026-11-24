import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, ScrollView, Text, View } from 'react-native';
import type { ConfirmationState } from '../../src/domain/game-lifecycle';
import { Pending, Problem } from '../../src/ui/components/async';
import { AdminGamePanel } from '../../src/ui/components/admin-game-panel';
import { Button, ButtonRow } from '../../src/ui/components/button';
import { GameCard } from '../../src/ui/components/game-card';
import { answerOf, lineupOf } from '../../src/ui/game-row';
import { useAnswerGame, useGame, usePhotoUrl } from '../../src/ui/queries';
import { useMember } from '../../src/ui/session';
import { colour, font, layout, radius, space } from '../../src/ui/theme';

/**
 * One game in full, and whatever is still open to the viewer. Who has answered is
 * shown only while it matters — story 45 does not want it once a game is settled. Every decision here is the server's — this screen only offers the events
 * the lifecycle would accept and reports what came back.
 */
export default function GameDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const me = useMember();

  const game = useGame(id);
  const photo = usePhotoUrl(game.data?.photo_path ?? null);
  const answering = useAnswerGame(me.id);
  const [armed, setArmed] = useState(false);
  const now = Date.now();

  if (game.isPending) return <Pending />;
  if (game.isError) {
    return <Problem message={game.error.message} onRetry={() => void game.refetch()} />;
  }

  const row = game.data;
  const { a, b } = lineupOf(row);
  const everyone = [...a, ...b];
  const mine = answerOf(row, me.id);
  const owed = row.status === 'pending' && mine?.state === 'pending';
  const canCancel = row.status === 'pending' && row.logger_id === me.id;

  return (
    <ScrollView contentContainerStyle={layout.page} style={layout.screen}>
      <GameCard now={now} row={row} viewerId={me.id} />

      {photo.data === undefined ? null : (
        <Image
          accessibilityLabel="Photo from the game"
          source={{ uri: photo.data }}
          style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: radius.card }}
        />
      )}

      {row.status !== 'pending' ? null : (
        <View style={layout.card}>
          <Text style={font.heading}>Who has confirmed</Text>
          {everyone.map((player) => {
            const answer = answerOf(row, player.profileId);
            const state = answer === null ? 'pending' : answer.state;
            return (
              <View key={player.profileId} style={layout.spread}>
                <Text style={font.body}>
                  {player.displayName}
                  {player.profileId === row.logger_id ? ' (logged it)' : ''}
                </Text>
                <Text style={[font.dim, { color: stateColour(state) }]}>{STATE_LABEL[state]}</Text>
              </View>
            );
          })}
        </View>
      )}

      {owed ? (
        <View style={{ gap: space.row }}>
          <Text style={font.heading}>Is this score right?</Text>
          <ButtonRow>
            <Button
              busy={answering.isPending}
              label="Yes, confirm"
              onPress={() => answering.mutate({ gameId: row.id, answer: 'confirm' })}
            />
            <Button
              busy={answering.isPending}
              label="No, dispute"
              onPress={() => answering.mutate({ gameId: row.id, answer: 'dispute' })}
              tone="danger"
            />
          </ButtonRow>
          <Text style={font.dim}>
            A dispute freezes the game and tells the other three, so you can sort it out
            at the next session.
          </Text>
        </View>
      ) : null}

      {row.status === 'disputed' ? (
        <Text style={font.dim}>
          Frozen. It has not moved anyone's rating. Once you agree what happened, an
          admin can fix the score or remove the game.
        </Text>
      ) : null}

      {row.status === 'voided' ? (
        <Text style={font.dim}>
          {`Removed by an admin${row.void_reason === null ? '' : `: ${row.void_reason}`}. It does not count towards any rating.`}
        </Text>
      ) : null}

      {canCancel ? (
        <View style={{ gap: space.row }}>
          {armed ? (
            <ButtonRow>
              <Button
                busy={answering.isPending}
                label="Cancel game"
                onPress={() =>
                  answering.mutate(
                    { gameId: row.id, answer: 'cancel' },
                    { onSuccess: () => router.back() },
                  )
                }
                tone="danger"
              />
              <Button label="Keep it" onPress={() => setArmed(false)} tone="quiet" />
            </ButtonRow>
          ) : (
            <Button label="Cancel this game" onPress={() => setArmed(true)} tone="quiet" />
          )}
          {armed ? (
            <Text style={font.dim}>It disappears for all four players.</Text>
          ) : null}
        </View>
      ) : null}

      {answering.isError ? (
        <Text style={[font.dim, { color: colour.down }]}>{answering.error.message}</Text>
      ) : null}

      {me.is_admin ? <AdminGamePanel row={row} /> : null}
    </ScrollView>
  );
}

const STATE_LABEL: Record<ConfirmationState, string> = {
  pending: 'waiting',
  confirmed: 'confirmed',
  disputed: 'disputed',
};

function stateColour(state: ConfirmationState): string {
  if (state === 'confirmed') return colour.up;
  if (state === 'disputed') return colour.down;
  return colour.pending;
}
