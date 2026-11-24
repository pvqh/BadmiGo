import { StyleSheet } from 'react-native';

/**
 * One dark palette, taken from the hall the club plays in: court-mat green, white
 * court lines, and the gold of a shuttle's cork for whatever is yours or the next
 * thing to press. Two themes would double every screen's styling for thirty players.
 */
export const colour = {
  background: '#0e3b2e',
  card: '#134636',
  raised: '#1a5241',
  deep: '#0a2d23',
  line: 'rgba(236, 243, 237, 0.16)',
  court: '#ecf3ed',
  text: '#f4f7f2',
  dim: '#a3bdb1',
  accent: '#eab54d',
  onAccent: '#2b1f06',
  up: '#c2f2a4',
  down: '#ffa08f',
  pending: '#9fd4ff',
} as const;

export const space = { tight: 6, row: 10, gap: 14, block: 22, page: 18 } as const;

export const radius = { field: 10, card: 14, pill: 999 } as const;

/** The handful of arrangements every screen is built from. */
export const layout = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colour.background },
  page: { padding: space.page, gap: space.gap },
  card: {
    backgroundColor: colour.card,
    borderRadius: radius.card,
    padding: space.gap,
    gap: space.row,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.row },
  spread: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.row,
  },
  centre: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.block,
    gap: space.gap,
  },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: colour.line },
});

/**
 * System text for reading, and the DIN faces iOS ships for anything that is a number
 * on a scoreboard — no font package to install, and it is what a sports hall looks like.
 */
export const font = StyleSheet.create({
  title: { color: colour.text, fontSize: 28, fontWeight: '700' },
  heading: { color: colour.text, fontSize: 17, fontWeight: '600' },
  body: { color: colour.text, fontSize: 15 },
  dim: { color: colour.dim, fontSize: 13 },
  figure: { color: colour.text, fontSize: 18, fontFamily: 'DINAlternate-Bold' },
  score: { color: colour.text, fontSize: 44, fontFamily: 'DINCondensed-Bold' },
});
