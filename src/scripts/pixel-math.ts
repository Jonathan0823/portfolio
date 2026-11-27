export { HEAT_PALETTE } from '@/lib/palette';
import { drawRunoff, drips, sag } from './field-runoff';
import { bubbles, dome, drawBoil } from './field-boil';

export function hash(a: number, b: number, c = 0): number {
  const h = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453;
  return h - Math.floor(h);
}

export function noise(x: number, y: number): number {
  const cellX = Math.floor(x),
    cellY = Math.floor(y);
  const fracX = x - cellX,
    fracY = y - cellY;
  const smoothX = fracX * fracX * (3 - 2 * fracX),
    smoothY = fracY * fracY * (3 - 2 * fracY);
  const topLeft = hash(cellX, cellY),
    topRight = hash(cellX + 1, cellY);
  const bottomLeft = hash(cellX, cellY + 1),
    bottomRight = hash(cellX + 1, cellY + 1);
  return (
    topLeft +
    (topRight - topLeft) * smoothX +
    (bottomLeft - topLeft) * smoothY +
    (topLeft - topRight - bottomLeft + bottomRight) * smoothX * smoothY
  );
}

export function fbm(x: number, y: number): number {
  return 0.6 * noise(x, y) + 0.3 * noise(x * 2.1 + 5, y * 2.1) + 0.1 * noise(x * 4.3, y * 4.3 + 9);
}

export function bucketFor(value: number): number {
  return value < 0.46 ? 0 : value < 0.6 ? 1 : value < 0.7 ? 2 : value < 0.82 ? 3 : value < 0.94 ? 4 : 5;
}

export function heatLevel(
  cellX: number,
  cellY: number,
  distance: number,
  speedFactor: number,
  fieldTime: number,
  warmth: number,
): number {
  const base = fbm(cellX * 0.07 - fieldTime * 0.9, cellY * 0.11 + cellX * 0.03);
  const grain = hash(cellX, cellY) - 0.5;
  const value = 0.18 + 0.45 * base + 0.5 * (1 - Math.min(1, distance)) + 0.18 * speedFactor + grain * 0.18;
  return Math.min(bucketFor(value), Math.floor(warmth * 5.99));
}

export interface Field {
  width: number;
  height: number;
  cellSize: number;
  columns: number;
  rows: number;
  /** rows inside the host box; rows past it are bleed, where only heat shows */
  hostRows: number;
  horizonRow: number;
  heat: Float32Array;
  bucket: Int8Array;
  lowestRow: Int16Array;
  lowestBucket: Int8Array;
  hottest: number;
  /** each cell's opacity, 1 except along soft edges */
  alpha: Float32Array;
  /** rows the field's surface stands at, per column, as of the last step */
  surface: Float32Array;
}

/** A field for a host of `width` × `height` px, with `bleed` px of extra rows past the host. */
export function createField(width: number, height: number, bleed = 0): Field {
  const cellSize = width < 700 ? 8 : 10;
  const columns = Math.ceil(width / cellSize),
    hostRows = Math.ceil(height / cellSize),
    rows = Math.ceil((height + bleed) / cellSize);
  return {
    width,
    height,
    cellSize,
    columns,
    rows,
    hostRows,
    horizonRow: Math.floor(hostRows * 0.68),
    heat: new Float32Array(columns * rows),
    bucket: new Int8Array(columns * rows).fill(-1),
    lowestRow: new Int16Array(columns).fill(-1),
    lowestBucket: new Int8Array(columns),
    hottest: 0,
    alpha: new Float32Array(columns * rows).fill(1),
    surface: new Float32Array(columns),
  };
}

/** How a field's outline is cut. Every part is optional; {} is the plain field. */
export interface FieldShape {
  /** share of the horizon kept, 0..1; lower drains the field toward row 0 */
  coverage?: number;
  /** drops swell under the surface and fall from it */
  runoff?: boolean;
  /** a low rolling surface instead of the broad waves */
  low?: boolean;
  /** bubbles swell on the surface and pop, and hot spots rise through the body */
  boil?: boolean;
  /** rows next to row 0 that fade out into paper */
  fadeRows?: number;
  /** footer tide: extra rows per column added on top of the horizon */
  swell?: Float32Array;
  /** footer tide: heat per cell drawn only above the surface (what the water has uncovered); never stored */
  stamp?: Float32Array;
  /** footer tide: highest row a raised surface may reach */
  cap?: number;
  /** footer wordmark mould, per cell: 1 = letter, 10+n = letter at heat level n, 2 = foundation (forced present), -1 = carved out, 0 = the field's own */
  mold?: Int8Array;
}

