import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Gender } from '../../src/data/auth';
import type { LadderEntry } from '../../src/data/ladder';
import { IDLE_GRACE_DAYS } from '../../src/domain/rating-scale';
import { Nothing, Pending, Problem } from '../../src/ui/components/async';
import { Avatar } from '../../src/ui/components/avatar';
import { PlacementBadge, TierBadge } from '../../src/ui/components/badge';
import { Choice } from '../../src/ui/components/field';
import { PendingBanner } from '../../src/ui/components/pending-banner';
import { Podium } from '../../src/ui/components/podium';
import { StandingCard } from '../../src/ui/components/standing-card';
import { useLadder, usePendingGames, useReplayState } from '../../src/ui/queries';
import { useMember } from '../../src/ui/session';
import { standingOf } from '../../src/ui/standing';
import { colour, font, radius, space } from '../../src/ui/theme';

type Filter = 'all' | Gender;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * One club ladder, filtered to a list rather than split into separate pools: the
 * rating is computed over everyone, and gender only decides who is shown.
 */
export default function Ladder() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const me = useMember();
  const [filter, setFilter] = useState<Filter>('all');
  const list = useRef<FlatList<LadderEntry>>(null);

  const ladder = useLadder();
  const replay = useReplayState();
  const pending = usePendingGames(me.id);
  const now = Date.now();

  if (ladder.isPending) return <Pending />;
  if (ladder.isError) {
    return <Problem message={ladder.error.message} onRetry={() => void ladder.refetch()} />;
  }

  const shown = ladder.data.filter(
    (entry) => filter === 'all' || entry.profiles.gender === filter,
  );
  const ranked = shown.filter((entry) => isAround(entry, now) && !entry.in_placement);
  const placing = shown.filter((entry) => isAround(entry, now) && entry.in_placement);
  const standing = standingOf(ranked, me.id);
  // The podium is the whole club's; the men's and women's splits read as plain lists.
  const podiumSize = filter === 'all' ? Math.min(3, ranked.length) : 0;
  const rows = ranked.slice(podiumSize);
  const open = (profileId: string) => router.push(`/player/${profileId}`);

  const scrollToRank = (rank: number) =>
    rank <= podiumSize
      ? list.current?.scrollToOffset({ offset: 0 })
      : list.current?.scrollToIndex({ index: rank - podiumSize - 1, viewPosition: 0.5 });

  return (
    <FlatList
      ListEmptyComponent={
        ranked.length === 0 ? (
          <Nothing message="Chưa ai có hạng. Ghi một trận để bảng xếp hạng bắt đầu." />
        ) : undefined
      }
      ListHeaderComponent={
        <View style={{ gap: space.gap, paddingBottom: space.gap }}>
          <View style={[style.court, { paddingTop: insets.top + 12 }]}>
            <CourtLines />
            <View style={style.titleRow}>
              <Text accessibilityRole="header" style={[font.title, { color: colour.onCourt }]}>
                LeaderBoard
              </Text>
              <View style={{ width: 196 }}>
                <Choice
                  onChange={setFilter}
                  onCourt
                  options={[
                    { value: 'all', label: 'Tất cả' },
                    { value: 'male', label: 'Nam' },
                    { value: 'female', label: 'Nữ' },
                  ]}
                  value={filter}
                />
              </View>
            </View>
            {podiumSize === 0 ? null : (
              <Podium leaders={ranked.slice(0, podiumSize)} myId={me.id} onOpen={open} />
            )}
            {replay.data?.last_replay_at == null ? null : (
              <Text style={[font.dim, style.updated]}>
                {`Cập nhật ${describeRebuild(replay.data.last_replay_at, now)}`}
              </Text>
            )}
          </View>
          <View style={style.inset}>
            {pending.data === undefined ? null : <PendingBanner games={pending.data} />}
            {standing === null ? null : (
              <StandingCard
                onPress={() => scrollToRank(standing.rank)}
                rating={ranked[standing.rank - 1].display_rating}
                standing={standing}
              />
            )}
          </View>
        </View>
      }
      ListFooterComponent={
        placing.length === 0 ? undefined : (
          <View style={[style.inset, { paddingTop: space.block, gap: space.row }]}>
            <View style={{ gap: 2 }}>
              <Text style={font.heading}>Đang phân hạng</Text>
              <Text style={font.dim}>Có hạng sau 5 trận đầu tiên.</Text>
            </View>
            <View style={style.placing}>
              {placing.map((entry) => (
                <Pressable
                  accessibilityRole="button"
                  key={entry.profile_id}
                  onPress={() => open(entry.profile_id)}
                  style={({ pressed }) => [style.placingCard, pressed ? style.pressed : null]}
                >
                  <View style={[style.line, { gap: space.tight }]}>
                    <Avatar name={entry.profiles.display_name} path={entry.profiles.avatar_path} size={28} />
                    <Text numberOfLines={1} style={[font.body, { fontWeight: '600', flexShrink: 1 }]}>
                      {entry.profile_id === me.id ? 'Bạn' : entry.profiles.display_name}
                    </Text>
                  </View>
                  <PlacementBadge gamesPlayed={entry.games_played} />
                </Pressable>
              ))}
            </View>
          </View>
        )
      }
      contentContainerStyle={{ paddingBottom: space.block * 2 }}
      data={rows}
      keyExtractor={(entry) => entry.profile_id}
      // Rows are measured lazily, so a far-down row may not exist yet; land near it.
      onScrollToIndexFailed={({ index, averageItemLength }) =>
        list.current?.scrollToOffset({ offset: index * averageItemLength })
      }
      ref={list}
      refreshControl={
        <RefreshControl
          onRefresh={() => void ladder.refetch()}
          refreshing={ladder.isFetching}
          tintColor={colour.courtInk}
        />
      }
      renderItem={({ item, index }) => (
        <Row
          entry={item}
          first={index === 0}
          last={index === rows.length - 1}
          mine={item.profile_id === me.id}
          onPress={() => open(item.profile_id)}
          rank={index + podiumSize + 1}
        />
      )}
      style={{ flex: 1, backgroundColor: colour.background }}
    />
  );
}

