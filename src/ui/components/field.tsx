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
      <Text style={font.dim}>{label}</Text>
      <TextInput
        {...input}
        placeholderTextColor={colour.dim}
        style={[style.input, problem != null ? style.wrong : null]}
      />
      {problem != null ? (
        <Text style={[font.dim, { color: colour.down }]}>{problem}</Text>
      ) : hint !== undefined ? (
        <Text style={font.dim}>{hint}</Text>
      ) : null}
    </View>
  );
}

/** One of a short, fixed set: a format, a tier, a ladder filter. */
export function Choice<T extends string | number>({
  options,
  value,
  onChange,
}: {
  readonly options: readonly { readonly value: T; readonly label: string }[];
  readonly value: T | null;
  readonly onChange: (value: T) => void;
}) {
  return (
    <View style={style.choices}>
      {options.map((option) => {
        const chosen = option.value === value;
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: chosen }}
            key={String(option.value)}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              style.choice,
              chosen ? style.chosen : null,
              pressed ? { opacity: 0.7 } : null,
            ]}
          >
            <Text style={[font.body, chosen ? style.chosenLabel : null]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const style = StyleSheet.create({
  field: { gap: space.tight },
  input: {
    minHeight: 48,
    paddingHorizontal: space.gap,
    borderRadius: radius.field,
    backgroundColor: colour.raised,
    borderWidth: 1,
    borderColor: colour.line,
    color: colour.text,
    fontSize: 16,
  },
  wrong: { borderColor: colour.down },
  choices: { flexDirection: 'row', gap: space.tight, flexWrap: 'wrap' },
  choice: {
    minHeight: 40,
    paddingHorizontal: space.gap,
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colour.raised,
    borderWidth: 1,
    borderColor: colour.line,
    flexGrow: 1,
    flexBasis: 0,
    alignItems: 'center',
  },
  chosen: { backgroundColor: colour.accent, borderColor: colour.accent },
  chosenLabel: { color: colour.onAccent, fontWeight: '600' },
});
