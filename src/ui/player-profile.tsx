import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { nextTier } from '../domain/rating-scale';
import type { ProfileId } from '../domain/types';
import { Nothing, Pending, Problem } from './components/async';
import { Avatar } from './components/avatar';
import { PlacementBadge, TierBadge } from './components/badge';
import { GameCard } from './components/game-card';
import { RatingGraph } from './components/rating-graph';
import { statsFor, startOfMonth } from './player-stats';
import {
  usePlayerGames,
  usePlayerRating,
  useRatingHistory,
  useStrengths,
} from './queries';
import { useMember } from './session';
import { colour, font, layout, radius, space } from './theme';
import { TIER_LABEL } from './vocabulary';
import type { PartnerTally, Tally } from '../domain/stats';

const RECENT_GAMES = 8;
const RIVALS_SHOWN = 10;
const PARTNERS_SHOWN = 3;

/**
 * One player's record, used for the viewer and for anyone they tap on. Partner and
 * head-to-head breakdowns are public for everyone by an explicit decision in the
 * spec's Further Notes — do not quietly make them private.
 */
export function PlayerProfile({
  profileId,
  fallbackName,
  underStatusBar = false,
}: {
  readonly profileId: ProfileId;
  readonly fallbackName: string;
  /** On a tab there is no navigation bar above, so the page clears the status bar itself. */
  readonly underStatusBar?: boolean;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const me = useMember();

  const rating = usePlayerRating(profileId);
  const history = useRatingHistory(profileId);
  const played = usePlayerGames(profileId);
  const strengths = useStrengths();
  const [explainPve, setExplainPve] = useState(false);

  const now = Date.now();
  // The month boundary, not the clock: this holds between renders, so the memo does.
  const monthStart = startOfMonth(now);
  const stats = useMemo(
    () =>
      statsFor({
        rows: played.data ?? [],
        profileId,
        strengths: strengths.data ?? [],
        monthStart,
      }),
    [played.data, profileId, strengths.data, monthStart],
  );

  if (played.isPending || rating.isPending) return <Pending />;
  if (played.isError) {
    return <Problem message={played.error.message} onRetry={() => void played.refetch()} />;
  }

  const name = rating.data?.profiles.display_name ?? fallbackName;
  const avatarPath = rating.data?.profiles.avatar_path ?? null;
  const next =
    rating.data === null || rating.data === undefined || rating.data.in_placement
      ? null
      : nextTier(rating.data.display_rating);
  const games = [...(played.data ?? [])].sort(
    (left, right) =>
      new Date(right.games.played_at).getTime() - new Date(left.games.played_at).getTime(),
  );

  const points = (history.data ?? []).flatMap((change, index) =>
    index === 0 ? [change.display_before, change.display_after] : [change.display_after],
  );

  const perGame = stats.expectation?.perGame ?? null;

  return (
    <ScrollView
      contentContainerStyle={[layout.page, underStatusBar ? { paddingTop: insets.top + 20 } : null]}
      style={layout.screen}
    >
      <View style={{ gap: space.tight }}>
        <View style={[layout.row, { gap: space.gap }]}>
          <Avatar name={name} path={avatarPath} size={64} />
          <Text accessibilityRole="header" numberOfLines={2} style={[font.heading, { fontSize: 24, flex: 1 }]}>
            {name}
          </Text>
        </View>
        {rating.data === null || rating.data === undefined ? (
          <Text style={font.dim}>Chưa có điểm. Điểm hiện sau trận đầu tiên được xác nhận.</Text>
        ) : rating.data.in_placement ? (
          <View style={{ gap: 4, paddingTop: space.tight }}>
            <Text style={font.heading}>Đang xếp hạng</Text>
            <PlacementBadge gamesPlayed={rating.data.games_played} />
          </View>
        ) : (
          <View style={[layout.row, { alignItems: 'baseline' }]}>
            <Text style={[font.score, { fontSize: 76, lineHeight: 80 }]}>
              {rating.data.display_rating}
            </Text>
            <TierBadge large tier={rating.data.tier} />
          </View>
        )}
        {rating.data === null || rating.data === undefined ? null : (
          <Text style={font.dim}>
            {`${stats.thisMonth} trận tháng này, tổng cộng ${rating.data.games_played} trận`}
          </Text>
        )}
      </View>

      {next === null || rating.data === null || rating.data === undefined ? null : (
        <View style={layout.card}>
          <View style={layout.spread}>
            <Text style={[font.body, { fontWeight: '700' }]}>
              {`Còn ${next.floor - rating.data.display_rating} điểm lên ${TIER_LABEL[next.tier]}`}
            </Text>
            <Text style={font.dim}>{next.floor}</Text>
          </View>
          <View style={style.track}>
            <View
              style={[
                style.progress,
                { width: `${Math.round(((rating.data.display_rating - next.from) / (next.floor - next.from)) * 100)}%` },
              ]}
            />
          </View>
        </View>
      )}

      <View style={style.figures}>
        <Figure label="Thắng–thua" value={`${stats.record.won}–${stats.record.lost}`} />
        <Figure label="Tỉ lệ thắng" value={percent(stats.record)} />
        {/* The figure is opaque on its own, so the explanation is one tap away rather than always on. */}
        <Pressable
          accessibilityHint="Hiện giải thích PvE"
          accessibilityRole="button"
          accessibilityState={{ expanded: explainPve }}
          onPress={() => setExplainPve((open) => !open)}
          style={({ pressed }) => [style.figure, pressed ? { opacity: 0.7 } : null]}
        >
          <Text style={[font.score, style.figureValue, { color: expectationColour(perGame) }]}>
            {perGame === null ? '—' : `${perGame > 0 ? '+' : ''}${(perGame * 100).toFixed(0)}%`}
          </Text>
          <View style={[layout.row, { gap: 4 }]}>
            <Text style={font.dim}>PvE</Text>
            <Ionicons
              color={colour.dim}
              name={explainPve ? 'information-circle' : 'information-circle-outline'}
              size={16}
            />
          </View>
        </Pressable>
      </View>
      {explainPve ? (
        <Text style={font.dim}>
        "Performance vs Expectation (PvE)" là chỉ số hiệu suất so với kỳ vọng, cho thấy bạn thắng nhiều hay ít hơn so với dự đoán. Một đối thủ mạnh có thể nâng cao chỉ số này, nhưng một đồng đội mạnh không thể làm được điều đó. 
        </Text>
      ) : null}

      <View style={layout.card}>
        <Text style={font.heading}>Điểm qua các trận</Text>
        <RatingGraph points={points} />
      </View>

      {stats.partners.length === 0 ? null : (
        <View style={layout.card}>
          <Text style={font.heading}>Đánh cặp hợp nhất</Text>
          {best(stats.partners).map((partner) => (
            <PartnerRow key={partner.partnerId} name={stats.names.get(partner.partnerId)} partner={partner} />
          ))}
          {worst(stats.partners).length === 0 ? null : (
            <>
              <Text style={[font.heading, { paddingTop: space.row }]}>Đánh cặp kém nhất</Text>
              {worst(stats.partners).map((partner) => (
                <PartnerRow key={partner.partnerId} name={stats.names.get(partner.partnerId)} partner={partner} />
              ))}
            </>
          )}
        </View>
      )}

      {stats.rivals.length === 0 ? null : (
        <View style={layout.card}>
          <Text style={font.heading}>Hiệu số đối đầu</Text>
          {stats.rivals.slice(0, RIVALS_SHOWN).map((rival) => (
            <View key={rival.opponentId} style={layout.spread}>
              <Text style={font.body}>{stats.names.get(rival.opponentId) ?? 'Ai đó'}</Text>
              <Text style={font.figure}>{`${rival.won}–${rival.lost}`}</Text>
            </View>
          ))}
        </View>
      )}

      <Text style={font.heading}>Các trận gần đây</Text>
      {games.length === 0 ? (
        <Nothing message="Chưa có trận nào." />
      ) : (
        <View style={{ gap: space.row }}>
          {games.slice(0, RECENT_GAMES).map(({ games: row }) => (
            <GameCard
              key={row.id}
              now={now}
              onPress={() => router.push(`/game/${row.id}`)}
              row={row}
              viewerId={me.id}
            />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function Figure({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <View style={style.figure}>
      <Text style={[font.score, style.figureValue]}>{value}</Text>
      <Text style={font.dim}>{label}</Text>
    </View>
  );
}

function PartnerRow({
  partner,
  name,
}: {
  readonly partner: PartnerTally;
  readonly name: string | undefined;
}) {
  return (
    <View style={layout.spread}>
      <Text style={font.body}>{name ?? 'Ai đó'}</Text>
      <Text style={font.dim}>
        {`thắng ${partner.won}/${partner.played} (${percent(partner)})`}
      </Text>
    </View>
  );
}

/**
 * Story 49 asks who they win most and least with. Partners arrive best first; with
 * few enough partners there is no "worst" list, only one honest ranking.
 */
function best(partners: readonly PartnerTally[]): readonly PartnerTally[] {
  return partners.length <= PARTNERS_SHOWN * 2 ? partners : partners.slice(0, PARTNERS_SHOWN);
}

function worst(partners: readonly PartnerTally[]): readonly PartnerTally[] {
  return partners.length <= PARTNERS_SHOWN * 2 ? [] : partners.slice(-PARTNERS_SHOWN).reverse();
}

function percent(tally: Tally): string {
  if (tally.played === 0) return '—';
  return `${Math.round((tally.won / tally.played) * 100)}%`;
}

function expectationColour(perGame: number | null): string {
  if (perGame === null) return colour.dim;
  if (perGame > 0.05) return colour.up;
  return perGame < -0.05 ? colour.down : colour.text;
}

const style = StyleSheet.create({
  figures: { flexDirection: 'row', gap: space.tight + 2 },
  figure: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: space.row + 2,
    borderRadius: radius.card - 2,
    backgroundColor: colour.card,
  },
  figureValue: { fontSize: 30, lineHeight: 34 },
  track: { height: 10, borderRadius: radius.pill, backgroundColor: colour.raised, overflow: 'hidden' },
  progress: { height: '100%', borderRadius: radius.pill, backgroundColor: colour.court },
});
