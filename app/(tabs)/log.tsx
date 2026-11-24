import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { GameFormat, Side } from '../../src/domain/types';
import { validateProposedGame, type ValidationProblem } from '../../src/domain/validation';
import { Button } from '../../src/ui/components/button';
import { CourtSide } from '../../src/ui/components/court-side';
import { Choice } from '../../src/ui/components/field';
import { PhotoPicker } from '../../src/ui/components/photo-picker';
import { PlayerPicker, type Pickable } from '../../src/ui/components/player-picker';
import { useLogGame, useStrengths } from '../../src/ui/queries';
import { useMember } from '../../src/ui/session';
import { stakesFor } from '../../src/ui/stakes';
import { colour, font, layout, radius } from '../../src/ui/theme';

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
  const [photo, setPhoto] = useState<Blob | null>(null);

  const strengths = useStrengths();
  const logging = useLogGame(me.id);

  const myself: Pickable = { profileId: me.id, displayName: 'You' };
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
      { ...proposed, loggerId: me.id, photo },
      {
        onSuccess: () => {
          setScoreA('');
          setScoreB('');
          // The lineup carries over to the next game; a photo belongs to this one.
          setPhoto(null);
        },
      },
    );
  };

  return (
    <KeyboardAvoidingView behavior="padding" style={layout.screen}>
      <ScrollView contentContainerStyle={layout.page} keyboardShouldPersistTaps="handled">
        <View style={layout.row}>
          <Text style={font.body}>Game to</Text>
          <View style={{ flex: 1 }}>
            <Choice onChange={setFormat} options={FORMATS} value={format} />
          </View>
        </View>

        <View style={style.court}>
          <CourtSide
            label="Them"
            onClear={(index) => setSlot({ side: 'b', index }, null)}
            onPick={(index) => setPicking({ side: 'b', index })}
            onScore={setScoreB}
            players={opponents}
            score={scoreB}
            stakes={stakes}
          />
          <View style={style.net} />
          <CourtSide
            label="Us"
            locked={me.id}
            onClear={(index) => setSlot({ side: 'a', index }, null)}
            onPick={(index) => setPicking({ side: 'a', index })}
            onScore={setScoreA}
            players={[myself, partner]}
            score={scoreA}
            stakes={stakes}
          />
        </View>

        <Verdict
          missing={missing}
          problems={problems}
          ready={ready}
          scored={scored}
          usWon={Number.parseInt(scoreA, 10) > Number.parseInt(scoreB, 10)}
        />

        {logging.isError ? (
          <Text style={[font.body, { color: colour.down }]}>{logging.error.message}</Text>
        ) : null}

        <PhotoPicker onChange={setPhoto} photo={photo} />

        <Button busy={logging.isPending} disabled={!ready} label="Log game" onPress={submit} />

        {logging.isSuccess && !scored ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push(`/game/${logging.data}`)}
            style={({ pressed }) => [layout.card, pressed ? { opacity: 0.7 } : null]}
          >
            <View style={layout.spread}>
              <Text style={font.heading}>Logged</Text>
              <Text style={[font.body, { color: colour.accent }]}>See game</Text>
            </View>
            <Text style={font.dim}>
              The other three have 24 hours to confirm. Playing the same four again? Just
              enter the next score.
            </Text>
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

/** The one line that says what is still needed, or that the game is good to go. */
function Verdict({
  missing,
  scored,
  problems,
  ready,
  usWon,
}: {
  readonly missing: number;
  readonly scored: boolean;
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
        <Text style={font.body}>{usWon ? 'Your side won.' : 'Their side won.'}</Text>
      </View>
    );
  }
  return (
    <Text style={font.dim}>
      {missing > 0
        ? `Add ${missing === 1 ? 'one more player' : `${missing} more players`}${scored ? '.' : ', then both scores.'}`
        : 'Enter both scores.'}
    </Text>
  );
}

/** The four, or null while a slot is still empty. */
function everyone(slots: readonly (Pickable | null)[]): readonly Pickable[] | null {
  const chosen = slots.flatMap((player) => (player === null ? [] : [player]));
  return chosen.length === slots.length ? chosen : null;
}

function describeProblem(problem: ValidationProblem): string {
  if (problem.kind === 'duplicate-player') return 'Someone is in the game twice.';
  if (problem.kind === 'side-size') return 'Each side needs two players.';
  return `That is not a finished game to ${problem.format}. The winner needs ${problem.format} and a two-point lead, unless it went to the cap.`;
}

const style = StyleSheet.create({
  court: {
    borderWidth: 2,
    borderColor: colour.court,
    borderRadius: radius.field,
    backgroundColor: colour.card,
    overflow: 'hidden',
  },
  net: { height: 3, backgroundColor: colour.court },
});
