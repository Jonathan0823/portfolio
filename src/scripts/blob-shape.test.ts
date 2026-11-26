import { describe, expect, it } from 'vitest';
import { blobGeometry, blobValue, levelForValue, shortestTurn } from './blob-shape';

describe('blobGeometry', () => {
  it('is round at rest and elongates with stretch', () => {
    const rest = blobGeometry(7, 0);
    expect(rest.longRadius).toBe(rest.shortRadius);
    expect(rest.shift).toBe(0);
    const fast = blobGeometry(7, 1);
    expect(fast.longRadius).toBeGreaterThan(fast.shortRadius);
    expect(fast.shift).toBeGreaterThan(0);
  });
});

describe('blobValue', () => {
  it('is hottest at the core and null outside', () => {
    const g = blobGeometry(7, 0);
    expect(blobValue(0, 0, 0, g)).toBeCloseTo(1, 5);
    expect(blobValue(8, 0, 0, g)).toBeNull();
    expect(blobValue(3, 0, 0, g)!).toBeLessThan(blobValue(1, 0, 0, g)!);
  });

  it('puts the hot core toward the heading', () => {
    const g = blobGeometry(7, 1);
    const ahead = blobValue(g.longRadius * 0.8, 0, 0, g)!;
    const behind = blobValue(-g.longRadius * 0.8, 0, 0, g)!;
    expect(ahead).toBeGreaterThan(behind);
    expect(blobValue(-g.longRadius * 0.8, 0, Math.PI, g)!).toBeCloseTo(ahead, 5);
  });
});

describe('levelForValue', () => {
  it('maps the rim to the darkest level and the core to the hottest', () => {
    expect(levelForValue(0.02, 0)).toBe(0);
    expect(levelForValue(0.99, 0)).toBe(5);
    let last = -1;
    for (let v = 0; v <= 1; v += 0.05) {
      const level = levelForValue(v, 0);
      expect(level).toBeGreaterThanOrEqual(last);
      last = level;
    }
  });
  it('flicker never leaves 0..5', () => {
    for (const j of [-1, 1])
      for (let v = 0; v <= 1; v += 0.1) {
        const l = levelForValue(v, j);
        expect(l).toBeGreaterThanOrEqual(0);
        expect(l).toBeLessThanOrEqual(5);
      }
  });
});

describe('shortestTurn', () => {
  it('takes the short way round a full circle', () => {
    expect(shortestTurn(0, Math.PI * 1.5)).toBeCloseTo(-Math.PI / 2, 10);
    expect(shortestTurn(3, -3)).toBeCloseTo(2 * Math.PI - 6, 10);
    expect(shortestTurn(0, Math.PI / 2)).toBeCloseTo(Math.PI / 2, 10);
  });
});