/** The court seen from above, faint behind the podium: the hall the ladder is about. */
function CourtLines() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[style.chalk, { left: 22, right: 22, top: 96, bottom: -40, borderWidth: 2 }]} />
      <View style={[style.chalk, { left: 40, right: 40, top: 96, bottom: -40, borderLeftWidth: 2, borderRightWidth: 2 }]} />
      <View style={[style.chalk, { left: 22, right: 22, top: 150, height: 0, borderTopWidth: 2 }]} />
      <View style={[style.chalk, { left: '50%', top: 150, bottom: -40, width: 0, borderLeftWidth: 2 }]} />
    </View>
  );
}

function Row({
  entry,
  rank,
  mine,
  first,
  last,
  onPress,
}: {
  readonly entry: LadderEntry;
  readonly rank: number;
  readonly mine: boolean;
  readonly first: boolean;
  readonly last: boolean;
  readonly onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={`Hạng ${rank}, ${entry.profiles.display_name}, ${entry.display_rating} điểm`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        style.row,
        first ? style.firstRow : style.ruled,
        last ? style.lastRow : null,
        mine ? { backgroundColor: colour.shuttleSoft } : null,
        pressed ? style.pressed : null,
      ]}
    >
      <Text style={[font.figure, style.rank]}>{rank}</Text>
      <Avatar name={entry.profiles.display_name} path={entry.profiles.avatar_path} size={36} />
      <View style={[style.line, { flex: 1 }]}>
        <Text numberOfLines={1} style={[font.body, { fontWeight: '600', flexShrink: 1 }]}>
          {mine ? 'Bạn' : entry.profiles.display_name}
        </Text>
        <TierBadge tier={entry.tier} />
      </View>
      <Text style={[font.figure, { fontSize: 24 }]}>{entry.display_rating}</Text>
    </Pressable>
  );
}

/** Measured against the clock rather than the flag the last replay froze. */
function isAround(entry: LadderEntry, now: number): boolean {
  if (entry.last_played_at === null) return false;
  return now - new Date(entry.last_played_at).getTime() <= IDLE_GRACE_DAYS * DAY_MS;
}

function describeRebuild(at: string, now: number): string {
  const minutes = Math.round((now - new Date(at).getTime()) / 60_000);
  if (minutes < 1) return 'vừa xong';
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours} giờ trước` : `${Math.round(hours / 24)} ngày trước`;
}

const style = StyleSheet.create({
  court: {
    backgroundColor: colour.court,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    paddingHorizontal: space.page,
    paddingBottom: space.gap,
    gap: space.block,
    overflow: 'hidden',
  },
  chalk: { position: 'absolute', borderColor: 'rgba(255, 255, 255, 0.16)' },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.row },
  updated: { color: colour.onCourtDim, fontSize: 12, textAlign: 'center' },
  inset: { paddingHorizontal: space.page, gap: space.gap },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.row },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.row,
    minHeight: 60,
    marginHorizontal: space.page,
    paddingHorizontal: space.gap,
    backgroundColor: colour.card,
  },
  ruled: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colour.line },
  firstRow: { borderTopLeftRadius: radius.card, borderTopRightRadius: radius.card },
  lastRow: { borderBottomLeftRadius: radius.card, borderBottomRightRadius: radius.card },
  rank: { width: 28, fontSize: 20, color: colour.dim, textAlign: 'right' },
  placing: { flexDirection: 'row', flexWrap: 'wrap', gap: space.row },
  placingCard: {
    flexBasis: '47%',
    flexGrow: 1,
    gap: space.tight,
    padding: space.gap,
    borderRadius: radius.card,
    backgroundColor: colour.card,
  },
  pressed: { opacity: 0.7 },
});
