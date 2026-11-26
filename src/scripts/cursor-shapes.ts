// Pure data and maths for the cursor blob's shapes. No DOM access here.
import { hash } from './pixel-math';

/**
 * Shapes the cursor blob can turn into, as 11 x 11 bitmaps centred on the pointer. Elements
 * choose one with data-cursor="name".
 */
export const SHAPES = {
  // ↗ external link
  arrow: [
    '...........',
    '....#######',
    '.......####',
    '......#####',
    '.....###.##',
    '....###..##',
    '...###....#',
    '..###......',
    '.###.......',
    '.##........',
    '...........',
  ],
  // → internal link (the story)
  next: [
    '...........',
    '......#....',
    '......##...',
    '......###..',
    '##########.',
    '###########',
    '##########.',
    '......###..',
    '......##...',
    '......#....',
    '...........',
  ],
  // ← back
  back: [
    '...........',
    '....#......',
    '...##......',
    '..###......',
    '.##########',
    '###########',
    '.##########',
    '..###......',
    '...##......',
    '....#......',
    '...........',
  ],
  // + open
  plus: [
    '...........',
    '....###....',
    '....###....',
    '....###....',
    '###########',
    '###########',
    '###########',
    '....###....',
    '....###....',
    '....###....',
    '...........',
  ],
  // − close
  minus: [
    '...........',
    '...........',
    '...........',
    '...........',
    '###########',
    '###########',
    '###########',
    '...........',
    '...........',
    '...........',
    '...........',
  ],
  // eye: look at a project
  eye: [
    '...........',
    '...........',
    '...#####...',
    '.##.....##.',
    '#...###...#',
    '#..#####..#',
    '#...###...#',
    '.##.....##.',
    '...#####...',
    '...........',
    '...........',
  ],
  // crosshair: inspect a day on the contribution grid
  cross: [
    '.....#.....',
    '.....#.....',
    '.....#.....',
    '...........',
    '...........',
    '###.....###',
    '...........',
    '...........',
    '.....#.....',
    '.....#.....',
    '.....#.....',
  ],
} as const;

export type ShapeName = keyof typeof SHAPES;
export const SHAPE_SIZE = 11;
const HALF = (SHAPE_SIZE - 1) / 2;

export function isShapeName(name: string | undefined | null): name is ShapeName {
  return !!name && Object.hasOwn(SHAPES, name);
}

/** Filled cells of a shape as offsets from its centre cell, with each cell's distance (0..1) from the centre. */
export function shapeCells(name: ShapeName): { dx: number; dy: number; distance: number }[] {
  const cells: { dx: number; dy: number; distance: number }[] = [];
  SHAPES[name].forEach((line, y) => {
    for (let x = 0; x < line.length; x++) {
      if (line[x] !== '#') continue;
      const dx = x - HALF, dy = y - HALF;
      cells.push({ dx, dy, distance: Math.min(1, Math.hypot(dx, dy) / (HALF * Math.SQRT2)) });
    }
  });
  return cells;
}

/**
 * Whether a cell shows during a morph. Each cell has its own threshold, so the blob breaks up
 * into the shape cell by cell instead of cross-fading. `progress` 0 = blob, 1 = shape.
 */
export function morphShows(cellX: number, cellY: number, progress: number, inShape: boolean): boolean {
  const threshold = hash(cellX, cellY, 13);
  return inShape ? threshold < progress : threshold >= progress;
}
