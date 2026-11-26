import { describe, expect, it } from 'vitest';
import { SHAPES, SHAPE_SIZE, isShapeName, shapeCells } from './cursor-shapes';

describe('cursor shapes', () => {
  it('are all square bitmaps of the same size', () => {
    for (const rows of Object.values(SHAPES)) {
      expect(rows).toHaveLength(SHAPE_SIZE);
      for (const row of rows) expect(row).toHaveLength(SHAPE_SIZE);
    }
  });
  it('lists filled cells around the centre', () => {
    const cells = shapeCells('minus');
    expect(cells).toHaveLength(SHAPE_SIZE * 3);
    expect(cells.every((c) => Math.abs(c.dy) <= 1 && c.distance >= 0 && c.distance <= 1)).toBe(true);
  });
  it('recognises names', () => {
    expect(isShapeName('eye')).toBe(true);
    expect(isShapeName('toString')).toBe(false);
    expect(isShapeName(undefined)).toBe(false);
  });
});
