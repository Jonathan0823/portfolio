
export const NONE = -1;

export interface Cells {
  from: Int8Array;
  to: Int8Array;
  start: Float64Array;
  end: Float64Array;
}

export function createCells(count: number): Cells {
  return {
    from: new Int8Array(count).fill(NONE),
    to: new Int8Array(count).fill(NONE),
    start: new Float64Array(count),
    end: new Float64Array(count),
  };
}

export function retarget(cells: Cells, layer: number, waits: ArrayLike<number>, now: number, flight: number): void {
  for (let i = 0; i < cells.from.length; i++) {
    const landed = now >= cells.end[i];
    const waiting = !landed && now <= cells.start[i];
    if (!landed && !waiting) {
      cells.to[i] = layer;
      continue;
    }
    if (landed) cells.from[i] = cells.to[i];
    cells.to[i] = layer;
    if (cells.from[i] === layer) {
      cells.start[i] = cells.end[i] = now;
      continue;
    }
    const start = waiting ? Math.min(cells.start[i], now + waits[i]) : now + waits[i];
    cells.start[i] = start;
    cells.end[i] = start + flight;
  }
}

export function flightProgress(cells: Cells, i: number, now: number): number {
  if (now >= cells.end[i]) return 1;
  return Math.max(0, (now - cells.start[i]) / (cells.end[i] - cells.start[i]));
}
