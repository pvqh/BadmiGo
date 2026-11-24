import { StyleSheet } from 'react-native';
import type { Tier } from '../domain/types';

export type Scheme = 'light' | 'dark';

const SCHEME_KEY = 'badmigo.scheme';

/**
 * Light unless this phone chose dark. Read once, before any style sheet below is
 * built: every screen captures the palette when it is imported, so a change reloads
 * the page instead of threading a theme through thirty files. public/index.html reads
 * the same key to paint the floor before the app arrives.
 */
export const scheme: Scheme =
  typeof localStorage !== 'undefined' && localStorage.getItem(SCHEME_KEY) === 'dark' ? 'dark' : 'light';

export function chooseScheme(next: Scheme): void {
  if (next === scheme) return;
  localStorage.setItem(SCHEME_KEY, next);
  window.location.reload();
}

/**
 * Taken from the hall: a pale floor, white for anything you can read or tap, the court
 * mat's green for the head of the ladder, and the yellow of a nylon practice shuttle
 * for whatever is yours or the next thing to press. Light by default because a bright
 * hall washes out a dark screen; dark for the evening and for whoever prefers it.
 * `court` is the green as a surface; `courtInk` is the green as text and icons, which
 * has to lighten on a dark card to stay readable.
 */
const LIGHT = {
  background: '#EEF2EF',
  card: '#FFFFFF',
  raised: '#E3E9E5',
  line: '#DCE4DF',
  switchOff: '#B8C4BE',
  court: '#0E7A4F',
  courtInk: '#0E7A4F',
  courtDeep: '#0A5E3C',
  courtSoft: '#D4F0E1',
  onCourt: '#FFFFFF',
  onCourtDim: '#CFE7DA',
  text: '#0F241B',
  dim: '#5A6E64',
  shuttle: '#FFD23F',
  shuttleSoft: '#FFF4C2',
  onShuttle: '#0F241B',
  onShuttleDim: '#4A3D00',
  up: '#0B7A3E',
  down: '#B3261E',
  pending: '#1F6FA8',
};

/** The same hall at night: green-black floor, the shuttle yellow unchanged. */
const DARK: typeof LIGHT = {
  background: '#0C1612',
  card: '#15221C',
  raised: '#1F2F28',
  line: '#2A3B33',
  switchOff: '#3E5047',
  court: '#14794D',
  courtInk: '#4CC48A',
  courtDeep: '#0D5A39',
  courtSoft: '#1A3A2B',
  onCourt: '#FFFFFF',
  onCourtDim: '#CFE7DA',
  text: '#E6EFEA',
  dim: '#98ABA1',
  shuttle: '#FFD23F',
  shuttleSoft: '#3B3416',
  onShuttle: '#0F241B',
  onShuttleDim: '#4A3D00',
  up: '#5BD293',
  down: '#FF8A80',
  pending: '#7DBEF0',
};

export const colour = scheme === 'dark' ? DARK : LIGHT;

type TierColours = Record<Tier, { readonly fill: string; readonly ink: string }>;

/**
 * A soft colour per tier, cool at the bottom and hot at the top, so a ladder reads by
 * level at a glance. Each label contrasts with its tint, so it never relies on hue alone.
 */
export const tierColour: TierColours =
  scheme === 'dark'
    ? {
        newbie: { fill: '#26332D', ink: '#C3D1CA' },
        y: { fill: '#16364A', ink: '#9FD3F2' },
        tby: { fill: '#173D2C', ink: '#8FE0B5' },
        'tb-plus': { fill: '#43301A', ink: '#FFC983' },
        kha: { fill: '#4A221E', ink: '#FFB0A3' },
      }
    : {
        newbie: { fill: '#E1E7E3', ink: '#3E4F47' },
        y: { fill: '#D6ECF7', ink: '#135574' },
        tby: { fill: '#D4F0E1', ink: '#0B6B42' },
        'tb-plus': { fill: '#FFE7C2', ink: '#7A4300' },
        kha: { fill: '#FFD9D2', ink: '#9B2317' },
      };

export const space = { tight: 6, row: 10, gap: 14, block: 22, page: 16 } as const;

export const radius = { field: 12, card: 18, pill: 999 } as const;

/** Self-hosted in public/fonts, so they exist on every phone, not only on iPhones. */
const READING = 'Be Vietnam Pro';
const SCOREBOARD = 'Bricolage';

/** The handful of arrangements every screen is built from. */
export const layout = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colour.background },
  page: { padding: space.page, gap: space.gap, paddingBottom: space.block * 2 },
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
 * Be Vietnam Pro for reading, because it was drawn for Vietnamese and its diacritics
 * sit right; a condensed Bricolage for anything that is a number on a scoreboard.
 */
export const font = StyleSheet.create({
  title: { color: colour.text, fontSize: 30, fontFamily: SCOREBOARD, fontWeight: '800' },
  heading: { color: colour.text, fontSize: 17, fontFamily: READING, fontWeight: '700' },
  body: { color: colour.text, fontSize: 16, fontFamily: READING, fontWeight: '400' },
  dim: { color: colour.dim, fontSize: 14, fontFamily: READING, fontWeight: '400' },
  figure: {
    color: colour.text,
    fontSize: 18,
    fontFamily: SCOREBOARD,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  score: {
    color: colour.text,
    fontSize: 44,
    fontFamily: SCOREBOARD,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
});
