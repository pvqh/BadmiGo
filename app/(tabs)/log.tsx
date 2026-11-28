import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { GameFormat, Side } from '../../src/domain/types';
import { validateProposedGame, type ValidationProblem } from '../../src/domain/validation';
import { Button } from '../../src/ui/components/button';
import { CourtSide } from '../../src/ui/components/court-side';
import { ScreenTitle } from '../../src/ui/components/screen-title';
import { Choice } from '../../src/ui/components/field';
import { PlayerPicker, type Pickable } from '../../src/ui/components/player-picker';
import { useLogGame, useStrengths } from '../../src/ui/queries';
import { useMember } from '../../src/ui/session';
import { stakesFor } from '../../src/ui/stakes';
import { colour, font, layout, radius, space } from '../../src/ui/theme';

interface Slot {
  readonly side: Side;
  readonly index: number;
}

const FORMATS: readonly { readonly value: GameFormat; readonly label: string }[] = [
  { value: 11, label: '11' },
  { value: 15, label: '15' },
  { value: 21, label: '21' },
  { value: 31, label: '31' },
];

/**
 * Logging a game, which has to take seconds between games. The lineup survives a
 * submission so an afternoon with the same four is just a score each time, and the
 * logger holds the first slot because the server only accepts a game they played in.
 */
export default function LogGame() {
  const me = useMember();
  const router = useRouter();

  const [partner, setPartner] = useState<Pickable | null>(null);
  const [opponents, setOpponents] = useState<readonly (Pickable | null)[]>([null, null]);
  const [format, setFormat] = useState<GameFormat>(21);
  const [scoreA, setScoreA] = useState('');
  const [scoreB, setScoreB] = useState('');
  const [picking, setPicking] = useState<Slot | null>(null);

  const strengths = useStrengths();
  const logging = useLogGame(me.id);

  const myself: Pickable = { profileId: me.id, displayName: 'Bạn' };
  const slots: readonly (Pickable | null)[] = [myself, partner, ...opponents];
  const lineup = everyone(slots);
  const scored = scoreA.length > 0 && scoreB.length > 0;
  const stakes = stakesFor(
    lineup === null ? [] : lineup.map((player) => player.profileId),
    strengths.data,
    Date.now(),
  );

  const proposed =
    lineup === null
      ? null
      : {
          format,
          sideA: [lineup[0].profileId, lineup[1].profileId] as const,
          sideB: [lineup[2].profileId, lineup[3].profileId] as const,
          scoreA: Number.parseInt(scoreA, 10),
          scoreB: Number.parseInt(scoreB, 10),
        };

  // An empty score box is not yet a wrong one, so it is not complained about.
  const problems = (proposed === null ? [] : validateProposedGame(proposed)).filter(
    (problem) => scored || problem.kind !== 'invalid-score',
  );
  const ready = proposed !== null && scored && problems.length === 0;
  const missing = slots.filter((player) => player === null).length;

  const setSlot = (slot: Slot, player: Pickable | null) => {
    if (slot.side === 'a') {
      setPartner(player);
      return;
    }
    setOpponents((current) =>
      current.map((existing, index) => (index === slot.index ? player : existing)),
    );
  };

  const submit = () => {
    if (proposed === null || !ready) return;
    logging.mutate(
      proposed,
      {
        // The lineup carries over to the next game; only the score is cleared.
        onSuccess: () => {
          setScoreA('');
          setScoreB('');
        },
      },
    );
  };

  return (
    <KeyboardAvoidingView behavior="padding" style={layout.screen}>
      <ScrollView contentContainerStyle={layout.page} keyboardShouldPersistTaps="handled">
        <ScreenTitle title="Ghi trận" />

        <View style={layout.row}>
          <Text style={[font.body, { fontWeight: '600' }]}>Đánh tới</Text>
          <View style={{ flex: 1 }}>
            <Choice onChange={setFormat} options={FORMATS} value={format} />
          </View>
        </View>

        <View style={style.court}>
          <CourtSide
            label="Đội bạn"
            locked={me.id}
            onClear={(index) => setSlot({ side: 'a', index }, null)}
            onPick={(index) => setPicking({ side: 'a', index })}
            onScore={setScoreA}
            players={[myself, partner]}
            score={scoreA}
            stakes={stakes}
          />
          <View accessibilityElementsHidden importantForAccessibility="no" style={style.net}>
            <View style={style.post} />
            <View style={style.netLine} />
            <View style={style.post} />
          </View>
          <CourtSide
            label="Đối thủ"
            onClear={(index) => setSlot({ side: 'b', index }, null)}
            onPick={(index) => setPicking({ side: 'b', index })}
            onScore={setScoreB}
            players={opponents}
            score={scoreB}
            stakes={stakes}
          />
        </View>

        <Verdict
          problems={problems}
          ready={ready}
          usWon={Number.parseInt(scoreA, 10) > Number.parseInt(scoreB, 10)}
        />

        {logging.isError ? (
          <Text style={[font.body, { color: colour.down }]}>{logging.error.message}</Text>
        ) : null}

        <Button
          busy={logging.isPending}
          disabled={!ready}
          label={ready ? `Ghi trận ${scoreA}–${scoreB}` : stillNeeded(missing, scored, problems.length > 0)}
          onPress={submit}
        />

        {logging.isSuccess && !scored ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push(`/game/${logging.data.gameId}`)}
            style={({ pressed }) => [layout.card, pressed ? { opacity: 0.7 } : null]}
          >
            <View style={layout.spread}>
              <View style={layout.row}>
                <Ionicons color={colour.up} name="checkmark-circle" size={22} />
                <Text style={font.heading}>Đã ghi</Text>
              </View>
              <Text style={[font.body, { color: colour.courtInk, fontWeight: '600' }]}>Xem trận</Text>
            </View>
            <Text style={font.dim}>
              Trận tính điểm khi ba người còn lại xác nhận. Ghi nhầm thì bạn huỷ được trong lúc
              chờ. Chơi tiếp với bốn người này? Chỉ cần nhập tỉ số mới.
            </Text>
            {logging.data.notified ? null : (
              <Text style={font.dim}>Chưa gửi được thông báo, hãy nhắc mọi người xác nhận.</Text>
            )}
          </Pressable>
        ) : null}
      </ScrollView>

      <PlayerPicker
        onClose={() => setPicking(null)}
        onPick={(player) => {
          if (picking !== null) setSlot(picking, player);
          setPicking(null);
        }}
        taken={slots.flatMap((player) => (player === null ? [] : [player.profileId]))}
        visible={picking !== null}
      />
    </KeyboardAvoidingView>
  );
}

