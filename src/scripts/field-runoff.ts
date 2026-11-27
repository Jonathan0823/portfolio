// Runoff: drops that swell under the hero field's surface, stretch, let go and fall, then shrink away above the
// headline. Each drip point takes its turn, so they never move together. Worked out from the field's time alone.
import { hash, type Field } from './pixel-math';

/** columns between drip points */
const SPACING = 22;
/** field time per cycle; field time runs at 0.4 a second, so about 6 s */
const CYCLE = 2.4;
/** the shares of a cycle spent swelling and stretching, then falling; the remainder is rest */
const STRETCH = 0.58;
const FALL = 0.3;
const STEM = 5;
const FALL_ROWS = 8;
/** a falling drop is gone by this share of the host's rows, above the headline */
const FLOOR_SHARE = 0.84;

export interface Drip {
  column: number;
  /** 0..1 through this point's cycle */
  phase: number;
}

/** one drip point every SPACING columns, each a golden-ratio step apart in time */
export function drips(columns: number, time: number, seed: number): Drip[] {
  return Array.from({ length: Math.ceil(columns / SPACING) }, (_, i) => ({
    column: Math.round((i + 0.5) * SPACING + (hash(i, seed, 5) - 0.5) * 9),
    phase: (time / CYCLE + i * 0.618) % 1,
  }));
}

/** how many rows the surface sags toward a drip point at column x */
export function sag(list: Drip[], x: number): number {
  let most = 0;
  for (const { column, phase } of list) {
    const near = Math.max(0, 1 - Math.abs(x - column - 0.5) / 6);
    const load = phase < STRETCH ? phase / STRETCH : Math.max(0, 1 - (phase - STRETCH) / FALL);
    most = Math.max(most, 3 * load * near * near);
  }
  return most;
}

/** stems, bulbs and falling drops, drawn over the stepped field */
export function drawRunoff(field: Field, list: Drip[], coverage: number): void {
  const { columns, rows, hostRows, bucket, alpha, surface } = field;
  const set = (x: number, y: number, level: number, opacity = 1) => {
    if (x < 0 || x >= columns || y < 0 || y >= rows) return;
    bucket[y * columns + x] = level;
    alpha[y * columns + x] = opacity;
  };
  /** a round drop with its top at row y: 4, 2 or 1 cells wide */
  const drop = (x: number, y: number, width: number, level: number) => {
    if (width === 1) return set(x, y, level, 0.65);
    const side = width === 4 ? 1 : 0,
      height = width === 4 ? 3 : 2;
    for (let dx = -side; dx <= 1 + side; dx++)
      for (let dy = 0; dy < height; dy++) {
        const corner = side > 0 && (dx === -1 || dx === 2) && (dy === 0 || dy === 2);
        set(x + dx, y + dy, level, corner ? 0.5 : 1);
      }
  };
  const floor = Math.floor(hostRows * FLOOR_SHARE * coverage);
  for (const { column, phase } of list) {
    const root = Math.floor(Math.min(surface[column] ?? 0, surface[column + 1] ?? 0));
    if (root <= 0) continue;
    const stretched = Math.min(1, phase / STRETCH);
    const falling = (phase - STRETCH) / FALL;
    const stem = Math.round(STEM * (falling < 0 ? stretched * stretched : Math.max(0, 1 - falling * 2.5)));
    for (let k = 0; k < stem; k++) {
      set(column, root + k, k < 2 ? 4 : 5);
      set(column + 1, root + k, k < 2 ? 4 : 5);
    }
    if (falling < 0) {
      if (stretched > 0.45) drop(column, root + stem - 1, stretched > 0.75 ? 4 : 2, 5);
      continue;
    }
    if (falling >= 1) continue;
    const from = root + STEM - 1;
    const y = from + Math.round(Math.min(FALL_ROWS, Math.max(0, floor - from)) * falling * falling);
    drop(column, y, falling < 0.45 ? 4 : falling < 0.75 ? 2 : 1, falling < 0.4 ? 5 : falling < 0.7 ? 4 : 3);
    // one spark trails behind
    if (falling > 0.2 && falling < 0.8) set(column + 1, y - 3, 4, 0.5);
  }
}
