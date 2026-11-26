import { describe, expect, it } from 'vitest';
import { SHAPES, SHAPE_SIZE, isShapeName, morphShows, shapeCells, type ShapeName } from './cursor-shapes';

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
  it('hands each cell from the blob to the shape exactly once', () => {
    for (const progress of [0, 0.3, 0.7, 1]) {
      for (let x = -5; x <= 5; x++) {
        expect(morphShows(x, 2, progress, true)).toBe(!morphShows(x, 2, progress, false));
      }
    }
    const all = (Object.keys(SHAPES) as ShapeName[]).flatMap(shapeCells);
    expect(all.every((c) => !morphShows(c.dx, c.dy, 0, true) && morphShows(c.dx, c.dy, 1, true))).toBe(true);
  });
});