/** What the log button says while it cannot be pressed: the next thing to do. */
function stillNeeded(missing: number, scored: boolean, wrong: boolean): string {
  if (missing > 0) return missing === 1 ? 'Thêm 1 người nữa' : `Thêm ${missing} người nữa`;
  if (!scored) return 'Nhập tỉ số hai đội';
  return wrong ? 'Sửa tỉ số' : 'Ghi trận';
}

/** Why a score is refused, or who won once it is good to go. */
function Verdict({
  problems,
  ready,
  usWon,
}: {
  readonly problems: readonly ValidationProblem[];
  readonly ready: boolean;
  readonly usWon: boolean;
}) {
  if (problems.length > 0) {
    return (
      <View style={layout.row}>
        <Ionicons color={colour.down} name="alert-circle" size={18} />
        <Text style={[font.body, { color: colour.down, flex: 1 }]}>
          {describeProblem(problems[0])}
        </Text>
      </View>
    );
  }
  if (ready) {
    return (
      <View style={layout.row}>
        <Ionicons color={colour.up} name="checkmark-circle" size={18} />
        <Text style={font.body}>{usWon ? 'Đội bạn thắng.' : 'Đối thủ thắng.'}</Text>
      </View>
    );
  }
  return null;
}

/** The four, or null while a slot is still empty. */
function everyone(slots: readonly (Pickable | null)[]): readonly Pickable[] | null {
  const chosen = slots.flatMap((player) => (player === null ? [] : [player]));
  return chosen.length === slots.length ? chosen : null;
}

function describeProblem(problem: ValidationProblem): string {
  if (problem.kind === 'duplicate-player') return 'Có người bị chọn hai lần.';
  if (problem.kind === 'side-size') return 'Mỗi đội cần hai người.';
  return `Tỉ số này chưa kết thúc trận tới ${problem.format}. Đội thắng cần ${problem.format} điểm và hơn hai điểm, trừ khi chạm điểm tối đa.`;
}

const style = StyleSheet.create({
  court: {
    borderWidth: 3,
    borderColor: colour.card,
    borderRadius: radius.card + 4,
    backgroundColor: colour.court,
    overflow: 'hidden',
  },
  net: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: space.gap },
  netLine: { flex: 1, height: 0, borderTopWidth: 3, borderStyle: 'dashed', borderColor: colour.onCourt },
  post: { width: 6, height: 14, borderRadius: 2, backgroundColor: colour.onCourt },
});
