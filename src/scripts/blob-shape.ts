export interface BlobGeometry {
  longRadius: number;
  shortRadius: number;
  shift: number;
}

export function blobGeometry(radius: number, stretch: number): BlobGeometry {
  const longRadius = radius * (1 + 0.55 * stretch);
  const shortRadius = radius / (1 + 0.2 * stretch);
  return { longRadius, shortRadius, shift: 0.3 * stretch * longRadius };
}

export function blobValue(du: number, dv: number, heading: number, geometry: BlobGeometry): number | null {
  const cos = Math.cos(heading),
    sin = Math.sin(heading);
  const along = du * cos + dv * sin,
    across = -du * sin + dv * cos;
  const { longRadius, shortRadius, shift } = geometry;
  if ((along / longRadius) ** 2 + (across / shortRadius) ** 2 > 1) return null;
  const fromCore = Math.hypot((along - shift) / longRadius, across / shortRadius);
  const farthest = 1 + shift / longRadius;
  return Math.max(0, 1 - fromCore / farthest);
}

export function levelForValue(value: number, jitter: number): number {
  const level = Math.floor((value + jitter * 0.06) * 6);
  return Math.max(0, Math.min(5, level));
}

export function shortestTurn(from: number, to: number): number {
  const full = Math.PI * 2;
  let turn = to - from;
  turn -= Math.round(turn / full) * full;
  return turn;
}

/** px from the edge of a heading's text at which the cursor starts growing to heading size */
export const HEADING_REACH = 56;

/** Distance (px) from a point to a rect; 0 inside it. */
export function rectDistance(
  x: number,
  y: number,
  r: { left: number; right: number; top: number; bottom: number },
): number {
  const dx = Math.max(r.left - x, 0, x - r.right),
    dy = Math.max(r.top - y, 0, y - r.bottom);
  return Math.hypot(dx, dy);
}

/** How far the cursor has grown toward heading size: 1 on the text, easing to 0 at HEADING_REACH. */
export function headingGrow(distance: number): number {
  if (distance >= HEADING_REACH) return 0;
  const t = 1 - Math.max(0, distance) / HEADING_REACH;
  return t * t * (3 - 2 * t);
}
