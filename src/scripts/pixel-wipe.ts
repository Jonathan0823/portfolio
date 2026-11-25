// Pure maths for the pixel button wipe. No DOM access here.
import { hash } from './pixel-math';

export type Side = 'left' | 'right' | 'top' | 'bottom';

/** The edge of a w x h box nearest to the point (x, y), given relative to the box. */
export function entrySide(x: number, y: number, w: number, h: number): Side {
  const distances: [Side, number][] = [
    ['left', x],
    ['right', w - x],
    ['top', y],
    ['bottom', h - y],
  ];
  return distances.reduce((best, d) => (d[1] < best[1] ? d : best))[0];
}

/** Share of the timeline spent on staggering; the rest is each cell's own fade. */
export const SPREAD = 0.62;

/**
 * Per-cell start delay in 0..SPREAD, row-major. Cells next to the entry side start first,
 * with a deterministic jitter so the front is ragged rather than a clean line.
 */
export function cellDelays(columns: number, rows: number, side: Side): Float32Array {
  const delays = new Float32Array(columns * rows);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < columns; x++) {
      const u = columns > 1 ? x / (columns - 1) : 0;
      const v = rows > 1 ? y / (rows - 1) : 0;
      const along = side === 'left' ? u : side === 'right' ? 1 - u : side === 'top' ? v : 1 - v;
      const jitter = hash(x, y, 3) - 0.5;
      delays[y * columns + x] = Math.min(1, Math.max(0, along * 0.8 + jitter * 0.4 + 0.1)) * SPREAD;
    }
  }
  return delays;
}

/** Local progress 0..1 of one cell at global progress t. 0 = absent, 1 = settled. */
export function cellProgress(t: number, delay: number): number {
  return Math.min(1, Math.max(0, (t - delay) / (1 - SPREAD)));
}
