// The Mould: a ghost outline of a contact logo that drops of lava fill, inviting visitors to the links. The parts that
// are not tied to one pointer type: timing, the shape's cells, how it fills, and where lava gathers above it. Pure,
// apart from the heat held in the field.
import { HEAT_PALETTE, type Field } from './pixel-math';
import { holdHeat } from './heat-hold';

/** the mould appears this long after the page cover is gone */
export const APPEAR_AFTER_MS = 1000;
/** the ghost outline fades in over this long */
export const FADE_IN_MS = 800;
/** beat between the headline's period being built and the first gather */
export const FIRST_DRIP_MS = 600;
/** a hot spot gathers under the field, then its bead hangs, before it lets go */
export const GATHER_MS = 550;
export const HANG_MS = 250;
/** px/s²; slower than the headline's drip */
export const FALL_GRAVITY = 700;
/** a landed drop spreads into the mould and cools */
export const SETTLE_MS = 450;
/** from a landing to the next gather */
export const PAUSE_MS = 450;
/** drops it takes to reach the fill */
export const DROPS = 3;
/** the outline's dashes move on one cell per this long */
export const CRAWL_MS = 650;

const DASH_DARK = '#6f68a8';
const DASH_LIGHT = '#cfcbe6';

/** column, row */
export type Cell = [number, number];

export interface MouldShape {
  width: number;
  height: number;
  /** the cells on its edge, drawn as the dashed ghost */
  outline: Cell[];
  /** every cell, in the order the drops fill them: from the bottom up, unevenly along a row */
  pour: Cell[];
}

export function shapeOf(rows: string[]): MouldShape {
  const solid = (c: number, r: number) => rows[r]?.[c] === '#';
  const cells: Cell[] = [];
  rows.forEach((line, r) => [...line].forEach((_, c) => solid(c, r) && cells.push([c, r])));
  return {
    width: rows[0].length,
    height: rows.length,
    outline: cells.filter(([c, r]) => !solid(c - 1, r) || !solid(c + 1, r) || !solid(c, r - 1) || !solid(c, r + 1)),
    pour: [...cells].sort((a, b) => b[1] - a[1] || Math.sin(a[0] * 91) - Math.sin(b[0] * 91)),
  };
}

/** every other stretch of the outline is darker, and the dashes crawl */
export function dashColor([c, r]: Cell, clock: number): string {
  return (c + r + Math.floor(clock / CRAWL_MS)) % 3 ? DASH_DARK : DASH_LIGHT;
}

export interface Fill {
  /** cells the mould holds once the last drop has settled */
  limit: number;
  landed: number;
  /** ms since the last drop landed */
  age: number;
}

const perDrop = (limit: number) => Math.ceil(limit / DROPS);

/** the palette level of each filled cell, in pour order: the newest share spreads in white-hot, then cools to red */
export function fillLevels({ limit, landed, age }: Fill): number[] {
  const before = Math.min(limit, perDrop(limit) * Math.max(0, landed - 1));
  const after = Math.min(limit, perDrop(limit) * landed);
  const filled = before + Math.ceil((after - before) * Math.min(1, age / (SETTLE_MS / 2)));
  return Array.from({ length: filled }, (_, i) => (i < before || age >= SETTLE_MS ? 3 : age < SETTLE_MS / 2 ? 5 : 4));
}

/** the cell the next drop aims for: the middle of the share it will fill */
export function landingCell(shape: MouldShape, limit: number, landed: number): Cell {
  return shape.pour[Math.min(limit - 1, perDrop(limit) * landed + Math.floor(perDrop(limit) / 2))];
}

/** the outline and its fill; `paint` draws one cell */
export function drawMould(shape: MouldShape, fill: Fill, clock: number, paint: (cell: Cell, color: string) => void) {
  for (const cell of shape.outline) paint(cell, dashColor(cell, clock));
  fillLevels(fill).forEach((level, i) => paint(shape.pour[i], HEAT_PALETTE[level]));
}

/** ms until `clock` crosses the next multiple of `beat` */
export const msToBeat = (clock: number, beat: number): number => beat - (clock % beat);

/** field rows needed under a spot for its bulge, the bead and a visible fall */
const FALL_ROOM = 9;

/** the underside of the lava with room to fall to `limit` (section px), in the column nearest to `column` */
export function spotAbove(
  field: Pick<Field, 'columns' | 'lowestRow' | 'cellSize'>,
  column: number,
  limit: number,
): { column: number; row: number } | null {
  for (let reach = 0; reach < field.columns; reach++)
    for (const c of reach ? [column - reach, column + reach] : [column]) {
      const row = field.lowestRow[c];
      if (row !== undefined && row >= 3 && (row + FALL_ROOM) * field.cellSize < limit) return { column: c, row };
    }
  return null;
}

/** keeps the spot glowing for a few frames; stop calling and it fades, so nothing is left behind */
export function glow(column: number, bottom: number, age: number): void {
  const now = performance.now();
  const hold = (x: number, y0: number, y1: number, level: number) =>
    holdHeat({ x0: x, x1: x, y0, y1, level, from: now, until: now + 160, fade: 80 });
  // a red patch with an orange heart that swells downward
  for (let x = column - 2; x <= column + 2; x++) hold(x, bottom - 4, bottom - (Math.abs(x - column) > 1 ? 2 : 0), 0.66);
  for (let x = column - 1; x <= column + 1; x++) {
    hold(x, bottom - 2, bottom - 1, 0.82);
    if (age > GATHER_MS * 0.3) hold(x, bottom, bottom + (x === column ? 1 : 0), 0.82);
  }
  if (age > GATHER_MS * 0.65) hold(column, bottom + 2, bottom + 2, 0.82);
}
