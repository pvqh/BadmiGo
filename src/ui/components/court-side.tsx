import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { PreviewedChange } from '../../domain/rating-preview';
import type { ProfileId } from '../../domain/types';
import { colour, font, radius, space } from '../theme';
import { describeDelta } from '../vocabulary';
import type { Pickable } from './player-picker';

/**
 * One half of the court on the log screen: the pair who stood there and the points
 * they scored, so who partnered whom is drawn rather than described.
 */
export function CourtSide({
  label,
  players,
  locked,
  score,
  onScore,
  onPick,
  onClear,
  stakes,
}: {
  readonly label: string;
  readonly players: readonly (Pickable | null)[];
  /** Whoever cannot be swapped out: the logger, who must have played. */
  readonly locked?: ProfileId;
  readonly score: string;
  readonly onScore: (score: string) => void;
  readonly onPick: (slot: number) => void;
  readonly onClear: (slot: number) => void;
  readonly stakes: ReadonlyMap<ProfileId, PreviewedChange> | null;
}) {
  return (
    <View style={style.side}>
      <View style={{ flex: 1, gap: space.row }}>
        <Text style={[font.dim, { color: colour.onCourtDim, fontWeight: '600' }]}>{label}</Text>
        {players.map((player, slot) => (
          <Slot
            key={slot}
            locked={player !== null && player.profileId === locked}
            onClear={() => onClear(slot)}
            onPick={() => onPick(slot)}
            player={player}
            stake={player === null ? undefined : stakes?.get(player.profileId)}
          />
        ))}
      </View>
      <TextInput
        accessibilityLabel={`Điểm ${label.toLowerCase()}`}
        keyboardType="number-pad"
        maxLength={2}
        onChangeText={onScore}
        placeholder="0"
        placeholderTextColor={colour.line}
        selectTextOnFocus
        style={[font.score, style.score]}
        value={score}
      />
    </View>
  );
}

function Slot({
  player,
  locked,
  stake,
  onPick,
  onClear,
}: {
  readonly player: Pickable | null;
  readonly locked: boolean;
  readonly stake: PreviewedChange | undefined;
  readonly onPick: () => void;
  readonly onClear: () => void;
}) {
  if (player === null) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPick}
        style={({ pressed }) => [style.slot, style.empty, pressed ? style.pressed : null]}
      >
        <Ionicons color={colour.onCourt} name="add" size={20} />
        <Text style={[font.body, { color: colour.onCourt, fontWeight: '600' }]}>Thêm người</Text>
      </Pressable>
    );
  }

  return (
    <View style={style.slot}>
      {locked ? <View style={style.mine} /> : null}
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={[font.body, { fontWeight: '700' }]}>
          {player.displayName}
        </Text>
        {stake === undefined ? null : (
          <Text style={[font.dim, { fontSize: 13 }]}>
            {'thắng '}
            <Text style={{ color: colour.up, fontWeight: '700' }}>
              {describeDelta(stake.displayBefore, stake.displayIfWon)}
            </Text>
            {', thua '}
            <Text style={{ color: colour.down, fontWeight: '700' }}>
              {describeDelta(stake.displayBefore, stake.displayIfLost)}
            </Text>
          </Text>
        )}
      </View>
      {locked ? null : (
        <Pressable
          accessibilityLabel={`Bỏ ${player.displayName}`}
          accessibilityRole="button"
          hitSlop={12}
          onPress={onClear}
          style={({ pressed }) => (pressed ? style.pressed : null)}
        >
          <Ionicons color={colour.dim} name="close-circle" size={22} />
        </Pressable>
      )}
    </View>
  );
}

const style = StyleSheet.create({
  side: { flexDirection: 'row', alignItems: 'stretch', gap: space.row, padding: space.gap },
  slot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.row,
    minHeight: 54,
    paddingHorizontal: space.gap,
    paddingVertical: space.tight,
    borderRadius: radius.field,
    backgroundColor: colour.card,
  },
  empty: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colour.onCourtDim,
  },
  mine: {
    width: 10,
    height: 10,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colour.onShuttle,
    backgroundColor: colour.shuttle,
  },
  score: {
    width: 92,
    fontSize: 52,
    textAlign: 'center',
    borderRadius: radius.card,
    backgroundColor: colour.card,
  },
  pressed: { opacity: 0.6 },
});
