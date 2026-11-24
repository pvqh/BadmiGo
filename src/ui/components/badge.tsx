import { StyleSheet, Text, View } from 'react-native';
import type { GameStatus } from '../../domain/game-lifecycle';
import { PLACEMENT_GAMES } from '../../domain/rating-scale';
import type { Tier } from '../../domain/types';
import { colour, font, radius, space, tierColour } from '../theme';
import { TIER_LABEL } from '../vocabulary';

export function TierBadge({ tier, large = false }: { readonly tier: Tier; readonly large?: boolean }) {
  const { fill, ink } = tierColour[tier];
  return (
    <View style={[style.badge, large ? style.large : null, { backgroundColor: fill }]}>
      <Text style={[style.label, large ? { fontSize: 14 } : null, { color: ink }]}>{TIER_LABEL[tier]}</Text>
    </View>
  );
}

/**
 * A player in placement is shown their progress, never a rank: one dot per placement
 * game, filled as they are played.
 */
export function PlacementBadge({ gamesPlayed }: { readonly gamesPlayed: number }) {
  const played = Math.min(gamesPlayed, PLACEMENT_GAMES);
  const remaining = PLACEMENT_GAMES - played;

  return (
    <View
      accessibilityLabel={`Đang xếp hạng, đã chơi ${played} trên ${PLACEMENT_GAMES} trận`}
      style={style.dots}
    >
      {Array.from({ length: PLACEMENT_GAMES }, (_, index) => (
        <View key={index} style={[style.dot, index < played ? style.filled : null]} />
      ))}
      <Text style={[font.dim, { marginLeft: space.tight }]}>
        {remaining === 0 ? 'xong lượt xếp hạng' : `còn ${remaining} trận`}
      </Text>
    </View>
  );
}

const STATUS_LABEL: Record<GameStatus, string> = {
  pending: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  disputed: 'Bị phản đối',
  voided: 'Đã gỡ',
};

export function StatusChip({ status }: { readonly status: GameStatus }) {
  const tone =
    status === 'disputed' ? colour.down : status === 'pending' ? colour.pending : colour.dim;

  return (
    <View style={[style.badge, style.status, { borderColor: tone }]}>
      <Text style={[style.label, { color: tone }]}>{STATUS_LABEL[status]}</Text>
    </View>
  );
}

const style = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  large: { paddingHorizontal: 10, paddingVertical: 3 },
  status: { borderWidth: 1.5, backgroundColor: colour.card },
  label: { ...font.dim, fontSize: 12, fontWeight: '700' },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot: { width: 10, height: 10, borderRadius: radius.pill, backgroundColor: colour.line },
  filled: { backgroundColor: colour.court },
});
