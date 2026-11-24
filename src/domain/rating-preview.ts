import { rate } from 'openskill';
import { displayRating, inflateSigmaForIdleTime } from './rating-scale.ts';
import type { ProfileId } from './types.ts';

/**
 * What a logger is shown before submitting: what each of the four stands to gain or
 * lose. Deliberately separate from rating.ts, which is the authoritative replay the
 * Edge Function runs, because nothing here is ever persisted or trusted — see
 * CLAUDE.md, hard rule 3. The arithmetic is the same so the preview cannot lie, and
 * rating-preview.test.ts holds it to the replay's own output.
 */

export interface PreviewPlayer {
  readonly profileId: ProfileId;
  readonly mu: number;
  readonly sigma: number;
  readonly lastPlayedAt: number | null;
}

export interface PreviewedChange {
  readonly profileId: ProfileId;
  readonly displayBefore: number;
  readonly displayIfWon: number;
  readonly displayIfLost: number;
}

export function previewGame(input: {
  readonly sideA: readonly [PreviewPlayer, PreviewPlayer];
  readonly sideB: readonly [PreviewPlayer, PreviewPlayer];
  readonly now: number;
}): readonly PreviewedChange[] {
  const lineup = [...input.sideA, ...input.sideB];
  const playing = lineup.map((player) => ({ mu: player.mu, sigma: widened(player, input.now) }));

  const sideA = [playing[0], playing[1]];
  const sideB = [playing[2], playing[3]];
  const [wonByA, lostByB] = rate([sideA, sideB]);
  const [wonByB, lostByA] = rate([sideB, sideA]);

  return lineup.map((player, index) => {
    const onSideA = index < 2;
    const slot = onSideA ? index : index - 2;
    const won = onSideA ? wonByA[slot] : wonByB[slot];
    const lost = onSideA ? lostByA[slot] : lostByB[slot];

    return {
      profileId: player.profileId,
      displayBefore: displayRating(player.mu, player.sigma),
      displayIfWon: displayRating(won.mu, won.sigma),
      displayIfLost: displayRating(lost.mu, lost.sigma),
    };
  });
}

/** The replay widens a returning player's sigma as they play; a preview must too. */
function widened(player: PreviewPlayer, now: number): number {
  if (player.lastPlayedAt === null) return player.sigma;
  return inflateSigmaForIdleTime(player.sigma, now - player.lastPlayedAt);
}
