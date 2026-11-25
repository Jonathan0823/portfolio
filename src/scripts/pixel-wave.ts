// Pure state of a picture made of pixel cells. Each cell shows one layer (or nothing) and a wave
// moves it to another, passing through a heat colour. A new wave carries on from wherever the
// cells are, so switching quickly never blanks or restarts the picture. No DOM access here.

export const NONE = -1;

export interface Cells {
  /** layer shown until the cell's flight starts */
  from: Int8Array;
  /** layer shown once it has landed */
  to: Int8Array;
  /** when the flight starts, ms */
  start: Float64Array;
  /** when it lands, ms */
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

/** Sends every cell towards `layer`; each one sets off after its own wait and flies for `flight` ms. */
export function retarget(cells: Cells, layer: number, waits: ArrayLike<number>, now: number, flight: number): void {
  for (let i = 0; i < cells.from.length; i++) {
    const landed = now >= cells.end[i];
    const waiting = !landed && now <= cells.start[i];
    if (!landed && !waiting) {
      cells.to[i] = layer; // already in the air: it just lands somewhere else
      continue;
    }
    if (landed) cells.from[i] = cells.to[i];
    cells.to[i] = layer;
    if (cells.from[i] === layer) {
      cells.start[i] = cells.end[i] = now; // nothing to change
      continue;
    }
    // A cell already waiting never gets pushed back, or quick switching could stall it.
    const start = waiting ? Math.min(cells.start[i], now + waits[i]) : now + waits[i];
    cells.start[i] = start;
    cells.end[i] = start + flight;
  }
}

/** Flight progress of cell i: 0 = still showing `from`, 1 = showing `to`, between = in the air. */
export function flightProgress(cells: Cells, i: number, now: number): number {
  if (now >= cells.end[i]) return 1;
  return Math.max(0, (now - cells.start[i]) / (cells.end[i] - cells.start[i]));
}
