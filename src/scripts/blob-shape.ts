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
