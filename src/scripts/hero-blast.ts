// The hold-and-release blast: how charged a hold is, how hard it throws a mascot, and where a thrown mascot lands.

/** a press shorter than this is a click, not a hold */
export const BLAST_MIN_MS = 220;
/** the charge starts building after this long, and is full CHARGE_MS later */
const CHARGE_FROM_MS = 200;
const CHARGE_MS = 1000;

/** how charged a hold is after held ms: 0 (just started) to 1 (full) */
export function chargeOf(heldMs: number): number {
  return Math.max(0, Math.min(1, (heldMs - CHARGE_FROM_MS) / CHARGE_MS));
}

export interface Throw {
  vx: number;
  vy: number;
  /** degrees a second, turning away from the blast */
  spin: number;
}

/**
 * How a blast at `blast` throws something standing at `at`: away from it, mostly up, harder for a fuller charge and a
 * little less for what is further away. Straight above or below it picks a side. rand gives numbers in [0, 1).
 */
export function throwOf(
  blast: { x: number; y: number },
  at: { x: number; y: number },
  charge: number,
  rand: () => number,
): Throw {
  const power = 0.4 + 0.6 * charge;
  const dx = at.x - blast.x;
  const dy = at.y - blast.y;
  const d = Math.hypot(dx, dy) || 1;
  const falloff = Math.max(0.4, 1 - d / 1200);
  const ux = Math.abs(dx / d) < 0.2 ? (rand() < 0.5 ? -0.5 : 0.5) : dx / d;
  return {
    vx: ux * (500 + 500 * power) * falloff,
    vy: -(420 + 520 * power) * Math.max(0.5, falloff),
    spin: (ux >= 0 ? 1 : -1) * (360 + 500 * power),
  };
}

/**
 * The y something falling at x lands on: the first top of a letter under x that it has not already passed
 * (letters whose top is above y are behind it), else `fallback`.
 */
export function floorUnder(
  tops: { x: number; w: number; top: number }[],
  x: number,
  y: number,
  fallback: number,
): number {
  let floor = Infinity;
  for (const l of tops) if (x >= l.x && x <= l.x + l.w && l.top >= y - 2) floor = Math.min(floor, l.top);
  return floor === Infinity ? fallback : floor;
}
