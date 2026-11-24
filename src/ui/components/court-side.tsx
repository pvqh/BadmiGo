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
        <Text style={font.dim}>{label}</Text>
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
        accessibilityLabel={`${label} score`}
        keyboardType="number-pad"
        maxLength={2}
        onChangeText={onScore}
        placeholder="–"
        placeholderTextColor={colour.dim}
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
        <Ionicons color={colour.accent} name="add" size={18} />
        <Text style={[font.body, { color: colour.accent }]}>Add player</Text>
      </Pressable>
    );
  }

  return (
    <View style={[style.slot, locked ? style.mine : null]}>
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={font.body}>
          {player.displayName}
        </Text>
        {stake === undefined ? null : (
          <Text style={font.dim}>
            <Text style={{ color: colour.up }}>
              {describeDelta(stake.displayBefore, stake.displayIfWon)}
            </Text>
            {' if won, '}
            <Text style={{ color: colour.down }}>
              {describeDelta(stake.displayBefore, stake.displayIfLost)}
            </Text>
            {' if lost'}
          </Text>
        )}
      </View>
      {locked ? null : (
        <Pressable
          accessibilityLabel={`Remove ${player.displayName}`}
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
  side: { flexDirection: 'row', alignItems: 'center', gap: space.gap, padding: space.gap },
  slot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.tight,
    minHeight: 52,
    paddingHorizontal: space.gap,
    paddingVertical: space.tight,
    borderRadius: radius.field,
    backgroundColor: colour.raised,
  },
  empty: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colour.accent,
  },
  mine: { borderLeftWidth: 3, borderLeftColor: colour.accent },
  score: {
    width: 84,
    minHeight: 72,
    textAlign: 'center',
    borderRadius: radius.field,
    backgroundColor: colour.deep,
  },
  pressed: { opacity: 0.6 },
});
