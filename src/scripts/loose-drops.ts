// Drops a Wave shakes loose from the hero's hanging edge: each falls a few rows on its own, shrinking and cooling as
// it goes, then is gone. Pure: where a drop is at a given time.

/** ms a loose drop takes to fall */
export const FALL_MS = 600;

export interface LooseDrop {
  column: number;
  /** rows its top falls from and to */
  from: number;
  to: number;
  /** ms it let go */
  born: number;
}

export interface PlacedDrop {
  column: number;
  /** its top's row now */
  row: number;
  /** 0..1 through its fall */
  falling: number;
}

/** where the drop is at `now` ms, or null once it has fallen (or before it lets go) */
export function placeDrop(drop: LooseDrop, now: number): PlacedDrop | null {
  const falling = (now - drop.born) / FALL_MS;
  if (falling < 0 || falling >= 1) return null;
  // it falls from rest, speeding up
  return { column: drop.column, row: drop.from + Math.round((drop.to - drop.from) * falling * falling), falling };
}
