import { describe, expect, it } from 'vitest';
import { FALL_MS, placeDrop } from './loose-drops';

const drop = { column: 12, from: 20, to: 30, born: 1000 };

describe('placeDrop', () => {
  it('starts at the edge it shook loose from', () => {
    expect(placeDrop(drop, 1000)).toEqual({ column: 12, row: 20, falling: 0 });
  });

  it('speeds up as it falls', () => {
    const quarter = placeDrop(drop, 1000 + FALL_MS / 4)!.row - 20;
    const half = placeDrop(drop, 1000 + FALL_MS / 2)!.row - 20;
    expect(half).toBeGreaterThan(quarter * 2);
  });

  it('is gone once it has fallen, and not there before it lets go', () => {
    expect(placeDrop(drop, 1000 + FALL_MS)).toBeNull();
    expect(placeDrop(drop, 999)).toBeNull();
    expect(placeDrop(drop, 1000 + FALL_MS - 1)!.row).toBeLessThanOrEqual(30);
  });
});
