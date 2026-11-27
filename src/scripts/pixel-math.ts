export { HEAT_PALETTE } from '@/lib/palette';

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
  /** rows inside the host box; rows past it are bleed, where only heat and embers show */
  hostRows: number;
  horizonRow: number;
  heat: Float32Array;
  bucket: Int8Array;
  lowestRow: Int16Array;
  lowestBucket: Int8Array;
  hottest: number;
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
  };
}

/** How a field's outline is cut. Every part is optional; {} is the plain field. */
export interface FieldShape {
  /** share of the horizon kept, 0..1; lower drains the field toward row 0 */
  coverage?: number;
  /** how far the horizon wanders per column, as a share of the host rows */
  skyline?: number;
  /** share of the host rows next to row 0 that dither out into paper */
  fadeEdge?: number;
  /** footer tide: extra rows per column added on top of the horizon; the raised body fills solid */
  swell?: Float32Array;
  /** footer tide: heat per column for the few rows just under the swollen surface; drawn, never stored */
  crest?: Float32Array;
  /** footer tide: heat per cell drawn only above the surface (what the water has uncovered); never stored */
  stamp?: Float32Array;
  /** footer tide: highest row a raised surface may reach; the wandering skyline plus a swell can't lift it past this */
  cap?: number;
  /** no gaps in the body under the surface; only the loose top and the dithered bottom edge stay ragged */
  solid?: boolean;
  /** footer wordmark mould, per cell: 1 = letter (forced present, one step hotter), 10+n = letter at heat level n, 2 = foundation (forced present), -1 = carved out, 0 = the field's own */
  mold?: Int8Array;
}

/** the warm band that wanders through a field's body, 0..1, at `depth` (rows over the horizon row) and `across` 0..1 */
export function ridgeAt(across: number, depth: number, time: number, seed: number): number {
  const line = 0.42 + 0.2 * Math.sin(across * 6.2 + time * 0.6 + seed) + 0.08 * Math.sin(across * 17 - time);
  return Math.exp(-Math.pow(depth - line, 2) / 0.018);
}

/** a cell's palette level: its own terrain value, lifted to its held heat once that is hot enough to show */
export const cellLevel = (value: number, heat: number, grain: number): number =>
  bucketFor(heat >= 0.3 ? Math.max(value, 0.1 + heat + grain * 0.1) : value);

export function stepField(
  field: Field,
  time: number,
  seed: number,
  density = 1,
  decay = 0.94,
  shape: FieldShape = {},
): void {
  const { columns, rows, hostRows, heat, bucket, lowestRow, lowestBucket } = field;
  const coverage = Math.max(0, Math.min(1, shape.coverage ?? 1));
  const fadeRows = hostRows * (shape.fadeEdge ?? 0);
  const stamp = shape.stamp?.length === columns * rows ? shape.stamp : null;
  const mold = shape.mold?.length === columns * rows ? shape.mold : null;
  bucket.fill(-1);
  lowestRow.fill(-1);
  lowestBucket.fill(0);
  let hottest = 0;
  for (let x = 0; x < columns; x++) {
    const across = x / columns;
    const sky = shape.skyline ? (noise(x * 0.06, seed * 3 + time * 0.08) - 0.5) * hostRows * shape.skyline * 2 : 0;
    const swell = shape.swell?.[x] ?? 0;
    // a raised wave takes its own shape: the skyline's wander settles out of it, so it doesn't push the crest past the cap
    const settled = shape.cap ? Math.max(0, Math.min(1, swell / 8)) : 0;
    const surface = (field.horizonRow + sky * (1 - settled)) * coverage;
    // a swell lifts the wandering skyline, which could carry it above where the tide is meant to stop
    const horizonRow =
      swell > 0 && shape.cap
        ? Math.min(surface + swell, shape.cap + Math.max(0, surface - shape.cap) * Math.max(0, 1 - swell / 3))
        : surface + swell;
    const crest = shape.crest?.[x] ?? 0;
    // the loose, flame-like top settles onto a raised surface, and never reaches past the cap
    const calm = swell > 0 && shape.cap ? Math.max(0, 1 - swell / 4) : 1;
    const drip = Math.floor(
      (Math.max(0, noise(x * 0.17, 3.1 + seed + time * 0.15) - 0.35) * 16 * density + hash(x, 7) * 2) * calm,
    );
    for (let y = 0; y < rows; y++) {
      const i = y * columns + x;
      heat[i] *= decay;
      hottest = Math.max(hottest, heat[i]);
      // overlays are recomputed by their owner every frame, so nothing they draw outlives them
      let h = heat[i];
      const m = mold ? mold[i] : 0;
      if (m < 0) continue;
      const forced = m > 0;
      if (crest > 0 && y < horizonRow && y >= horizonRow - 3) h = Math.max(h, crest);
      // a negative stamp is the clearing around a logo: kept empty above the water so the logo stands apart
      if (swell > 0 && shape.cap && y > shape.cap && !(stamp && stamp[i] > 0)) continue;
      const stamped = stamp && y >= horizonRow ? stamp[i] : 0;
      if (stamped < 0) continue;
      h = Math.max(h, stamped);
      // everything under a raised surface is solid water, without the field's gaps, from the first rows it lifts. The
      // dithered bottom edge stays, as it does across the rest of the footer
      const water = (shape.solid || swell > 0.05) && y < horizonRow;
      if (h < 0.3 && !forced) {
        if (y >= horizonRow + drip * (0.4 + 0.6 * coverage)) continue;
        if (y < fadeRows) {
          const t = y / fadeRows;
          if (hash(x, y, seed + 11) > t * t * (3 - 2 * t)) continue;
        }
        if (y >= horizonRow && hash(x, y, Math.floor(time * 2) + seed) < ((y - horizonRow) / (drip + 1)) * 0.55)
          continue;
      }
      const depth = y / field.horizonRow;
      const base = fbm(x * 0.07 - time * 0.9 + seed, y * 0.11 + x * 0.03);
      const ridge = ridgeAt(across, depth, time, seed);
      const grain = hash(x, y) - 0.5;
      const value = 0.1 + 0.5 * base + 0.42 * ridge * density + 0.18 * density + (h < 0.3 ? h : 0) + grain * 0.2;
      if (base + grain * 0.25 < 0.36 + (1 - density) * 0.38 && ridge * density < 0.35 && h < 0.25 && !water && !forced)
        continue;
      const level = cellLevel(value, h, grain);
      const lifted = m === 1 ? Math.min(4, level + 1) : m >= 10 ? m - 10 : level;
      bucket[i] = lifted;
      if (y > lowestRow[x]) {
        lowestRow[x] = y;
        lowestBucket[x] = lifted;
      }
    }
  }
  field.hottest = hottest;
}
