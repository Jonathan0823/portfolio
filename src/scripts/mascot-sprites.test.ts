import { describe, expect, it } from 'vitest';
import { CLAWD, PI, type MascotSprite, type Rect } from './mascot-sprites';

const cells = (rects: Rect[]) => rects.reduce((n, r) => n + r.w * r.h, 0);
const inside = (sprite: MascotSprite) =>
  [...sprite.body, ...sprite.legs.flat(), ...sprite.eyes, ...sprite.lids].every(
    (r) => r.x >= 0 && r.y >= 0 && r.x + r.w <= sprite.width && r.y + r.h <= sprite.height,
  );

describe('Clawd', () => {
  it('is 9 cells wide and 5 tall in half cells, drawn in the brand colour with dark eyes', () => {
    expect(CLAWD.width).toBe(18);
    expect(CLAWD.height).toBe(10);
    expect(new Set(CLAWD.body.map((r) => r.color))).toEqual(new Set(['#D97757']));
    expect(CLAWD.eyes.map((r) => r.color)).toEqual(['#111', '#111']);
    expect(CLAWD.lids.map((r) => r.x)).toEqual(CLAWD.eyes.map((r) => r.x));
    expect(inside(CLAWD)).toBe(true);
  });

  it('has two leg frames, one with four feet, and feet in two pairs', () => {
    expect(CLAWD.legs).toHaveLength(2);
    expect(CLAWD.legs[1]).toHaveLength(4);
    expect(CLAWD.feet).toEqual([
      [4, 6],
      [11, 13],
    ]);
    expect(cells(CLAWD.legs[0])).toBe(8);
  });
});

describe('Pi', () => {
  it('is the skills grid art: 4x4 cells, each one field cell', () => {
    expect(PI.width).toBe(8);
    expect(PI.height).toBe(8);
    expect(cells(PI.body)).toBe(10 * 4);
    expect(new Set(PI.body.map((r) => r.color))).toEqual(new Set(['#f09082', '#4d9abf', '#f1be58']));
    expect(inside(PI)).toBe(true);
  });

  it('stands on two legs, each a cell wide', () => {
    expect(PI.feet).toEqual([
      [0, 1],
      [6, 7],
    ]);
  });
});
