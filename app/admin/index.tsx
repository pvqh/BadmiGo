import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { flagFor, type Flag } from '../../src/domain/flags';
import { Pending, Problem } from '../../src/ui/components/async';
import { GameCard } from '../../src/ui/components/game-card';
import { toReviewedGame } from '../../src/ui/game-row';
import { useMembers, useReviewGames } from '../../src/ui/queries';
import { useMember } from '../../src/ui/session';
import { colour, font, layout, space } from '../../src/ui/theme';
import { TIER_LABEL } from '../../src/ui/vocabulary';

const FLAG_LABEL: Record<Flag, string> = {
  disputed: 'Disputed. Fix the score, resolve it as logged, or remove it.',
  'nobody-answered': 'Accepted by the 24-hour clock. Only the logger ever vouched for it.',
};

/**
 * Story 70: what needs an admin's eye, then everyone in the club. Fixing a game
 * happens on the game itself; fixing an account on the member's own page.
 */
export default function ClubAdmin() {
  const router = useRouter();
  const me = useMember();
  const review = useReviewGames();
  const members = useMembers();
  const now = Date.now();

  if (review.isPending || members.isPending) return <Pending />;
  if (review.isError) {
    return <Problem message={review.error.message} onRetry={() => void review.refetch()} />;
  }
  if (members.isError) {
    return <Problem message={members.error.message} onRetry={() => void members.refetch()} />;
  }

  const flagged = review.data.flatMap((row) => {
    const flag = flagFor(toReviewedGame(row));
    return flag === null ? [] : [{ row, flag }];
  });

  return (
    <ScrollView contentContainerStyle={layout.page} style={layout.screen}>
      <Text style={font.heading}>Needs a look</Text>
      {flagged.length === 0 ? (
        <Text style={font.dim}>Nothing flagged in the last month.</Text>
      ) : (
        flagged.map(({ row, flag }) => (
          <View key={row.id} style={{ gap: space.tight }}>
            <Text style={[font.dim, { color: colour.pending }]}>{FLAG_LABEL[flag]}</Text>
            <GameCard
              now={now}
              onPress={() => router.push(`/game/${row.id}`)}
              row={row}
              viewerId={me.id}
            />
          </View>
        ))
      )}

      <Text style={[font.heading, { paddingTop: space.block }]}>Members</Text>
      <View style={layout.card}>
        {members.data.map((member, index) => (
          <View key={member.id} style={{ gap: space.row }}>
            {index === 0 ? null : <View style={layout.rule} />}
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push(`/admin/${member.id}`)}
              style={({ pressed }) => [layout.spread, pressed ? { opacity: 0.6 } : null]}
            >
              <View style={{ flex: 1 }}>
                <Text style={font.body}>
                  {member.display_name}
                  {member.is_admin ? '  · admin' : ''}
                </Text>
                <Text style={font.dim}>@{member.username}</Text>
              </View>
              <Text style={font.dim}>{TIER_LABEL[member.seed_tier]}</Text>
            </Pressable>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
