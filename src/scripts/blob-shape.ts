// Pure shape maths for the cursor blob. No DOM access here.

export interface BlobGeometry {
  /** semi-axis along the heading, in cells */
  longRadius: number;
  /** semi-axis across the heading, in cells */
  shortRadius: number;
  /** how far the hot core sits toward the leading edge, in cells */
  shift: number;
}

/** Oval from a resting radius (cells) and stretch 0..1 (eased speed). Round at stretch 0. */
export function blobGeometry(radius: number, stretch: number): BlobGeometry {
  const longRadius = radius * (1 + 0.55 * stretch);
  const shortRadius = radius / (1 + 0.2 * stretch);
  return { longRadius, shortRadius, shift: 0.3 * stretch * longRadius };
}

/**
 * Heat of a cell relative to the blob: 1 at the (shifted) core, 0 at the far rim, null outside.
 * @param du, dv cell centre minus blob centre, in cells
 * @param heading direction of travel in radians (full circle)
 */
export function blobValue(du: number, dv: number, heading: number, geometry: BlobGeometry): number | null {
  const cos = Math.cos(heading), sin = Math.sin(heading);
  const along = du * cos + dv * sin, across = -du * sin + dv * cos;
  const { longRadius, shortRadius, shift } = geometry;
  if ((along / longRadius) ** 2 + (across / shortRadius) ** 2 > 1) return null;
  const fromCore = Math.hypot((along - shift) / longRadius, across / shortRadius);
  const farthest = 1 + shift / longRadius;
  return Math.max(0, 1 - fromCore / farthest);
}

/** Palette level (0 darkest .. 5 hottest) for a blob value; `jitter` in -1..1 flickers ring edges. */
export function levelForValue(value: number, jitter: number): number {
  const level = Math.floor((value + jitter * 0.06) * 6);
  return Math.max(0, Math.min(5, level));
}

/** Signed turn from `from` to `to` across a full circle, in (-pi, pi]. */
export function shortestTurn(from: number, to: number): number {
  const full = Math.PI * 2;
  let turn = to - from;
  turn -= Math.round(turn / full) * full;
  return turn;
}
