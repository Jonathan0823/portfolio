import { describe, expect, it } from 'vitest';
import { buildDelays, cellVisible, frameLevel, perimeterCells, travelDir } from './peek-frame';

describe('perimeterCells', () => {
  it('walks the ring clockwise once, with no repeats', () => {
    const cells = perimeterCells(5, 4);
    expect(cells).toHaveLength(2 * 5 + 2 * 4 - 4);
    expect(new Set(cells.map(([x, y]) => x + ',' + y)).size).toBe(cells.length);
    expect(cells[0]).toEqual([0, 0]);
    expect(cells[4]).toEqual([4, 0]);
    expect(cells[7]).toEqual([4, 3]);
    expect(cells.at(-1)).toEqual([0, 1]);
  });
  it('handles a single row', () => {
    expect(perimeterCells(3, 1)).toHaveLength(3);
    expect(perimeterCells(0, 3)).toEqual([]);
  });
});

describe('frameLevel', () => {
  const n = 60;
  const lit = (step: number) => Array.from({ length: n }, (_, i) => frameLevel(i, n, step));
  it('lights a few segments and leaves the rest ink', () => {
    const levels = lit(0);
    expect(levels.some((l) => l === 5)).toBe(true);
    expect(levels.filter((l) => l === 0).length).toBeGreaterThan(n / 2);
  });
  it('moves one cell a step, clockwise for a positive step', () => {
    const a = lit(0);
    const b = lit(1);
    for (let i = 0; i < n; i++) expect(b[(i + 1) % n]).toBe(a[i]);
  });
  it('moves the other way for a negative step', () => {
    const a = lit(0);
    const b = lit(-1);
    // the head leads at index -1 and the trail follows at higher indexes
    expect(a[0]).toBe(5);
    expect(b[n - 1]).toBe(5);
    expect(b[0]).toBeGreaterThan(0);
  });
});

describe('buildDelays', () => {
  it('starts near the side the card comes from', () => {
    const cols = 40,
      rows = 25;
    const cells = perimeterCells(cols, rows);
    const d = buildDelays(cols, rows, 'left');
    const avg = (pick: (c: [number, number]) => boolean) => {
      const xs = cells.map((c, i) => [c, d[i]] as const).filter(([c]) => pick(c));
      return xs.reduce((s, [, v]) => s + v, 0) / xs.length;
    };
    expect(avg(([x]) => x === 0)).toBeLessThan(avg(([x]) => x === cols - 1));
    expect(Math.max(...d)).toBeLessThanOrEqual(0.9);
  });
});

describe('cellVisible', () => {
  it('builds in as t passes the delay and scatters out in the same order', () => {
    expect(cellVisible('build', 0.2, 0.5)).toBe(false);
    expect(cellVisible('build', 0.6, 0.5)).toBe(true);
    expect(cellVisible('scatter', 0.2, 0.5)).toBe(true);
    expect(cellVisible('scatter', 0.6, 0.5)).toBe(false);
    expect(cellVisible('hidden', 0.5, 0)).toBe(false);
    expect(cellVisible('shown', 0, 1)).toBe(true);
  });
});

describe('travelDir', () => {
  it('flicks one way from above and the other from below', () => {
    expect(travelDir('top')).toBe(1);
    expect(travelDir('bottom')).toBe(-1);
  });
});
