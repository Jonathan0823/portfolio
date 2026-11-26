/** The contribution graph's grid, in SVG user units. Shared by the markup and the ripple math. */
export const CAL = { cell: 12, gutter: 26, top: 16, rows: 7 } as const;

export interface Wave {
  col: number;
  row: number;
  /** performance.now() when it started */
  at: number;
  /** cells per second the front travels */
  speed: number;
  /** seconds until it has died out */
  life: number;
  amp: number;
}

/** The three moments the graph ripples: the cursor arriving or leaving, a click, and the sweep as it scrolls into view. */
export const WAVES = {
  edge: { speed: 22, life: 1.3, amp: 0.9 },
  click: { speed: 30, life: 1.6, amp: 1.2 },
  sweep: { speed: 40, life: 2.2, amp: 1 },
} as const;

/** How hard the waves lift the cell at (col, row) right now, 0..1. */
export function waveStrength(waves: readonly Wave[], col: number, row: number, now: number): number {
  let sum = 0;
  for (const w of waves) {
    const age = (now - w.at) / 1000;
    if (age < 0 || age >= w.life) continue;
    const off = (Math.hypot(col - w.col, row - w.row) - age * w.speed) / 1.7;
    sum += Math.exp(-off * off) * (1 - age / w.life) * w.amp;
  }
  return Math.min(1, sum);
}

/** Drop the waves that have died out. */
export function liveWaves(waves: readonly Wave[], now: number): Wave[] {
  return waves.filter((w) => (now - w.at) / 1000 < w.life);
}

/** The grid cell under a point given in SVG user units, clamped to the grid. */
export function gridCell(x: number, y: number, columns: number): { col: number; row: number } {
  return {
    col: Math.max(0, Math.min(columns - 1, Math.floor((x - CAL.gutter) / CAL.cell))),
    row: Math.max(0, Math.min(CAL.rows - 1, Math.floor((y - CAL.top) / CAL.cell))),
  };
}

/** The cursor's spotlight on the graph: cells this close (in cells) stay full, then fall off to the floor over FALL cells. */
export const SPOT = { radius: 4, fall: 3, floor: 0.3 } as const;

/** Opacity of a cell `distance` cells from the cursor while the spotlight is `amount` (0..1) of the way in. */
export function spotlight(distance: number, amount: number): number {
  const t = Math.max(0, Math.min(1, (distance - SPOT.radius) / SPOT.fall));
  return 1 - amount * (1 - SPOT.floor) * t * t * (3 - 2 * t);
}

/** A point in SVG user units as a (fractional) position in cell units, where a cell's centre is at col + 0.5. */
export function gridPoint(x: number, y: number): { col: number; row: number } {
  return { col: (x - CAL.gutter) / CAL.cell, row: (y - CAL.top) / CAL.cell };
}

/** How far the cells near the cursor rise (0..1): the hill is tallest under the cursor and flat LIFT_RADIUS cells out. */
export const LIFT_RADIUS = 3.5;
export function lift(distance: number, amount: number): number {
  const t = Math.max(0, Math.min(1, distance / LIFT_RADIUS));
  return amount * (1 - t * t * (3 - 2 * t));
}
