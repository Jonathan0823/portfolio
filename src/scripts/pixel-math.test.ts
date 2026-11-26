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
  it('uses 10px cells on wide canvases and 8px cells below 700px', () => {
    const wide = createField(1440, 336);
    expect([wide.cellSize, wide.columns, wide.rows, wide.horizonRow]).toEqual([10, 144, 34, 23]);
    const narrow = createField(390, 300);
    expect([narrow.cellSize, narrow.columns, narrow.rows, narrow.horizonRow]).toEqual([8, 49, 38, 25]);
  });

  it('adds bleed rows past the host without moving the horizon', () => {
    const f = createField(1440, 336, 200);
    expect([f.hostRows, f.rows, f.horizonRow]).toEqual([34, 54, 23]);
  });
});

describe('stepField', () => {
  it('is deterministic for the same time and seed', () => {
    const a = createField(700, 336),
      b = createField(700, 336);
    stepField(a, 0.5, 1.3);
    stepField(b, 0.5, 1.3);
    expect(Array.from(a.bucket)).toEqual(Array.from(b.bucket));
  });

  it('only emits palette buckets and records the lowest cell per column', () => {
    const f = createField(1440, 336);
    stepField(f, 0, 1.3);
    for (let x = 0; x < f.columns; x++) {
      let low = -1;
      for (let y = 0; y < f.rows; y++) {
        const k = f.bucket[y * f.columns + x];
        expect(k).toBeGreaterThanOrEqual(-1);
        expect(k).toBeLessThan(HEAT_PALETTE.length);
        if (k >= 0) low = y;
      }
      expect(f.lowestRow[x]).toBe(low);
      if (low >= 0) expect(f.lowestBucket[x]).toBe(f.bucket[low * f.columns + x]);
    }
    expect(f.bucket.some((k) => k >= 0)).toBe(true);
  });

  const lit = (f: ReturnType<typeof createField>, from: number, to: number) => {
    let n = 0;
    for (let y = from; y < to; y++) for (let x = 0; x < f.columns; x++) if (f.bucket[y * f.columns + x] >= 0) n++;
    return n;
  };

  it('drains toward row 0 as coverage drops', () => {
    const full = createField(1440, 336),
      half = createField(1440, 336);
    stepField(full, 0, 1.3);
    stepField(half, 0, 1.3, 1, 0.94, { coverage: 0.5 });
    expect(Math.max(...half.lowestRow)).toBeLessThan(Math.max(...full.lowestRow));
    expect(lit(half, 0, half.rows)).toBeLessThan(lit(full, 0, full.rows));
  });

  it('dithers the rows next to row 0 with fadeEdge', () => {
    const plain = createField(1440, 336),
      faded = createField(1440, 336);
    stepField(plain, 0, 1.3);
    stepField(faded, 0, 1.3, 1, 0.94, { fadeEdge: 0.35 });
    expect(lit(faded, 0, 4)).toBeLessThan(lit(plain, 0, 4) * 0.5);
    expect(lit(faded, 20, 23)).toBe(lit(plain, 20, 23));
  });

  it('makes the horizon wander per column with skyline', () => {
    const f = createField(1440, 336);
    stepField(f, 0, 1.3, 1, 0.94, { skyline: 0.22, coverage: 1 });
    const flat = createField(1440, 336);
    stepField(flat, 0, 1.3);
    const spread = (r: Int16Array) => Math.max(...r) - Math.min(...Array.from(r).filter((v) => v >= 0));
    expect(spread(f.lowestRow)).toBeGreaterThan(spread(flat.lowestRow));
  });

  it('never lights bleed rows on its own', () => {
    const f = createField(1440, 336, 200);
    stepField(f, 0, 1.3, 1, 0.94, { skyline: 0.22 });
    expect(lit(f, f.hostRows + 4, f.rows)).toBe(0);
  });

  it('decays heat by 0.94 per step and paints hot cells in the top bucket', () => {
    const f = createField(700, 336);
    const i = 5 * f.columns + 10;
    f.heat[i] = 1;
    stepField(f, 0, 1.3);
    expect(f.heat[i]).toBeCloseTo(0.94, 5);
    expect(f.bucket[i]).toBe(5);
    expect(f.hottest).toBeCloseTo(0.94, 5);
  });
});
