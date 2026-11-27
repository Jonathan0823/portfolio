// Boil: the footer field's own motion. Rounded bubbles swell on its surface, pop and throw droplets, and small hot
// spots rise through the body. Bubbles take turns and move a few columns each time. Worked out from the field's time.
import { hash, type Field, type FieldShape } from './pixel-math';

/** columns between bubbles, and field time per cycle (about 4 s) */
const SPACING = 13;
const CYCLE = 1.6;
/** the share of a cycle a bubble swells for before it pops */
const SWELL = 0.62;
/** columns per hot spot, and field time one takes to rise */
const SPOT_SPACING = 9;
const SPOT_RISE = 1.3;
const SPARKS = 4;

export interface Bubble {
  column: number;
  phase: number;
  /** half its width, in columns, and its height in rows */
  half: number;
  tall: number;
}

export function bubbles(columns: number, time: number, seed: number): Bubble[] {
  return Array.from({ length: Math.ceil(columns / SPACING) }, (_, i) => {
    const turn = time / CYCLE + i * 0.618;
    const n = Math.floor(turn);
    return {
      column: Math.round((i + 0.5) * SPACING + (hash(i, n, seed) - 0.5) * 10),
      phase: turn - n,
      half: 3 + Math.round(hash(i, n, 7) * 3),
      tall: 3.5 + hash(i, n, 9) * 3,
    };
  });
}

/** rows the bubbles add to the surface at column x: swelling up, then collapsing fast */
export function dome(list: Bubble[], x: number): number {
  let most = 0;
  for (const { column, phase, half, tall } of list) {
    const dx = (x - column) / half;
    if (Math.abs(dx) >= 1) continue;
    const size = phase < SWELL ? (phase / SWELL) ** 1.4 : Math.max(0, 1 - (phase - SWELL) / 0.1);
    most = Math.max(most, tall * size * Math.sqrt(1 - dx * dx));
  }
  return most;
}

/** droplets thrown by popped bubbles, and hot spots rising through the body, drawn over the stepped field */
export function drawBoil(field: Field, list: Bubble[], time: number, shape: FieldShape): void {
  const { columns, rows, bucket, alpha, surface } = field;
  const stamp = shape.stamp?.length === columns * rows ? shape.stamp : null;
  const mold = shape.mold?.length === columns * rows ? shape.mold : null;
  /** the cell's index, unless a letter, a logo or its clearing owns it */
  const free = (x: number, y: number) => {
    if (x < 0 || x >= columns || y < 0 || y >= rows) return -1;
    const i = y * columns + x;
    return mold?.[i] || stamp?.[i] ? -1 : i;
  };
  for (const { column, phase, tall } of list) {
    const q = (phase - SWELL) / (1 - SWELL);
    // the raised tide has its own surface: nothing pops out of it
    if (q <= 0 || (shape.swell?.[column] ?? 0) > 0.05) continue;
    const top = (surface[column] ?? 0) + tall - dome(list, column);
    const level = q < 0.4 ? 5 : q < 0.7 ? 4 : 3;
    // each droplet gets its own throw, so no two pops look alike
    for (let k = 0; k < SPARKS; k++) {
      const side = hash(column, k, 11) - 0.5,
        lift = 7 + hash(column, k, 13) * 9;
      const x = column + Math.round(side * (3 + q * 11));
      const y = Math.round(top + lift * (q * 1.1 - q * q * 0.85));
      // the first two are fat droplets, the rest single cells
      const wide = k < 2 && q < 0.55 ? 2 : 1;
      for (let dx = 0; dx < wide; dx++)
        for (let dy = 0; dy < wide; dy++) {
          const i = free(x + dx, y + dy);
          if (i < 0 || y + dy < (surface[x + dx] ?? 0)) continue;
          bucket[i] = level;
          alpha[i] = q < 0.65 ? 1 : Math.max(0.15, 1 - (q - 0.65) / 0.4);
        }
    }
  }
  for (let n = 0; n < columns / SPOT_SPACING; n++) {
    const turn = time / SPOT_RISE + hash(n, 3);
    const x = Math.floor(hash(n, Math.floor(turn), 4) * (columns - 1));
    const y = Math.floor((turn % 1) * ((surface[x] ?? 0) - 1));
    for (let dx = 0; dx < 2; dx++)
      for (let dy = 0; dy < 2; dy++) {
        const i = free(x + dx, y + dy);
        if (i >= 0 && bucket[i] >= 0 && y + dy < (surface[x + dx] ?? 0) - 1) bucket[i] = Math.min(5, bucket[i] + 1);
      }
  }
}
