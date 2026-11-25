// Pure maths for the pixel canvases. No DOM access here.

export { HEAT_PALETTE } from '../lib/palette';

export function hash(a: number, b: number, c = 0): number {
  const h = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453;
  return h - Math.floor(h);
}

export function noise(x: number, y: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), u0 = x - xi, v0 = y - yi;
  const u = u0 * u0 * (3 - 2 * u0), v = v0 * v0 * (3 - 2 * v0);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export function fbm(x: number, y: number): number {
  return 0.6 * noise(x, y) + 0.3 * noise(x * 2.1 + 5, y * 2.1) + 0.1 * noise(x * 4.3, y * 4.3 + 9);
}

/** Palette bucket for a heat value. */
export function bucketFor(v: number): number {
  return v < 0.46 ? 0 : v < 0.6 ? 1 : v < 0.7 ? 2 : v < 0.82 ? 3 : v < 0.94 ? 4 : 5;
}

/** Palette level for a cell under the cursor blob. */
export function heatLevel(gx: number, gy: number, d: number, k: number, ft: number, W: number): number {
  const n = fbm(gx * 0.07 - ft * 0.9, gy * 0.11 + gx * 0.03), g = hash(gx, gy) - 0.5;
  const val = 0.18 + 0.45 * n + 0.5 * (1 - Math.min(1, d)) + 0.18 * k + g * 0.18;
  return Math.min(bucketFor(val), Math.floor(W * 5.99));
}

export interface Field {
  w: number;
  h: number;
  /** cell size in CSS px */
  cs: number;
  /** columns, rows, horizon row */
  C: number;
  R: number;
  M: number;
  heat: Float32Array;
  /** palette bucket per cell, -1 when the cell is empty */
  bucket: Int8Array;
  /** lowest painted row per column (-1 if none) and its bucket */
  low: Int16Array;
  lowK: Int8Array;
  hot: number;
}

export function createField(w: number, h: number): Field {
  const cs = w < 700 ? 10 : 14;
  const C = Math.ceil(w / cs), R = Math.ceil(h / cs);
  return {
    w, h, cs, C, R, M: Math.floor(R * 0.68),
    heat: new Float32Array(C * R),
    bucket: new Int8Array(C * R).fill(-1),
    low: new Int16Array(C).fill(-1),
    lowK: new Int8Array(C),
    hot: 0,
  };
}

/** Advance heat decay and recompute which cells are painted, and in which bucket. */
export function stepField(f: Field, t: number, seed: number, dens = 1): void {
  const { C, R, M, heat, bucket, low, lowK } = f;
  bucket.fill(-1);
  low.fill(-1);
  lowK.fill(0);
  let hot = 0;
  for (let x = 0; x < C; x++) {
    const u = x / C, a = dens;
    const drip = Math.floor(Math.max(0, noise(x * 0.17, 3.1 + seed + t * 0.15) - 0.35) * 16 * a + hash(x, 7) * 2);
    for (let y = 0; y < R; y++) {
      const i = y * C + x;
      heat[i] *= 0.94;
      hot = Math.max(hot, heat[i]);
      if (heat[i] < 0.3) {
        if (y >= M + drip) continue;
        if (y >= M && hash(x, y, Math.floor(t * 2) + seed) < ((y - M) / (drip + 1)) * 0.55) continue;
      }
      const w = y / M, n = fbm(x * 0.07 - t * 0.9 + seed, y * 0.11 + x * 0.03);
      const line = 0.42 + 0.2 * Math.sin(u * 6.2 + t * 0.6 + seed) + 0.08 * Math.sin(u * 17 - t);
      const ridge = Math.exp(-Math.pow(w - line, 2) / 0.018), g = hash(x, y) - 0.5;
      const v = 0.1 + 0.5 * n + 0.42 * ridge * a + 0.18 * a + heat[i] + g * 0.2;
      if (n + g * 0.25 < 0.36 + (1 - a) * 0.38 && ridge * a < 0.35 && heat[i] < 0.25) continue;
      const k = bucketFor(v);
      bucket[i] = k;
      if (y > low[x]) { low[x] = y; lowK[x] = k; }
    }
  }
  f.hot = hot;
}
