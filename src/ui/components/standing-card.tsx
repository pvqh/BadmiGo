import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Standing } from '../standing';
import { colour, font, radius, space } from '../theme';

/** The member's own place and the next name to catch; pressing it scrolls to their row. */
export function StandingCard({
  standing,
  rating,
  onPress,
}: {
  readonly standing: Standing;
  readonly rating: number;
  readonly onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityHint="Cuộn tới vị trí của bạn"
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [style.card, pressed ? { opacity: 0.85 } : null]}
    >
      <Text style={[font.score, style.rank]}>{`#${standing.rank}`}</Text>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[font.dim, { color: colour.onShuttleDim, fontWeight: '600' }]}>
          {`Hạng của bạn, ${rating} điểm`}
        </Text>
        <Text style={[font.heading, { color: colour.onShuttle }]}>{describeChase(standing.next)}</Text>
      </View>
      <Ionicons color={colour.onShuttle} name="locate" size={22} />
    </Pressable>
  );
}

function describeChase(next: Standing['next']): string {
  if (next === null) return 'Bạn đang dẫn đầu!';
  if (next.gap === 0) return `Ngang điểm với ${next.name}`;
  return `Còn ${next.gap} điểm để vượt ${next.name}`;
}

const style = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.gap,
    paddingVertical: space.gap,
    paddingHorizontal: space.page,
    borderRadius: radius.card,
    backgroundColor: colour.shuttle,
  },
  rank: { fontSize: 40, lineHeight: 44, color: colour.onShuttle },
});
