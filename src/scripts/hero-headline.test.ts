import { describe, expect, it } from 'vitest';
import { groupLines, inkTop, type Letter } from './hero-headline';

const letter = (ch: string, x: number, baseline: number) => ({ ch, x, baseline, line: 0 }) as Letter;

describe('groupLines', () => {
  it('numbers lines from the top by baseline and orders each line left to right', () => {
    const letters = [letter('E', 0, 300), letter('H', 20, 140), letter('i', 0, 142), letter('g', 30, 301)];
    const lines = groupLines(letters);
    expect(lines.map((l) => l.map((x) => x.ch).join(''))).toEqual(['iH', 'Eg']);
    expect(letters.map((l) => l.line)).toEqual([1, 0, 0, 1]);
  });

  it('groups baselines 1px apart even across a rounding boundary', () => {
    expect(groupLines([letter('a', 0, 99), letter('b', 10, 100)])).toHaveLength(1);
  });

  it('keeps letters whose baselines differ by a few pixels on one line', () => {
    expect(groupLines([letter('a', 0, 100), letter('b', 10, 104)])).toHaveLength(1);
  });
});

describe('inkTop', () => {
  /** w x h bitmap, 4 bytes a pixel, ink (alpha 255) at the given [x, y] pixels */
  const bitmap = (w: number, h: number, ink: [number, number][]) => {
    const px = new Uint8ClampedArray(w * h * 4);
    for (const [x, y] of ink) px[(y * w + x) * 4 + 3] = 255;
    return px;
  };

  it('finds the first row with ink, in css px from y0', () => {
    expect(
      inkTop(
        bitmap(4, 6, [
          [2, 3],
          [1, 5],
        ]),
        4,
        100,
        1,
      ),
    ).toBe(103);
  });

  it('divides by the pixel ratio', () => {
    expect(inkTop(bitmap(4, 6, [[0, 4]]), 4, 50, 2)).toBe(52);
  });

  it('ignores faint antialiasing and finds nothing in an empty bitmap', () => {
    const faint = new Uint8ClampedArray(4 * 4 * 4);
    faint[3] = 90;
    expect(inkTop(faint, 4, 0, 1)).toBeNull();
  });
});