/** pointer and click heat: stays warm as it cools, never the dark end of the palette */
export const heatTone = (h: number) => (h >= 0.75 ? 5 : h >= 0.52 ? 4 : 3);
/** and past the field's body, where there is nothing under it, it fades out as it cools */
export const heatFade = (h: number) => Math.max(0.15, Math.min(1, (h - 0.28) / 0.3));

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
/** the ordered blending pattern, 0..1 */
const bayer = (x: number, y: number) => (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;

/** the resting colour of a body cell: by depth toward the surface, one layer blending into the next */
export function strataLevel(x: number, y: number, edge: number): number {
  const depth = y / Math.max(1, edge) + (bayer(x, y) - 0.5) * 0.13;
  return depth < 0.36 ? 1 : depth < 0.6 ? 2 : depth < 0.76 ? 3 : depth < 0.89 ? 4 : 5;
}

/** the surface's own waves, in rows over or under the horizon */
function wander(x: number, time: number, seed: number, hostRows: number, low: boolean): number {
  return low
    ? hostRows * (0.04 * Math.sin(x * 0.07 + time * 1.1) + 0.025 * Math.sin(x * 0.17 - time * 1.7))
    : hostRows * (0.09 * Math.sin(x * 0.045 + time * 0.5 + seed) + 0.05 * Math.sin(x * 0.11 - time * 0.35));
}

export function stepField(field: Field, time: number, seed: number, decay = 0.94, shape: FieldShape = {}): void {
  const { columns, rows, hostRows, horizonRow, heat, bucket, lowestRow, lowestBucket, alpha, surface } = field;
  const coverage = Math.max(0, Math.min(1, shape.coverage ?? 1));
  const fadeRows = shape.fadeRows ?? 0;
  const stamp = shape.stamp?.length === columns * rows ? shape.stamp : null;
  const mold = shape.mold?.length === columns * rows ? shape.mold : null;
  bucket.fill(-1);
  lowestRow.fill(-1);
  lowestBucket.fill(0);
  alpha.fill(1);
  const runoff = shape.runoff ? drips(columns, time, seed) : null;
  const boil = shape.boil && time > 0 ? bubbles(columns, time, seed) : null;

  for (let x = 0; x < columns; x++) {
    const swell = shape.swell?.[x] ?? 0;
    // a raised wave takes its own shape: the surface's own waves settle out of it, so they don't push it past the cap
    const settled = shape.cap ? Math.max(0, Math.min(1, swell / 8)) : 0;
    const waves = wander(x, time, seed, hostRows, !!shape.low);
    // a dripping surface sits a little higher, leaving the drops room to fall
    const outline = runoff ? waves * 0.8 - horizonRow * 0.12 + sag(runoff, x) : waves + (boil ? dome(boil, x) : 0);
    const top = (horizonRow + outline * (1 - settled)) * coverage + swell;
    surface[x] = swell > 0 && shape.cap ? Math.min(top, shape.cap) : top;
  }

  let hottest = 0;
  for (let x = 0; x < columns; x++) {
    const edge = surface[x];
    const raised = !!shape.cap && (shape.swell?.[x] ?? 0) > 0;
    for (let y = 0; y < rows; y++) {
      const i = y * columns + x;
      heat[i] *= decay;
      hottest = Math.max(hottest, heat[i]);
      const m = mold ? mold[i] : 0;
      if (m < 0) continue;
      // overlays are recomputed by their owner every frame, so nothing they draw outlives them
      const stamped = stamp && y >= edge ? stamp[i] : 0;
      if (raised && y > shape.cap! && !(stamped > 0)) continue;
      // a negative stamp is the clearing around a logo: kept empty above the water so the logo stands apart
      if (stamped < 0) continue;
      const touched = heat[i];
      const body = y < edge;
      const shown = touched >= 0.3 || stamped >= 0.3 || m > 0;
      if (!body && !shown) continue;

      let level = body ? strataLevel(x, y, edge) : 0;
      if (stamped >= 0.3) level = Math.max(level, bucketFor(0.1 + stamped));
      if (touched >= 0.3) {
        level = body || stamped >= 0.3 ? Math.max(level, heatTone(touched)) : heatTone(touched);
        if (!body && !(stamped >= 0.3)) alpha[i] = heatFade(touched);
      }
      // the footer letters are one flat dark colour; 10+n is a letter popping in
      if (m === 1) level = 0;
      else if (m >= 10) level = m - 10;
      else if (m === 2 && !body) level = 1;

      if (!shown) {
        // the soft edge: the surface's last rows, and the rows next to row 0
        if (!raised) alpha[i] = Math.min(1, 0.35 + (edge - y) * 0.28);
        if (y < fadeRows) alpha[i] = Math.min(alpha[i], 0.3 + (0.7 * y) / fadeRows);
      }
      bucket[i] = level;
      if (y > lowestRow[x]) {
        lowestRow[x] = y;
        lowestBucket[x] = level;
      }
    }
  }
  // reduced motion holds time at 0, where a drop would hang frozen in mid-air
  if (runoff && time > 0) drawRunoff(field, runoff, coverage);
  if (boil) drawBoil(field, boil, time, shape);
  field.hottest = hottest;
}
