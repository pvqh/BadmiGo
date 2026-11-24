import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { GameRow } from '../../data/games';
import type { ProfileId } from '../../domain/types';
import {
  autoAcceptsIn,
  lineupOf,
  moveFor,
  stillToAnswer,
  winnerOf,
  type Player,
} from '../game-row';
import { colour, font, layout } from '../theme';
import { describeDeadline, describeDelta, describeWhen } from '../vocabulary';
import { StatusChip } from './badge';

/**
 * One game, as the feed, the pending list and a profile all show it: a small
 * scoreboard with each player's rating move beside their name — story 73, every game
 * carries every name.
 */
export function GameCard({
  row,
  now,
  viewerId,
  onPress,
}: {
  readonly row: GameRow;
  readonly now: number;
  readonly viewerId: ProfileId;
  readonly onPress?: () => void;
}) {
  const { a, b } = lineupOf(row);
  const winner = winnerOf(row);

  return (
    <Pressable
      accessibilityRole={onPress === undefined ? undefined : 'button'}
      disabled={onPress === undefined}
      onPress={onPress}
      style={({ pressed }) => [layout.card, pressed ? { opacity: 0.7 } : null]}
    >
      <View style={layout.spread}>
        <Text style={font.dim}>{`${describeWhen(row.played_at, now)}, game to ${row.format}`}</Text>
        {row.status === 'confirmed' ? null : <StatusChip status={row.status} />}
      </View>

      <SideLine players={a} row={row} score={row.score_a} viewerId={viewerId} won={winner === 'a'} />
      <View style={layout.rule} />
      <SideLine players={b} row={row} score={row.score_b} viewerId={viewerId} won={winner === 'b'} />

      {row.status === 'pending' ? (
        <Text style={font.dim}>
          {`${4 - stillToAnswer(row)} of 4 confirmed, ${describeDeadline(autoAcceptsIn(row, now))}`}
        </Text>
      ) : null}
    </Pressable>
  );
}

function SideLine({
  players,
  row,
  score,
  won,
  viewerId,
}: {
  readonly players: readonly Player[];
  readonly row: GameRow;
  readonly score: number;
  readonly won: boolean;
  readonly viewerId: ProfileId;
}) {
  return (
    <View style={layout.spread}>
      <View style={{ flex: 1, gap: 2 }}>
        {players.map((player) => (
          <Name key={player.profileId} player={player} row={row} viewerId={viewerId} won={won} />
        ))}
      </View>
      <Text style={[font.score, style.score, won ? null : style.lost]}>{score}</Text>
    </View>
  );
}

function Name({
  player,
  row,
  won,
  viewerId,
}: {
  readonly player: Player;
  readonly row: GameRow;
  readonly won: boolean;
  readonly viewerId: ProfileId;
}) {
  const mine = player.profileId === viewerId;
  const move = row.status === 'confirmed' ? moveFor(row, player.profileId) : null;
  const delta = move === null ? 0 : move.display_after - move.display_before;

  return (
    <View style={layout.row}>
      <Text
        numberOfLines={1}
        style={[font.body, won ? style.won : style.lost, mine ? style.mine : null, { flexShrink: 1 }]}
      >
        {mine ? 'You' : player.displayName}
      </Text>
      {move === null ? null : (
        <Text
          style={[
            font.figure,
            style.delta,
            { color: delta > 0 ? colour.up : delta < 0 ? colour.down : colour.dim },
          ]}
        >
          {describeDelta(move.display_before, move.display_after)}
        </Text>
      )}
    </View>
  );
}

const style = StyleSheet.create({
  won: { fontWeight: '600' },
  lost: { color: colour.dim },
  mine: { color: colour.accent },
  score: { fontSize: 36, minWidth: 48, textAlign: 'right' },
  delta: { fontSize: 15 },
});
