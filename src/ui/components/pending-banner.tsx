import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { GameRow } from '../../data/games';
import { answerOf } from '../game-row';
import { useMember } from '../session';
import { colour, font, radius, space } from '../theme';

/**
 * Story 28: a member who missed the push still sees, on opening the app, that
 * someone is waiting on them. Counts only games still owed an answer, not every
 * pending game — a logger waiting on others is not being asked for anything.
 */
export function PendingBanner({ games }: { readonly games: readonly GameRow[] }) {
  const router = useRouter();
  const me = useMember();

  const owed = games.filter((row) => answerOf(row, me.id)?.state === 'pending');
  if (owed.length === 0) return null;

  const first = owed[0];

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() =>
        owed.length === 1 ? router.push(`/game/${first.id}`) : router.push('/feed')
      }
      style={({ pressed }) => [style.banner, pressed ? { opacity: 0.85 } : null]}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[font.heading, { color: colour.onCourt }]}>
          {owed.length === 1 ? 'Có 1 trận chờ bạn xác nhận' : `Có ${owed.length} trận chờ bạn xác nhận`}
        </Text>
        <Text style={[font.dim, { color: colour.onCourtDim }]}>
          Kiểm tra tỉ số để bảng xếp hạng được cập nhật.
        </Text>
      </View>
      <Ionicons color={colour.onCourt} name="chevron-forward" size={22} />
    </Pressable>
  );
}

const style = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.row,
    backgroundColor: colour.court,
    borderRadius: radius.card,
    padding: space.gap,
  },
});
