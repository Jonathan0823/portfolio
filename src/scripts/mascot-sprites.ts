// The footer mascots as pure data: Clawd (a quadrant-cell sprite, drawn 1 wide x 2 tall like a terminal cell) and Pi
// (the skills grid's own pixel art). Everything is in half field cells, so one cell of Pi is exactly one field cell
// and a sprite's feet land on the same grid the letters are made of. Rects are drawn back to front.
import { PIXEL_ART } from '@/lib/skill-art';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
}

/** how a mascot moves: the character of its walk and hops, and how it breaks out of the lava */
export interface Gait {
  walks: boolean;
  /** half cells a hop may cover, and its cost against walking when planning a route */
  hopMin: number;
  hopMax: number;
  hopCost: number;
  /** half cells a hop arcs above the straight line */
  lift: number;
  /** frames (see FRAME_MS in mascot-motion) of the break-out from the lava, its extra arc and the side it bursts from */
  emergeFrames: number;
  emergeLift: number;
  kick: -1 | 1;
  /** [sx, sy] squash crouching to hop and on landing */
  crouch: [number, number];
  landing: [number, number];
  /** ms the mascot waits after a hop */
  rest: number;
}

export interface MascotSprite {
  name: 'clawd' | 'pi';
  /** half cells */
  width: number;
  height: number;
  body: Rect[];
  /** Clawd's two leg frames; Pi has none */
  legs: Rect[][];
  /** drawn over the body, and the lids that cover them while blinking */
  eyes: Rect[];
  lids: Rect[];
  /** per half-cell column: the lowest height occupied above the feet, Infinity where the column is empty */
  low: number[];
  /** columns whose lowest cell touches the feet line, grouped into pairs of neighbouring feet */
  feet: number[][];
  gait: Gait;
}

const CLAWD_ROWS = [
  '...############...',
  '...##.######.##...',
  '.################.',
  '...############...',
  '....#.#....#.#....',
];
const CLAWD_COLOR = '#D97757';
const CLAWD_EYE = '#111';
/** the eyes are the two gaps in the second row */
const EYE_COLUMNS = [5, 12];
/** the alternate leg frame: four single-cell feet */
const STEP_FEET = [5, 7, 10, 12];

/** horizontal runs of one colour per row, each cell `colW` wide and `rowH` tall */
function runs(rows: readonly string[], rowH: number, colW: number, colorOf: (ch: string) => string | null): Rect[] {
  const out: Rect[] = [];
  rows.forEach((row, r) => {
    for (let c = 0; c < row.length; c++) {
      const color = colorOf(row[c]);
      if (!color) continue;
      let n = 1;
      while (c + n < row.length && colorOf(row[c + n]) === color) n++;
      out.push({ x: c * colW, y: r * rowH, w: n * colW, h: rowH, color });
      c += n - 1;
    }
  });
  return out;
}

function lowOf(rows: readonly string[], rowH: number, colW: number): number[] {
  return Array.from({ length: rows[0].length * colW }, (_, u) => {
    const c = Math.floor(u / colW);
    let low = Infinity;
    rows.forEach((row, r) => {
      if (row[c] !== '.') low = Math.min(low, (rows.length - 1 - r) * rowH);
    });
    return low;
  });
}

function feetOf(low: number[]): number[][] {
  const groups: number[][] = [];
  low.forEach((v, u) => {
    if (v !== 0) return;
    const last = groups[groups.length - 1];
    if (last && u - last[last.length - 1] <= 2) last.push(u);
    else groups.push([u]);
  });
  return groups;
}

const clawdBodyRows = CLAWD_ROWS.map((row, r) => (r === CLAWD_ROWS.length - 1 ? '.'.repeat(row.length) : row));
const clawdLegRows = CLAWD_ROWS.map((row, r) => (r === CLAWD_ROWS.length - 1 ? row : '.'.repeat(row.length)));
const clawdLow = lowOf(CLAWD_ROWS, 2, 1);
const eyeRect = (x: number, color: string): Rect => ({ x, y: 2, w: 1, h: 2, color });

export const CLAWD: MascotSprite = {
  name: 'clawd',
  width: CLAWD_ROWS[0].length,
  height: CLAWD_ROWS.length * 2,
  body: runs(clawdBodyRows, 2, 1, (ch) => (ch === '#' ? CLAWD_COLOR : null)),
  legs: [
    runs(clawdLegRows, 2, 1, (ch) => (ch === '#' ? CLAWD_COLOR : null)),
    STEP_FEET.map((x) => ({ x, y: 8, w: 1, h: 2, color: CLAWD_COLOR })),
  ],
  eyes: EYE_COLUMNS.map((x) => eyeRect(x, CLAWD_EYE)),
  lids: EYE_COLUMNS.map((x) => eyeRect(x, CLAWD_COLOR)),
  low: clawdLow,
  feet: feetOf(clawdLow),
  gait: {
    walks: true,
    hopMin: 4,
    hopMax: 26,
    hopCost: 9,
    lift: 4,
    emergeFrames: 20,
    emergeLift: 8,
    kick: -1,
    crouch: [1.08, 0.9],
    landing: [1.1, 0.88],
    rest: 0,
  },
};

// Pi is the skills grid's 4x4 art; every art pixel is one field cell (two half cells)
const piArt = PIXEL_ART.pi;
const piLow = lowOf(piArt.rows, 2, 2);

export const PI: MascotSprite = {
  name: 'pi',
  width: piArt.rows[0].length * 2,
  height: piArt.rows.length * 2,
  body: runs(piArt.rows, 2, 2, (ch) => (piArt.palette as Record<string, string>)[ch] ?? null),
  legs: [],
  eyes: [],
  lids: [],
  low: piLow,
  feet: feetOf(piLow),
  gait: {
    walks: false,
    hopMin: 5,
    hopMax: 30,
    hopCost: 1,
    lift: 6,
    emergeFrames: 22,
    emergeLift: 12,
    kick: 1,
    crouch: [1.2, 0.78],
    landing: [1.22, 0.76],
    rest: 200,
  },
};
