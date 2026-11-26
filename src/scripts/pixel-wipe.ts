import { hash } from './pixel-math';

export type Side = 'left' | 'right' | 'top' | 'bottom';

export function entrySide(x: number, y: number, w: number, h: number): Side {
  const distances: [Side, number][] = [
    ['left', x],
    ['right', w - x],
    ['top', y],
    ['bottom', h - y],
  ];
  return distances.reduce((best, d) => (d[1] < best[1] ? d : best))[0];
}

export const SPREAD = 0.62;

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

export function cellProgress(t: number, delay: number): number {
  if (t >= 1) return 1;
  return Math.min(1, Math.max(0, (t - delay) / (1 - SPREAD)));
}

export function radialDelays(columns: number, rows: number, originX: number, originY: number): Float32Array {
  const delays = new Float32Array(columns * rows);
  let farthest = 1;
  for (const [x, y] of [
    [0, 0],
    [columns, 0],
    [0, rows],
    [columns, rows],
  ]) {
    farthest = Math.max(farthest, Math.hypot(x - originX, y - originY));
  }
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < columns; x++) {
      const along = Math.hypot(x + 0.5 - originX, y + 0.5 - originY) / farthest;
      const jitter = hash(x, y, 5) - 0.5;
      delays[y * columns + x] = Math.min(1, Math.max(0, along * 0.8 + jitter * 0.3 + 0.1)) * SPREAD;
    }
  }
  return delays;
}

export function coverLevel(p: number): number {
  return Math.max(0, Math.min(5, Math.round((1 - p) * 5)));
}

export function cellsPath(mask: Uint8Array, columns: number, size: number): string {
  let path = '';
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    const x = i % columns,
      y = Math.floor(i / columns);
    let run = 1;
    while (x + run < columns && mask[i + run]) run++;
    path += `M${x * size} ${y * size}h${run * size}v${size + 0.5}h-${run * size}z`;
    i += run - 1;
  }
  return path || 'M0 0';
}
