import { describe, expect, it } from 'vitest';
import { overtaken, type LadderPlace } from './overtaken';

function place(
  profileId: string,
  displayRating: number,
  { active = true, inPlacement = false } = {},
): LadderPlace {
  return { profileId, displayRating, active, inPlacement };
}

describe('overtaken', () => {
  it('reports who passed whom when a player climbs over another', () => {
    const before = [place('ann', 700), place('bo', 650), place('cy', 600)];
    const after = [place('ann', 700), place('cy', 660), place('bo', 650)];

    expect(overtaken(before, after)).toEqual(new Map([['bo', ['cy']]]));
  });

  it('counts a fall as being passed, by everyone the player fell below', () => {
    const before = [place('ann', 700), place('bo', 650), place('cy', 600)];
    const after = [place('bo', 650), place('cy', 600), place('ann', 590)];

    expect(overtaken(before, after)).toEqual(new Map([['ann', ['bo', 'cy']]]));
  });

  it('reports nothing when the order is unchanged, however the numbers moved', () => {
    const before = [place('ann', 700), place('bo', 650)];
    const after = [place('ann', 720), place('bo', 690)];

    expect(overtaken(before, after)).toEqual(new Map());
  });

  it('ignores anyone who was still placing on either side of the replay', () => {
    const before = [place('ann', 700), place('new', 400, { inPlacement: true })];
    const after = [place('new', 750), place('ann', 700)];

    expect(overtaken(before, after)).toEqual(new Map());
  });

  it('ignores anyone who was away on either side of the replay', () => {
    const before = [place('ann', 700), place('back', 400, { active: false })];
    const after = [place('back', 750), place('ann', 700)];

    expect(overtaken(before, after)).toEqual(new Map());
  });

  it('breaks rating ties by profile id, as the replay orders the ladder', () => {
    const before = [place('bo', 650), place('cy', 640)];
    const after = [place('bo', 650), place('cy', 650)];

    expect(overtaken(before, after)).toEqual(new Map());
  });
});
