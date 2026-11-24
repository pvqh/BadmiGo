import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, Text, View } from 'react-native';
import type { ProfileId } from '../domain/types';
import { Nothing, Pending, Problem } from './components/async';
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
import { colour, font, layout, space } from './theme';
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
}: {
  readonly profileId: ProfileId;
  readonly fallbackName: string;
}) {
  const router = useRouter();
  const me = useMember();

  const rating = usePlayerRating(profileId);
  const history = useRatingHistory(profileId);
  const played = usePlayerGames(profileId);
  const strengths = useStrengths();

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
  const games = [...(played.data ?? [])].sort(
    (left, right) =>
      new Date(right.games.played_at).getTime() - new Date(left.games.played_at).getTime(),
  );

  const points = (history.data ?? []).flatMap((change, index) =>
    index === 0 ? [change.display_before, change.display_after] : [change.display_after],
  );

  const perGame = stats.expectation?.perGame ?? null;

  return (
    <ScrollView contentContainerStyle={layout.page} style={layout.screen}>
      <View style={{ gap: space.tight }}>
        <Text style={font.title}>{name}</Text>
        {rating.data === null || rating.data === undefined ? (
          <Text style={font.dim}>No rating yet. It appears after their first confirmed game.</Text>
        ) : rating.data.in_placement ? (
          <View style={{ alignItems: 'flex-start' }}>
            <PlacementBadge gamesPlayed={rating.data.games_played} />
          </View>
        ) : (
          <View style={layout.row}>
            <Text style={[font.score, { fontSize: 64, color: colour.accent }]}>
              {rating.data.display_rating}
            </Text>
            <TierBadge tier={rating.data.tier} />
          </View>
        )}
        {rating.data === null || rating.data === undefined ? null : (
          <Text style={font.dim}>
            {`${stats.thisMonth} ${stats.thisMonth === 1 ? 'game' : 'games'} this month, ${rating.data.games_played} in total`}
          </Text>
        )}
      </View>

      <View style={[layout.card, layout.spread]}>
        <Figure label="Won–lost" value={`${stats.record.won}–${stats.record.lost}`} />
        <Figure label="Win rate" value={percent(stats.record)} />
        <Figure
          colour={expectationColour(perGame)}
          label="PvE"
          value={perGame === null ? '—' : `${perGame > 0 ? '+' : ''}${(perGame * 100).toFixed(0)}%`}
        />
      </View>
      <Text style={font.dim}>
        "Performance vs Expectation (PvE)" là chỉ số hiệu suất so với kỳ vọng, cho thấy bạn thắng nhiều hay ít hơn so với dự đoán. Một đối thủ mạnh có thể nâng cao chỉ số này, nhưng một đồng đội mạnh không thể làm được điều đó. 
      </Text>

      <View style={layout.card}>
        <Text style={font.heading}>Rating over time</Text>
        <RatingGraph points={points} />
      </View>

      {stats.partners.length === 0 ? null : (
        <View style={layout.card}>
          <Text style={font.heading}>Best partners</Text>
          {best(stats.partners).map((partner) => (
            <PartnerRow key={partner.partnerId} name={stats.names.get(partner.partnerId)} partner={partner} />
          ))}
          {worst(stats.partners).length === 0 ? null : (
            <>
              <Text style={[font.heading, { paddingTop: space.row }]}>Worst with</Text>
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
              <Text style={font.body}>{stats.names.get(rival.opponentId) ?? 'someone'}</Text>
              <Text style={font.figure}>{`${rival.won}–${rival.lost}`}</Text>
            </View>
          ))}
        </View>
      )}

      <Text style={font.heading}>Các trận gần đây</Text>
      {games.length === 0 ? (
        <Nothing message="No games yet." />
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

function Figure({
  label,
  value,
  colour: tone = colour.text,
}: {
  readonly label: string;
  readonly value: string;
  readonly colour?: string;
}) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
      <Text style={[font.score, { fontSize: 30, color: tone }]}>{value}</Text>
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
      <Text style={font.body}>{name ?? 'someone'}</Text>
      <Text style={font.dim}>
        {`won ${partner.won} of ${partner.played} (${percent(partner)})`}
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
