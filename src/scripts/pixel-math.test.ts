import { describe, expect, it } from 'vitest';
import { HEAT_PALETTE, createField, fbm, hash, noise, stepField } from './pixel-math';

describe('noise helpers', () => {
  it('hash is deterministic, in [0,1) and zero at the origin', () => {
    expect(hash(0, 0, 0)).toBe(0);
    for (let i = 0; i < 200; i++) {
      const h = hash(i, i * 3 + 1, i % 7);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(1);
      expect(hash(i, i * 3 + 1, i % 7)).toBe(h);
    }
  });

  it('noise equals the lattice hash at integer points and fbm stays in [0,1]', () => {
    expect(noise(3, 5)).toBeCloseTo(hash(3, 5), 10);
    for (let i = 0; i < 200; i++) {
      const v = fbm(i * 0.37, i * 0.91);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});

describe('createField', () => {
  it('uses 14px cells on wide canvases and 10px cells below 700px', () => {
    const wide = createField(1440, 336);
    expect([wide.cs, wide.C, wide.R, wide.M]).toEqual([14, 103, 24, 16]);
    const narrow = createField(390, 300);
    expect([narrow.cs, narrow.C, narrow.R, narrow.M]).toEqual([10, 39, 30, 20]);
  });
});

describe('stepField', () => {
  it('is deterministic for the same time and seed', () => {
    const a = createField(700, 336), b = createField(700, 336);
    stepField(a, 0.5, 1.3);
    stepField(b, 0.5, 1.3);
    expect(Array.from(a.bucket)).toEqual(Array.from(b.bucket));
  });

  it('only emits palette buckets and records the lowest cell per column', () => {
    const f = createField(1440, 336);
    stepField(f, 0, 1.3);
    for (let x = 0; x < f.C; x++) {
      let low = -1;
      for (let y = 0; y < f.R; y++) {
        const k = f.bucket[y * f.C + x];
        expect(k).toBeGreaterThanOrEqual(-1);
        expect(k).toBeLessThan(HEAT_PALETTE.length);
        if (k >= 0) low = y;
      }
      expect(f.low[x]).toBe(low);
      if (low >= 0) expect(f.lowK[x]).toBe(f.bucket[low * f.C + x]);
    }
    expect(f.bucket.some(k => k >= 0)).toBe(true);
  });

  it('decays heat by 0.94 per step and paints hot cells in the top bucket', () => {
    const f = createField(700, 336);
    const i = 5 * f.C + 10;
    f.heat[i] = 1;
    stepField(f, 0, 1.3);
    expect(f.heat[i]).toBeCloseTo(0.94, 5);
    expect(f.bucket[i]).toBe(5);
    expect(f.hot).toBeCloseTo(0.94, 5);
  });
});
