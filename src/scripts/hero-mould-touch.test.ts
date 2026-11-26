import { describe, expect, it } from 'vitest';
import { RUN_MS, gutterDots, type GutterPath } from './hero-mould-touch';
import { FALL_GRAVITY } from './pour-mould';

const path: GutterPath = { fromX: 200, fromY: 100, gutter: 380, headline: 300, toX: 300, toY: 700 };
const down = Math.sqrt((2 * (path.toY - path.fromY)) / FALL_GRAVITY) * 1000;
const head = (ms: number) => gutterDots(path, ms)!.at(-1)!;

describe('gutterDots', () => {
  it('starts under the lava with its trail', () => {
    expect(gutterDots(path, 0)).toHaveLength(3);
    expect(head(0)).toMatchObject({ x: 200, y: 100 });
  });

  it('is in the gutter before it reaches the headline, and stays there', () => {
    for (let ms = 0; ms < down; ms += 20) if (head(ms).y >= path.headline - 8) expect(head(ms).x).toBe(path.gutter);
  });

  it('runs sideways into the mould, then has arrived', () => {
    expect(head(down + RUN_MS / 2).x).toBeCloseTo(340);
    expect(head(down + RUN_MS / 2).y).toBe(700);
    expect(gutterDots(path, down + RUN_MS + 1)).toBeNull();
  });
});
