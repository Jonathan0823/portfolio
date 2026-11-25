import { describe, expect, it } from 'vitest';
import { cellDelays, cellProgress, entrySide, SPREAD } from './pixel-wipe';

describe('entrySide', () => {
  it('picks the nearest edge', () => {
    expect(entrySide(2, 20, 100, 40)).toBe('left');
    expect(entrySide(98, 20, 100, 40)).toBe('right');
    expect(entrySide(50, 1, 100, 40)).toBe('top');
    expect(entrySide(50, 39, 100, 40)).toBe('bottom');
  });
});

describe('cellDelays', () => {
  const avg = (d: Float32Array, cols: number, col: number, rows: number) => {
    let s = 0;
    for (let y = 0; y < rows; y++) s += d[y * cols + col];
    return s / rows;
  };
  it('starts cells on the entry side first', () => {
    const left = cellDelays(20, 6, 'left');
    expect(avg(left, 20, 0, 6)).toBeLessThan(avg(left, 20, 19, 6));
    const right = cellDelays(20, 6, 'right');
    expect(avg(right, 20, 19, 6)).toBeLessThan(avg(right, 20, 0, 6));
  });
  it('is deterministic and bounded', () => {
    const a = cellDelays(12, 5, 'top'), b = cellDelays(12, 5, 'top');
    expect(Array.from(a)).toEqual(Array.from(b));
    for (const d of a) { expect(d).toBeGreaterThanOrEqual(0); expect(d).toBeLessThanOrEqual(SPREAD + 1e-6); }
  });
});

describe('cellProgress', () => {
  it('is absent before the delay and settled by the end', () => {
    expect(cellProgress(0.1, 0.3)).toBe(0);
    expect(cellProgress(1, SPREAD)).toBe(1);
    expect(cellProgress(1, 0)).toBe(1);
  });
});

describe('radialDelays', () => {
  it('starts cells near the origin first', async () => {
    const { radialDelays } = await import('./pixel-wipe');
    const d = radialDelays(20, 10, 0, 0);
    expect(d[0]).toBeLessThan(d[9 * 20 + 19]);
    expect(Math.max(...d)).toBeLessThanOrEqual(SPREAD);
  });
});

describe('coverLevel', () => {
  it('lands hot and settles on the darkest level', async () => {
    const { coverLevel } = await import('./pixel-wipe');
    expect(coverLevel(0)).toBe(5);
    expect(coverLevel(1)).toBe(0);
  });
});
