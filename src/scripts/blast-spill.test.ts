import { describe, expect, it } from 'vitest';
import { spillStrips } from './blast-spill';

const screen = { from: 0, to: 80 };

describe('spillStrips', () => {
  it('is empty for a blast that stays on the field canvas', () => {
    expect(spillStrips(50, 20, 10, 137, 48, screen)).toEqual([]);
  });

  it('covers only the rows past the canvas, within the columns and the screen', () => {
    expect(spillStrips(5, 40, 41, 137, 48, screen)).toEqual([{ c0: 0, c1: 46, r0: 48, r1: 80 }]);
  });

  it('reaches below row 0 when that is on screen, as under the footer', () => {
    expect(spillStrips(50, 4, 10, 137, 48, { from: -6, to: 70 })).toEqual([{ c0: 40, c1: 60, r0: -6, r1: 0 }]);
  });

  it('has a strip on each side for a blast bigger than the canvas', () => {
    expect(spillStrips(50, 20, 40, 137, 48, { from: -6, to: 70 })).toEqual([
      { c0: 10, c1: 90, r0: -6, r1: 0 },
      { c0: 10, c1: 90, r0: 48, r1: 60 },
    ]);
  });

  it('is empty when the part past the canvas is off screen', () => {
    expect(spillStrips(50, 40, 41, 137, 48, { from: 0, to: 40 })).toEqual([]);
  });
});
