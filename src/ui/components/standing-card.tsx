import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Standing } from '../standing';
import { colour, font, layout, radius, space } from '../theme';

/** The member's own place and the next name to catch; pressing it scrolls to their row. */
export function StandingCard({
  standing,
  onPress,
}: {
  readonly standing: Standing;
  readonly onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityHint="Cuộn tới vị trí của bạn"
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [style.card, pressed ? { opacity: 0.8 } : null]}
    >
      <Text style={[font.score, style.rank]}>{`#${standing.rank}`}</Text>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={font.dim}>Hạng của bạn</Text>
        <Text style={font.heading}>{describeChase(standing.next)}</Text>
      </View>
      <Ionicons color={colour.accent} name="locate" size={22} />
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
    ...layout.row,
    gap: space.gap,
    padding: space.gap,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colour.accent,
    backgroundColor: colour.card,
  },
  rank: { fontSize: 36, color: colour.accent },
});
