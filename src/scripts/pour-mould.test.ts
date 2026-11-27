import { describe, expect, it } from 'vitest';
import { CRAWL_MS, DROPS, SETTLE_MS, fillLevels, landingCell, msToBeat, shapeOf, spotAbove } from './pour-mould';

const square = shapeOf(['###', '###', '###']);

describe('shapeOf', () => {
  it('outlines only the edge cells', () => {
    expect(square.outline).toHaveLength(8);
    expect(square.outline).not.toContainEqual([1, 1]);
  });

  it('pours every cell, from the bottom row up', () => {
    expect(square.pour).toHaveLength(9);
    expect(square.pour.map(([, r]) => r)).toEqual([2, 2, 2, 1, 1, 1, 0, 0, 0]);
  });
});

describe('fillLevels', () => {
  const limit = 9;

  it('is empty before the first drop', () => {
    expect(fillLevels({ limit, landed: 0, age: 10_000 })).toEqual([]);
  });

  it('spreads the newest share in white-hot and cools it to red', () => {
    expect(fillLevels({ limit, landed: 1, age: SETTLE_MS / 4 })).toEqual([5, 5]);
    expect(fillLevels({ limit, landed: 2, age: SETTLE_MS / 2 })).toEqual([3, 3, 3, 4, 4, 4]);
    expect(fillLevels({ limit, landed: 2, age: SETTLE_MS })).toEqual([3, 3, 3, 3, 3, 3]);
  });

  it('stops at the limit after the last drop', () => {
    expect(fillLevels({ limit: 8, landed: DROPS, age: SETTLE_MS })).toHaveLength(8);
  });
});

describe('landingCell', () => {
  it('aims into the share the drop will fill, never past the limit', () => {
    expect(landingCell(square, 9, 0)).toEqual(square.pour[1]);
    expect(landingCell(square, 3, 2)).toEqual(square.pour[2]);
  });
});

describe('msToBeat', () => {
  it('counts down to the next beat', () => {
    expect(msToBeat(0, CRAWL_MS)).toBe(CRAWL_MS);
    expect(msToBeat(CRAWL_MS + 100, CRAWL_MS)).toBe(CRAWL_MS - 100);
  });
});

describe('spotAbove', () => {
  const lowestRow = Int16Array.from([20, -1, -1, 2, 5]);
  const field = { columns: 5, cellSize: 10, lowestRow };

  it('takes the nearest column with lava that leaves room to fall', () => {
    expect(spotAbove(field, 3, 400)).toEqual({ column: 4, row: 5 });
    expect(spotAbove(field, 0, 400)).toEqual({ column: 0, row: 20 });
  });

  it('gives up when no column has both', () => {
    expect(spotAbove(field, 2, 100)).toBeNull();
  });
});
