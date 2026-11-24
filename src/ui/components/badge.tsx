import { StyleSheet, Text, View } from 'react-native';
import type { GameStatus } from '../../domain/game-lifecycle';
import { PLACEMENT_GAMES } from '../../domain/rating-scale';
import type { Tier } from '../../domain/types';
import { colour, font, radius, space } from '../theme';
import { TIER_LABEL } from '../vocabulary';

export function TierBadge({ tier }: { readonly tier: Tier }) {
  return (
    <View style={style.badge}>
      <Text style={style.label}>{TIER_LABEL[tier]}</Text>
    </View>
  );
}

/** A player in placement is shown their progress, never a rank. */
export function PlacementBadge({ gamesPlayed }: { readonly gamesPlayed: number }) {
  const remaining = Math.max(0, PLACEMENT_GAMES - gamesPlayed);

  return (
    <View style={[style.badge, style.placement]}>
      <Text style={[style.label, { color: colour.pending }]}>
        {`Provisional ${gamesPlayed}/${PLACEMENT_GAMES}`}
      </Text>
      {remaining > 0 ? (
        <Text style={font.dim}>{`${remaining} ${remaining === 1 ? 'game' : 'games'} to go`}</Text>
      ) : null}
    </View>
  );
}

const STATUS_LABEL: Record<GameStatus, string> = {
  pending: 'Waiting',
  confirmed: 'Confirmed',
  disputed: 'Disputed',
  voided: 'Removed',
};

export function StatusChip({ status }: { readonly status: GameStatus }) {
  const tone =
    status === 'disputed' ? colour.down : status === 'pending' ? colour.pending : colour.dim;

  return (
    <View style={[style.badge, { borderColor: tone }]}>
      <Text style={[style.label, { color: tone }]}>{STATUS_LABEL[status]}</Text>
    </View>
  );
}

const style = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.tight,
    paddingHorizontal: space.row,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colour.line,
    backgroundColor: colour.raised,
  },
  placement: { borderColor: colour.pending },
  label: { color: colour.text, fontSize: 12, fontWeight: '600' },
});
