import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import type { Gender } from '../../src/data/auth';
import type { LadderEntry } from '../../src/data/ladder';
import { IDLE_GRACE_DAYS } from '../../src/domain/rating-scale';
import { Nothing, Pending, Problem } from '../../src/ui/components/async';
import { PlacementBadge, TierBadge } from '../../src/ui/components/badge';
import { Choice } from '../../src/ui/components/field';
import { PendingBanner } from '../../src/ui/components/pending-banner';
import { useLadder, usePendingGames, useReplayState } from '../../src/ui/queries';
import { useMember } from '../../src/ui/session';
import { colour, font, layout, space } from '../../src/ui/theme';

type Filter = 'all' | Gender;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * One club ladder, filtered to a list rather than split into separate pools: the
 * rating is computed over everyone, and gender only decides who is shown.
 */
export default function Ladder() {
  const router = useRouter();
  const me = useMember();
  const [filter, setFilter] = useState<Filter>('all');
  const [showAway, setShowAway] = useState(false);

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
  const away = shown.filter((entry) => !isAround(entry, now));

  const row = (entry: LadderEntry, rank?: number) => (
    <Row
      entry={entry}
      key={entry.profile_id}
      mine={entry.profile_id === me.id}
      onPress={() => router.push(`/player/${entry.profile_id}`)}
      rank={rank}
    />
  );

  return (
    <FlatList
      ItemSeparatorComponent={() => <View style={layout.rule} />}
      ListEmptyComponent={
        <Nothing message="Nobody is ranked yet. Log a game and the ladder starts." />
      }
      ListHeaderComponent={
        <View style={{ gap: space.gap, paddingBottom: space.row }}>
          {pending.data === undefined ? null : (
            <PendingBanner games={pending.data.map((entry) => entry.games)} />
          )}
          <Choice
            onChange={setFilter}
            options={[
              { value: 'all', label: 'Everyone' },
              { value: 'male', label: 'Men' },
              { value: 'female', label: 'Women' },
            ]}
            value={filter}
          />
          {replay.data?.last_replay_at == null ? null : (
            <Text style={font.dim}>
              {`Updated ${describeRebuild(replay.data.last_replay_at, now)}. New results show up within a few minutes of being confirmed.`}
            </Text>
          )}
        </View>
      }
      ListFooterComponent={
        <View style={{ paddingTop: space.block, gap: space.row }}>
          {placing.length === 0 ? null : (
            <View>
              <Text style={[font.heading, style.section]}>Still placing</Text>
              <Text style={[font.dim, style.section]}>
                A rank appears after their first few games.
              </Text>
              {placing.map((entry) => row(entry))}
            </View>
          )}
          {away.length === 0 ? null : (
            <View>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: showAway }}
                onPress={() => setShowAway(!showAway)}
                style={[layout.spread, style.section]}
              >
                <Text style={font.heading}>{`Away for ${IDLE_GRACE_DAYS}+ days (${away.length})`}</Text>
                <Ionicons color={colour.dim} name={showAway ? 'chevron-up' : 'chevron-down'} size={18} />
              </Pressable>
              {showAway ? away.map((entry) => row(entry)) : null}
            </View>
          )}
        </View>
      }
      contentContainerStyle={layout.page}
      data={ranked}
      keyExtractor={(entry) => entry.profile_id}
      refreshControl={
        <RefreshControl
          onRefresh={() => void ladder.refetch()}
          refreshing={ladder.isFetching}
          tintColor={colour.dim}
        />
      }
      renderItem={({ item, index }) => row(item, index + 1)}
      style={layout.screen}
    />
  );
}

function Row({
  entry,
  rank,
  mine,
  onPress,
}: {
  readonly entry: LadderEntry;
  readonly rank?: number;
  readonly mine: boolean;
  readonly onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        style.row,
        mine ? style.mine : null,
        pressed ? { opacity: 0.7 } : null,
      ]}
    >
      <Text style={[font.score, style.rank, mine ? { color: colour.accent } : null]}>
        {rank === undefined ? '' : rank}
      </Text>
      <View style={{ flex: 1, gap: 4, alignItems: 'flex-start' }}>
        <Text numberOfLines={1} style={[font.heading, mine ? { color: colour.accent } : null]}>
          {mine ? `${entry.profiles.display_name} (you)` : entry.profiles.display_name}
        </Text>
        {entry.in_placement ? (
          <PlacementBadge gamesPlayed={entry.games_played} />
        ) : (
          <TierBadge tier={entry.tier} />
        )}
      </View>
      {entry.in_placement ? null : (
        <Text style={[font.score, style.rating]}>{entry.display_rating}</Text>
      )}
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
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours}h ago` : `${Math.round(hours / 24)} days ago`;
}

const style = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.gap,
    paddingVertical: space.row,
    paddingHorizontal: space.row,
  },
  mine: { backgroundColor: colour.card, borderLeftWidth: 3, borderLeftColor: colour.accent },
  rank: { width: 40, fontSize: 32, color: colour.dim, textAlign: 'right' },
  rating: { fontSize: 30, minWidth: 64, textAlign: 'right' },
  section: { paddingHorizontal: space.row, paddingBottom: space.tight },
});
