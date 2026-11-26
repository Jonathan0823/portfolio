import { hash } from './pixel-math';

export const SHAPES = {
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

export function morphShows(cellX: number, cellY: number, progress: number, inShape: boolean): boolean {
  const threshold = hash(cellX, cellY, 13);
  return inShape ? threshold < progress : threshold >= progress;
}
