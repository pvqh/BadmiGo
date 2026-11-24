import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { colour, font, radius, space } from '../theme';

export function Field({
  label,
  hint,
  problem,
  ...input
}: {
  readonly label: string;
  readonly hint?: string;
  readonly problem?: string | null;
} & TextInputProps) {
  return (
    <View style={style.field}>
      <Text style={style.label}>{label}</Text>
      <TextInput
        {...input}
        accessibilityLabel={label}
        placeholderTextColor={colour.dim}
        style={[style.input, input.editable === false ? style.locked : null, problem != null ? style.wrong : null]}
      />
      {problem != null ? (
        <Text style={[font.dim, { color: colour.down }]}>{problem}</Text>
      ) : hint !== undefined ? (
        <Text style={font.dim}>{hint}</Text>
      ) : null}
    </View>
  );
}

/**
 * One of a short, fixed set: a format, a tier, a ladder filter. Drawn as one segmented
 * track so the choices read as alternatives, with the chosen one lifted out in green.
 */
export function Choice<T extends string | number>({
  options,
  value,
  onChange,
  onCourt = false,
}: {
  readonly options: readonly { readonly value: T; readonly label: string }[];
  readonly value: T | null;
  readonly onChange: (value: T) => void;
  /** Sitting on the green head of the ladder rather than on the floor. */
  readonly onCourt?: boolean;
}) {
  return (
    <View accessibilityRole="radiogroup" style={[style.track, onCourt ? style.courtTrack : null]}>
      {options.map((option) => {
        const chosen = option.value === value;
        return (
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ checked: chosen }}
            key={String(option.value)}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              style.choice,
              chosen ? (onCourt ? style.chosenOnCourt : style.chosen) : null,
              pressed && !chosen ? { opacity: 0.6 } : null,
            ]}
          >
            <Text
              numberOfLines={1}
              style={[
                style.choiceLabel,
                onCourt ? { color: colour.onCourtDim } : null,
                chosen ? (onCourt ? { color: colour.court } : { color: colour.onCourt }) : null,
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const style = StyleSheet.create({
  field: { gap: space.tight },
  label: { ...font.dim, fontWeight: '600', color: colour.text },
  input: {
    ...font.body,
    minHeight: 52,
    paddingHorizontal: space.gap,
    borderRadius: radius.field,
    backgroundColor: colour.card,
    borderWidth: 1.5,
    borderColor: colour.line,
  },
  locked: { backgroundColor: colour.raised, color: colour.dim },
  wrong: { borderColor: colour.down },
  track: {
    flexDirection: 'row',
    gap: 4,
    padding: 4,
    borderRadius: radius.pill,
    backgroundColor: colour.card,
  },
  courtTrack: { backgroundColor: colour.courtDeep },
  choice: {
    minHeight: 40,
    paddingHorizontal: space.tight,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: radius.pill,
    // Sized from the label, not split evenly, so "Newbie" is not cut off beside "Y".
    flexGrow: 1,
    flexBasis: 'auto',
  },
  chosen: { backgroundColor: colour.court },
  chosenOnCourt: { backgroundColor: colour.onCourt },
  choiceLabel: { ...font.body, fontSize: 15, fontWeight: '600', color: colour.text },
});
