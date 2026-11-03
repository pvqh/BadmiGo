import { seedMu } from '../domain/rating-scale';
import type { RatedGame } from '../domain/rating';
import type { ProfileId, Tier } from '../domain/types';

/**
 * A synthetic club with known true skills, used to test the premise rather than the
 * code: can the engine recover a ranking it was never told? Everything here is
 * driven by an explicit seed, so a run is reproducible and a parameter change shows
 * up as a change in recovery rather than as noise.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

/** A plausible pyramid for thirty people: a wide base of improvers, a few strong players. */
const TIER_POPULATION: ReadonlyArray<readonly [Tier, number]> = [
  ['newbie', 6],
  ['y', 7],
  ['tby', 8],
  ['tb-plus', 6],
  ['kha', 3],
];

/** How honest a self-declared seed is. True skill sits within this of the tier's mu. */
const SEED_MISJUDGEMENT = 3;

/**
 * Converts a team skill difference into a win probability. Scaled so one tier of
 * advantage per player — ten points across a pair — wins about 73% of the time,
 * which is roughly what this club sees.
 */
const SKILL_SCALE = 10;

export interface SyntheticPlayer {
  readonly profileId: ProfileId;
  readonly trueSkill: number;
  readonly seedTier: Tier;
}

export interface SeasonOptions {
  readonly seed: number;
  /** Saturday and Sunday for four weeks. */
  readonly sessions?: number;
  readonly gamesPerPlayerPerSession?: number;
}

export function syntheticClub(seed: number): readonly SyntheticPlayer[] {
  const random = randomSource(seed);
  const players: SyntheticPlayer[] = [];

  for (const [seedTier, population] of TIER_POPULATION) {
    for (let index = 0; index < population; index += 1) {
      const drift = (random() * 2 - 1) * SEED_MISJUDGEMENT;
      players.push({
        profileId: `${seedTier}-${index + 1}`,
        trueSkill: seedMu(seedTier) + drift,
        seedTier,
      });
    }
  }

  return players;
}

export function simulateSeason(
  club: readonly SyntheticPlayer[],
  options: SeasonOptions,
): readonly RatedGame[] {
  const { seed, sessions = 8, gamesPerPlayerPerSession = 5 } = options;
  const random = randomSource(seed);
  const games: RatedGame[] = [];

  for (let session = 0; session < sessions; session += 1) {
    const sessionStart = weekendDay(session) + 10 * 60 * MINUTE_MS;
    const attendees = club.filter(() => random() > 0.1);
    const courts = courtsFor(attendees.length);
    const rounds = Math.max(
      1,
      Math.round((gamesPerPlayerPerSession * attendees.length) / 4 / courts),
    );

    for (let round = 0; round < rounds; round += 1) {
      const shuffled = shuffle(attendees, random);
      for (let court = 0; court + 4 <= shuffled.length; court += 4) {
        games.push(
          playGame({
            id: `s${session}-r${round}-c${court / 4}`,
            playedAt: sessionStart + (round * 15 + court) * MINUTE_MS,
            four: shuffled.slice(court, court + 4),
            random,
          }),
        );
      }
    }
  }

  return games;
}

function courtsFor(attendees: number): number {
  return Math.max(1, Math.floor(attendees / 4));
}

/** Saturdays and Sundays, two sessions a weekend. */
function weekendDay(session: number): number {
  const weekend = Math.floor(session / 2);
  const dayOfWeekend = session % 2;
  return (weekend * 7 + dayOfWeekend) * DAY_MS;
}

function playGame(input: {
  id: string;
  playedAt: number;
  four: readonly SyntheticPlayer[];
  random: () => number;
}): RatedGame {
  const [sideA, sideB] = pairUp(input.four, input.random);

  const chanceA = winProbability(teamSkill(sideA), teamSkill(sideB));
  const sideAWon = input.random() < chanceA;
  const loserScore = 10 + Math.floor(input.random() * 10);

  return {
    id: input.id,
    playedAt: input.playedAt,
    sideA: [sideA[0].profileId, sideA[1].profileId],
    sideB: [sideB[0].profileId, sideB[1].profileId],
    scoreA: sideAWon ? 21 : loserScore,
    scoreB: sideAWon ? loserScore : 21,
  };
}

/**
 * Clubs that span this much ability mostly pair their strongest player with their
 * weakest to keep a game competitive, which is exactly the pattern OpenSkill finds
 * hardest. Level pairing happens too, so both are generated.
 */
function pairUp(
  four: readonly SyntheticPlayer[],
  random: () => number,
): readonly [
  readonly [SyntheticPlayer, SyntheticPlayer],
  readonly [SyntheticPlayer, SyntheticPlayer],
] {
  const [weakest, third, second, strongest] = [...four].sort(
    (left, right) => left.trueSkill - right.trueSkill,
  );

  if (random() < 0.7) {
    return [
      [strongest, weakest],
      [second, third],
    ];
  }
  return [
    [strongest, second],
    [third, weakest],
  ];
}

function teamSkill(pair: readonly [SyntheticPlayer, SyntheticPlayer]): number {
  return pair[0].trueSkill + pair[1].trueSkill;
}

function winProbability(skill: number, opponentSkill: number): number {
  return 1 / (1 + Math.exp((opponentSkill - skill) / SKILL_SCALE));
}

function shuffle<T>(items: readonly T[], random: () => number): readonly T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

/** mulberry32: small, fast, and good enough to stand in for a club's randomness. */
function randomSource(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
