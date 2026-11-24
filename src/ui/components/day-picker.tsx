import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colour, font, radius, space } from '../theme';
import { describeDay } from '../vocabulary';

/**
 * Story 46a: one day, picked on the phone's own date wheel. The app is only ever a web
 * page, so a real date input sits invisibly over the chip; tapping the chip taps the
 * input, which is the one way iPhone Safari reliably opens its picker.
 */
export function DayPicker({
  day,
  onChange,
}: {
  readonly day: string | null;
  readonly onChange: (day: string | null) => void;
}) {
  return (
    <View style={style.row}>
      <View style={[style.chip, day === null ? null : style.chosen]}>
        <Ionicons color={day === null ? colour.dim : colour.courtInk} name="calendar" size={16} />
        <Text style={[font.body, { color: day === null ? colour.dim : colour.text }]}>
          {day === null ? 'Ngày bất kỳ' : describeDay(day)}
        </Text>
        <input
          aria-label="Chọn ngày"
          max={today()}
          onChange={(event) => onChange(event.target.value === '' ? null : event.target.value)}
          style={overlay}
          type="date"
          value={day ?? ''}
        />
      </View>
      {day === null ? null : (
        <Pressable accessibilityLabel="Bỏ chọn ngày" hitSlop={12} onPress={() => onChange(null)}>
          <Ionicons color={colour.dim} name="close-circle" size={18} />
        </Pressable>
      )}
    </View>
  );
}

/** No game has been played tomorrow. */
function today(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

// A DOM style, not a React Native one. 16px stops iPhone zooming the page on focus.
const overlay = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  opacity: 0,
  fontSize: 16,
  cursor: 'pointer',
} as const;

const style = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.row },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.tight,
    minHeight: 40,
    paddingHorizontal: space.gap,
    borderRadius: radius.field,
    backgroundColor: colour.card,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  chosen: { borderColor: colour.courtInk },
});
