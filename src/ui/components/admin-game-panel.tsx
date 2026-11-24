import { useState } from 'react';
import { Text, View } from 'react-native';
import type { GameRow } from '../../data/games';
import { validateScore } from '../../domain/validation';
import { asGameFormat } from '../../domain/types';
import { useAdminAction } from '../queries';
import { colour, font, layout, space } from '../theme';
import { Button } from './button';
import { Field } from './field';

/**
 * Stories 65 and 66, and settling a dispute. Every action here ends in a replay on
 * the server, so the admin never edits a rating, only the record it is built from.
 */
export function AdminGamePanel({ row }: { readonly row: GameRow }) {
  const act = useAdminAction();
  const [scoreA, setScoreA] = useState(String(row.score_a));
  const [scoreB, setScoreB] = useState(String(row.score_b));
  const [reason, setReason] = useState('');

  if (row.status === 'voided') return null;

  const a = Number(scoreA);
  const b = Number(scoreB);
  const format = asGameFormat(row.format);
  const changed = a !== row.score_a || b !== row.score_b;
  const valid = format !== null && validateScore(format, a, b);

  return (
    <View style={layout.card}>
      <Text style={font.heading}>Admin</Text>

      {row.status === 'disputed' ? (
        <View style={{ gap: space.tight }}>
          <Button
            busy={act.isPending}
            label="Resolve: the score as logged stands"
            onPress={() => act.mutate({ action: 'resolve', gameId: row.id })}
          />
          <Text style={font.dim}>Or correct the score first, then resolve it.</Text>
        </View>
      ) : null}

      <View style={layout.row}>
        <View style={{ flex: 1 }}>
          <Field keyboardType="number-pad" label="Side A" onChangeText={setScoreA} value={scoreA} />
        </View>
        <View style={{ flex: 1 }}>
          <Field keyboardType="number-pad" label="Side B" onChangeText={setScoreB} value={scoreB} />
        </View>
      </View>
      {changed && !valid ? (
        <Text style={[font.dim, { color: colour.down }]}>
          {`Not a valid game to ${row.format}.`}
        </Text>
      ) : null}
      <Button
        busy={act.isPending}
        disabled={!changed || !valid}
        label="Correct the score"
        onPress={() => act.mutate({ action: 'correct-score', gameId: row.id, scoreA: a, scoreB: b })}
        tone="quiet"
      />

      <Field
        label="Why it is being removed"
        onChangeText={setReason}
        placeholder="Never played"
        value={reason}
      />
      <Button
        busy={act.isPending}
        disabled={reason.trim().length === 0}
        label="Remove this game"
        onPress={() => act.mutate({ action: 'void', gameId: row.id, reason: reason.trim() })}
        tone="danger"
      />

      {act.isError ? (
        <Text style={[font.dim, { color: colour.down }]}>{act.error.message}</Text>
      ) : null}
    </View>
  );
}
