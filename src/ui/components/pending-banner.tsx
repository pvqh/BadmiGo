import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { GameRow } from '../../data/games';
import { answerOf } from '../game-row';
import { useMember } from '../session';
import { colour, font, layout, radius, space } from '../theme';

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
      style={({ pressed }) => [style.banner, pressed ? { opacity: 0.8 } : null]}
    >
      <View style={layout.spread}>
        <Text style={[font.heading, { color: colour.onAccent }]}>
          {owed.length === 1 ? 'Confirm your game' : `Confirm ${owed.length} games`}
        </Text>
        <Text style={[font.body, { color: colour.onAccent }]}>›</Text>
      </View>
      <Text style={[font.dim, { color: colour.onAccent }]}>
        Check the score so the ladder can move.
      </Text>
    </Pressable>
  );
}

const style = StyleSheet.create({
  banner: {
    backgroundColor: colour.accent,
    borderRadius: radius.card,
    padding: space.gap,
    gap: space.tight,
  },
});
