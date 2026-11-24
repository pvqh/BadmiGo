import { describe, expect, it } from 'vitest';
import { previewGame, type PreviewPlayer } from './rating-preview';
import { replayRatings, type RatedGame } from './rating';
import { SIGMA_INITIAL, displayRating, seedMu } from './rating-scale';
import type { ProfileId, Tier } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 1, 7);

/** A player as the ladder knows them: never played, so still on their seed. */
function fresh(profileId: ProfileId, tier: Tier): PreviewPlayer {
  return { profileId, mu: seedMu(tier), sigma: SIGMA_INITIAL, lastPlayedAt: null };
}

function changeFor(
  preview: ReturnType<typeof previewGame>,
  profileId: ProfileId,
): (typeof preview)[number] {
  const found = preview.find((change) => change.profileId === profileId);
  if (found === undefined) throw new Error(`${profileId} is missing from the preview`);
  return found;
}

describe('previewing a prospective game', () => {
  const strong = [fresh('sam', 'kha'), fresh('sia', 'kha')] as const;
  const weak = [fresh('wes', 'newbie'), fresh('wren', 'newbie')] as const;

  it('shows all four players', () => {
    const preview = previewGame({ sideA: strong, sideB: weak, now: NOW });
    expect(preview.map((change) => change.profileId)).toEqual(['sam', 'sia', 'wes', 'wren']);
  });

  it('starts every player at the rating the ladder already shows', () => {
    const preview = previewGame({ sideA: strong, sideB: weak, now: NOW });
    expect(changeFor(preview, 'sam').displayBefore).toBe(
      displayRating(seedMu('kha'), SIGMA_INITIAL),
    );
  });

  it('always leaves a player better off for winning than for losing', () => {
    const preview = previewGame({ sideA: strong, sideB: weak, now: NOW });
    for (const change of preview) {
      expect(change.displayIfWon).toBeGreaterThan(change.displayIfLost);
    }
  });

  it('offers the underdog more for a win than the favourite stands to gain', () => {
    const preview = previewGame({ sideA: strong, sideB: weak, now: NOW });
    const underdog = changeFor(preview, 'wes');
    const favourite = changeFor(preview, 'sam');

    expect(underdog.displayIfWon - underdog.displayBefore).toBeGreaterThan(
      favourite.displayIfWon - favourite.displayBefore,
    );
  });

  it('is the same every time it is asked', () => {
    expect(previewGame({ sideA: strong, sideB: weak, now: NOW })).toEqual(
      previewGame({ sideA: strong, sideB: weak, now: NOW }),
    );
  });
});

/**
 * The preview is untrusted and never persisted, but it must not lie: the numbers it
 * offers before submitting are the numbers the server's replay will land on.
 */
describe('agreeing with the authoritative replay', () => {
  const SEEDS = [
    { profileId: 'sam', seedTier: 'kha' as Tier },
    { profileId: 'sia', seedTier: 'kha' as Tier },
    { profileId: 'wes', seedTier: 'newbie' as Tier },
    { profileId: 'wren', seedTier: 'newbie' as Tier },
  ];

  const game: RatedGame = {
    id: 'g1',
    playedAt: NOW,
    sideA: ['sam', 'sia'],
    sideB: ['wes', 'wren'],
    scoreA: 15,
    scoreB: 21,
  };

  it('predicts exactly what the replay produces for the same upset', () => {
    const { history } = replayRatings({ seeds: SEEDS, games: [game], now: NOW });
    const preview = previewGame({
      sideA: [fresh('sam', 'kha'), fresh('sia', 'kha')],
      sideB: [fresh('wes', 'newbie'), fresh('wren', 'newbie')],
      now: NOW,
    });

    for (const change of history) {
      const previewed = changeFor(preview, change.profileId);
      const sideBWon = game.scoreB > game.scoreA;
      const onSideB = game.sideB.includes(change.profileId);
      const expected = onSideB === sideBWon ? previewed.displayIfWon : previewed.displayIfLost;

      expect(expected).toBe(change.displayAfter);
      expect(previewed.displayBefore).toBe(change.displayBefore);
    }
  });

  it('widens a returning player uncertainty exactly as the replay would', () => {
    const lastPlayed = NOW - 60 * DAY_MS;
    const first: RatedGame = { ...game, id: 'g1', playedAt: lastPlayed };
    const returning: RatedGame = { ...game, id: 'g2', playedAt: NOW };

    // Where the preview starts: the ratings the ladder holds after that first game.
    const { ratings } = replayRatings({ seeds: SEEDS, games: [first], now: lastPlayed });

    const asLadderKnowsThem = (profileId: ProfileId): PreviewPlayer => {
      const rating = ratings.find((entry) => entry.profileId === profileId);
      if (rating === undefined) throw new Error(`${profileId} has no rating`);
      return {
        profileId,
        mu: rating.mu,
        sigma: rating.sigma,
        lastPlayedAt: rating.lastPlayedAt,
      };
    };

    const preview = previewGame({
      sideA: [asLadderKnowsThem('sam'), asLadderKnowsThem('sia')],
      sideB: [asLadderKnowsThem('wes'), asLadderKnowsThem('wren')],
      now: NOW,
    });

    const { history } = replayRatings({ seeds: SEEDS, games: [first, returning], now: NOW });
    for (const change of history.filter((entry) => entry.gameId === 'g2')) {
      const previewed = changeFor(preview, change.profileId);
      const onSideB = returning.sideB.includes(change.profileId);
      const expected = onSideB ? previewed.displayIfWon : previewed.displayIfLost;
      expect(expected).toBe(change.displayAfter);
    }
  });
});
