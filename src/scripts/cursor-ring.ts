import { easeFactor } from './timing';

/** How far from a magnet's edge, in px, the cursor starts being pulled in. */
export const MAGNET_ZONE = 72;
/** How far, in px, a locked-on logo leans toward the pointer. */
export const MAGNET_LEAN = 6;

/** Share of the way the cursor is pulled onto a magnet: 1 at its edge, easing to 0 at MAGNET_ZONE. */
export function magnetPull(edgeDistance: number): number {
  if (edgeDistance >= MAGNET_ZONE) return 0;
  const t = 1 - Math.max(0, edgeDistance) / MAGNET_ZONE;
  return t * t * (3 - 2 * t);
}

/**
 * The ring the blob morphs into around a magnet, in half-cell units.
 * It grows as a disc, hollows once grown, opens gaps once hollow, and spins;
 * leaving runs that backwards and crossfades (mix) back to the normal blob.
 */
export interface Ring {
  active: boolean;
  collapsed: boolean;
  /** 0 = the normal blob is showing, 1 = the ring is */
  mix: number;
  x: number;
  y: number;
  outer: number;
  inner: number;
  /** share of each quarter arc left open, 0..1 */
  gap: number;
  spin: number;
}

export interface RingShape {
  x: number;
  y: number;
  outer: number;
  inner: number;
  gap: number;
}

export interface BlobDisc {
  x: number;
  y: number;
  radius: number;
}

export function idleRing(): Ring {
  return { active: false, collapsed: true, mix: 0, x: 0, y: 0, outer: 0, inner: 0, gap: 0, spin: 0 };
}

export function ringHollow(r: Ring): number {
  return Math.min(1, r.inner / Math.max(1, r.outer - 1));
}

/** Advance one frame toward `goal` (a magnet's ring), or, with no goal, fold back into `blob`. */
export function stepRing(r: Ring, goal: RingShape | null, blob: BlobDisc, scale: number): void {
  if (!r.active) {
    if (!goal) return;
    // start exactly where the blob is, so the hand-off is invisible
    Object.assign(r, { active: true, collapsed: false, x: blob.x, y: blob.y, outer: blob.radius, inner: 0, gap: 0 });
  }
  const g = goal ?? { x: blob.x, y: blob.y, outer: blob.radius, inner: 0, gap: 0 };
  const move = easeFactor(0.32, scale),
    size = easeFactor(0.2, scale);
  r.x += (g.x - r.x) * move;
  r.y += (g.y - r.y) * move;
  r.outer += (g.outer - r.outer) * size;
  const grown = Math.min(1, Math.max(0, r.outer / Math.max(1, g.outer)));
  r.inner += ((goal ? g.inner * grown * grown : 0) - r.inner) * size;
  const hollow = ringHollow(r);
  r.gap += ((goal ? g.gap * hollow * hollow : 0) - r.gap) * size;
  r.spin += 0.0144 * scale * (0.3 + hollow);
  if (goal) r.collapsed = false;
  else if (
    r.inner < 0.6 &&
    r.gap < 0.03 &&
    Math.abs(r.outer - blob.radius) < 1 &&
    Math.hypot(r.x - g.x, r.y - g.y) < 1.2
  )
    r.collapsed = true;
  r.mix += ((r.collapsed ? 0 : 1) - r.mix) * easeFactor(0.28, scale);
  if (r.collapsed && r.mix < 0.02) Object.assign(r, { mix: 0, active: false });
}

const ARC = Math.PI / 2;

/**
 * Heat value (0..1) of the half-cell at (dx, dy) from the ring's centre, or null when empty.
 * A solid disc is hot in the middle like the blob; as it hollows it becomes arcs
 * with cooler ends and a hot pulse at angle `pulse` travelling round.
 */
export function ringValue(r: Ring, dx: number, dy: number, pulse: number): number | null {
  const d = Math.hypot(dx, dy);
  if (d > r.outer + 0.35 || d < r.inner - 0.35) return null;
  const a = Math.atan2(dy, dx);
  const seg = ((((a + r.spin) % ARC) + ARC) % ARC) / ARC;
  if (seg > 1 - r.gap) return null;
  let pd = Math.abs(a + Math.PI - pulse);
  pd = Math.min(pd, Math.PI * 2 - pd);
  const edge = r.gap > 0.01 ? Math.abs(seg / (1 - r.gap) - 0.5) * 2 : 0;
  const disc = 1 - (d / Math.max(1, r.outer)) * 0.75;
  const ring = 0.85 - edge * 0.45 + Math.exp(-pd * pd * 2.5) * 0.4;
  return Math.min(1, disc + (ring - disc) * ringHollow(r));
}
