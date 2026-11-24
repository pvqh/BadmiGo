import { useRouter } from 'expo-router';
import { FlatList, RefreshControl, Text, View } from 'react-native';
import { Nothing, Pending, Problem } from '../../src/ui/components/async';
import { GameCard } from '../../src/ui/components/game-card';
import { useFeed, usePendingGames } from '../../src/ui/queries';
import { useMember } from '../../src/ui/session';
import { colour, font, layout, space } from '../../src/ui/theme';

/**
 * Every confirmed game in the club, newest first, with what it moved for all four —
 * which is also what makes the record police itself. A member's own unsettled games
 * sit above it, because those are the ones they can still do something about.
 */
export default function Feed() {
  const router = useRouter();
  const me = useMember();

  const feed = useFeed();
  const pending = usePendingGames(me.id);
  const now = Date.now();

  if (feed.isPending) return <Pending />;
  if (feed.isError) {
    return <Problem message={feed.error.message} onRetry={() => void feed.refetch()} />;
  }

  const unsettled = pending.data ?? [];

  return (
    <FlatList
      ListEmptyComponent={
        <Nothing message="No games yet. Confirmed games from the whole club show up here." />
      }
      ListHeaderComponent={
        unsettled.length === 0 ? undefined : (
          <View style={{ gap: space.row, paddingBottom: space.gap }}>
            <Text style={font.heading}>Waiting for confirmation</Text>
            {unsettled.map(({ games: row }) => (
              <GameCard
                key={row.id}
                now={now}
                onPress={() => router.push(`/game/${row.id}`)}
                row={row}
                viewerId={me.id}
              />
            ))}
          </View>
        )
      }
      contentContainerStyle={layout.page}
      data={feed.data}
      keyExtractor={(row) => row.id}
      refreshControl={
        <RefreshControl
          onRefresh={() => {
            void feed.refetch();
            void pending.refetch();
          }}
          refreshing={feed.isFetching}
          tintColor={colour.dim}
        />
      }
      renderItem={({ item }) => (
        <View style={{ paddingBottom: space.row }}>
          <GameCard
            now={now}
            onPress={() => router.push(`/game/${item.id}`)}
            row={item}
            viewerId={me.id}
          />
        </View>
      )}
      style={layout.screen}
    />
  );
}
