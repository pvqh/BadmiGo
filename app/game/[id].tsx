import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { CANCELLED_BY_LOGGER, type ConfirmationState } from '../../src/domain/game-lifecycle';
import { Pending, Problem } from '../../src/ui/components/async';
import { AdminGamePanel } from '../../src/ui/components/admin-game-panel';
import { Button, ButtonRow } from '../../src/ui/components/button';
import { GameCard } from '../../src/ui/components/game-card';
import { answerOf, lineupOf } from '../../src/ui/game-row';
import { useAnswerGame, useGame } from '../../src/ui/queries';
import { useMember } from '../../src/ui/session';
import { colour, font, layout, space } from '../../src/ui/theme';

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

      {row.status !== 'pending' ? null : (
        <View style={layout.card}>
          <Text style={font.heading}>Ai đã xác nhận</Text>
          {everyone.map((player) => {
            const answer = answerOf(row, player.profileId);
            const state = answer === null ? 'pending' : answer.state;
            return (
              <View key={player.profileId} style={layout.spread}>
                <Text style={font.body}>
                  {player.profileId === me.id ? 'Bạn' : player.displayName}
                  {player.profileId === row.logger_id ? ' (người ghi)' : ''}
                </Text>
                <Text style={[font.dim, { color: stateColour(state), fontWeight: '700' }]}>{STATE_LABEL[state]}</Text>
              </View>
            );
          })}
        </View>
      )}

      {owed ? (
        <View style={{ gap: space.row }}>
          <Text style={font.heading}>Tỉ số này đúng không?</Text>
          <ButtonRow>
            <Button
              busy={answering.isPending}
              label="Đúng, xác nhận"
              onPress={() => answering.mutate({ gameId: row.id, answer: 'confirm' })}
            />
            <Button
              busy={answering.isPending}
              label="Sai, phản đối"
              onPress={() => answering.mutate({ gameId: row.id, answer: 'dispute' })}
              tone="danger"
            />
          </ButtonRow>
          <Text style={font.dim}>
            Phản đối sẽ đóng băng trận này và báo cho ba người còn lại, để mọi người cùng
            xem lại ở buổi chơi sau.
          </Text>
        </View>
      ) : null}

      {row.status === 'disputed' ? (
        <Text style={font.dim}>
          Đang đóng băng, chưa làm thay đổi điểm của ai. Khi mọi người thống nhất, admin
          có thể sửa tỉ số hoặc gỡ trận này.
        </Text>
      ) : null}

      {row.status === 'voided' ? (
        <Text style={font.dim}>
          {row.void_reason === CANCELLED_BY_LOGGER
            ? 'Người ghi đã huỷ trận này. Trận không được tính điểm.'
            : `Admin đã gỡ trận này${row.void_reason === null ? '' : `: ${row.void_reason}`}. Trận không được tính điểm.`}
        </Text>
      ) : null}

      {canCancel ? (
        <View style={{ gap: space.row }}>
          {armed ? (
            <ButtonRow>
              <Button
                busy={answering.isPending}
                label="Huỷ trận"
                onPress={() =>
                  answering.mutate(
                    { gameId: row.id, answer: 'cancel' },
                    // Opened from a notification, there is no history to go back to.
                    { onSuccess: () => (router.canGoBack() ? router.back() : router.replace('/feed')) },
                  )
                }
                tone="danger"
              />
              <Button label="Giữ lại" onPress={() => setArmed(false)} tone="quiet" />
            </ButtonRow>
          ) : (
            <Button label="Huỷ trận này" onPress={() => setArmed(true)} tone="quiet" />
          )}
          {armed ? (
            <Text style={font.dim}>Trận sẽ biến mất với cả bốn người.</Text>
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
  pending: 'đang chờ',
  confirmed: 'đã xác nhận',
  disputed: 'phản đối',
};

function stateColour(state: ConfirmationState): string {
  if (state === 'confirmed') return colour.up;
  if (state === 'disputed') return colour.down;
  return colour.pending;
}
