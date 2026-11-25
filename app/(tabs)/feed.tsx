import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import type { GameRow } from '../../src/data/games';
import { Nothing, Pending, Problem } from '../../src/ui/components/async';
import { Button } from '../../src/ui/components/button';
import { DayPicker } from '../../src/ui/components/day-picker';
import { GameCard } from '../../src/ui/components/game-card';
import { ScreenTitle } from '../../src/ui/components/screen-title';
import { answerOf } from '../../src/ui/game-row';
import { useConfirmAll, useFeed, useFeedSearch, usePendingGames } from '../../src/ui/queries';
import { useMember } from '../../src/ui/session';
import { colour, font, layout, radius, space } from '../../src/ui/theme';
import { dayKey, describeDay, describeSessionDay } from '../../src/ui/vocabulary';

/**
 * Every confirmed game in the club, newest first and grouped by the day it was played,
 * with what it moved for all four — which is also what makes the record police itself.
 * A member's own unsettled games sit above it, because those are the ones they can
 * still do something about. Searching by a player's name, a day, or both (story 46a)
 * swaps the feed for the games that match, and sets the waiting list aside while it does.
 */
export default function Feed() {
  const router = useRouter();
  const me = useMember();

  const [searchOpen, setSearchOpen] = useState(false);
  const [term, setTerm] = useState('');
  const [day, setDay] = useState<string | null>(null);
  const searching = term.trim().length > 0 || day !== null;

  const feed = useFeed();
  const search = useFeedSearch(term, day);
  const pending = usePendingGames(me.id);
  const confirmAll = useConfirmAll();
  const now = Date.now();

  if (feed.isPending) return <Pending />;
  if (feed.isError) {
    return <Problem message={feed.error.message} onRetry={() => void feed.refetch()} />;
  }

  const rows: readonly GameRow[] = searching ? (search.data ?? []) : feed.data.pages.flat();
  const unsettled = searching ? [] : (pending.data ?? []);
  const owed = unsettled.filter((row) => answerOf(row, me.id)?.state === 'pending');
  const open = (row: GameRow) => router.push(`/game/${row.id}`);

  const toggleSearch = () => {
    if (searchOpen) {
      setTerm('');
      setDay(null);
    }
    setSearchOpen(!searchOpen);
  };

  return (
    <FlatList
      ListEmptyComponent={
        searching ? (
          search.isPending ? (
            <Pending />
          ) : search.isError ? (
            <Problem message={search.error.message} onRetry={() => void search.refetch()} />
          ) : (
            <Nothing message={`Không có trận nào ${describeSearch(term, day)}.`} />
          )
        ) : (
          <Nothing message="Chưa có trận nào. Các trận đã xác nhận của cả câu lạc bộ sẽ hiện ở đây." />
        )
      }
      ListHeaderComponent={
        <View style={{ gap: space.gap }}>
          <ScreenTitle
            aside={
              <Pressable
                accessibilityLabel={searchOpen ? 'Đóng tìm kiếm' : 'Tìm trận theo người chơi hoặc ngày'}
                accessibilityRole="button"
                onPress={toggleSearch}
                style={({ pressed }) => [style.round, searchOpen ? style.roundOn : null, pressed ? { opacity: 0.7 } : null]}
              >
                <Ionicons color={searchOpen ? colour.onCourt : colour.text} name={searchOpen ? 'close' : 'search'} size={20} />
              </Pressable>
            }
            title="Bảng tin"
          />
          {searchOpen ? (
            <View style={{ gap: space.row }}>
              <View style={style.search}>
                <Ionicons color={colour.dim} name="search" size={18} />
                <TextInput
                  accessibilityLabel="Tìm trận theo người chơi"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoFocus
                  onChangeText={setTerm}
                  placeholder="Tên người chơi"
                  placeholderTextColor={colour.dim}
                  style={[font.body, { flex: 1 }]}
                  value={term}
                />
                {term.length === 0 ? null : (
                  <Pressable accessibilityLabel="Xoá tên" hitSlop={12} onPress={() => setTerm('')}>
                    <Ionicons color={colour.dim} name="close-circle" size={18} />
                  </Pressable>
                )}
              </View>
              <DayPicker day={day} onChange={setDay} />
              {searching && rows.length > 0 ? (
                <Text style={font.dim}>{`${rows.length} trận ${describeSearch(term, day)}`}</Text>
              ) : null}
            </View>
          ) : null}
          {unsettled.length === 0 ? null : (
            <View style={{ gap: space.row }}>
              <Text style={font.heading}>Chờ xác nhận</Text>
              {owed.length < 2 ? null : (
                <Button
                  busy={confirmAll.isPending}
                  label={`Xác nhận cả ${owed.length} trận`}
                  onPress={() => confirmAll.mutate(owed.map((row) => row.id))}
                />
              )}
              {confirmAll.isError ? (
                <Text style={[font.dim, { color: colour.down }]}>{confirmAll.error.message}</Text>
              ) : null}
              {unsettled.map((row) => (
                <GameCard key={row.id} now={now} onPress={() => open(row)} row={row} viewerId={me.id} />
              ))}
            </View>
          )}
        </View>
      }
      contentContainerStyle={layout.page}
      data={rows}
      keyExtractor={(row) => row.id}
      keyboardShouldPersistTaps="handled"
      ListFooterComponent={!searching && feed.isFetchingNextPage ? <Pending /> : undefined}
      onEndReached={() => {
        if (!searching && feed.hasNextPage && !feed.isFetchingNextPage) void feed.fetchNextPage();
      }}
      refreshControl={
        <RefreshControl
          onRefresh={() => {
            void feed.refetch();
            void pending.refetch();
            if (searching) void search.refetch();
          }}
          refreshing={searching ? search.isFetching : feed.isFetching}
          tintColor={colour.courtInk}
        />
      }
      renderItem={({ item, index }) => {
        const previous = rows[index - 1];
        const newDay = previous === undefined || dayKey(previous.played_at) !== dayKey(item.played_at);
        return (
          <View style={{ gap: space.row, paddingBottom: space.row }}>
            {newDay ? (
              <Text accessibilityRole="header" style={[font.heading, style.day]}>
                {describeSessionDay(item.played_at, now)}
              </Text>
            ) : null}
            <GameCard now={now} onPress={() => open(item)} row={item} viewerId={me.id} />
          </View>
        );
      }}
      style={layout.screen}
    />
  );
}

/** "có người chơi tên "Hùng" vào Th 7, 22/11", or whichever half was asked for. */
function describeSearch(term: string, day: string | null): string {
  const who = term.trim().length > 0 ? `có người chơi tên "${term.trim()}"` : '';
  const when = day === null ? '' : `vào ${describeDay(day)}`;
  return [who, when].filter((part) => part.length > 0).join(' ');
}

const style = StyleSheet.create({
  round: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colour.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundOn: { backgroundColor: colour.court },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.row,
    minHeight: 48,
    paddingHorizontal: space.gap,
    borderRadius: radius.field,
    backgroundColor: colour.card,
  },
  day: { fontSize: 15, color: colour.dim, paddingTop: space.tight, paddingHorizontal: 4 },
});
