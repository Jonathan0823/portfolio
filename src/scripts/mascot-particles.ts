// The lava a mascot throws up as it bursts out or slips under, and the odd spark that pops out of a gap between the
// letters: single field cells on short paths. Pure: a particle is described once and asked where it is at an age.
// Positions are in field cells, x from the host's left and y above its bottom.
import { HEAT_PALETTE } from '@/lib/palette';

export interface Particle {
  kind: 'splash' | 'bubble' | 'spark';
  x: number;
  y: number;
  /** splash: sideways drift and height reached; spark: direction (-1 or 1) and height reached */
  dx: number;
  up: number;
  /** ms the particle lives, and which of the hot colours a splash cell takes */
  ms: number;
  hue: number;
}

export interface Drawn {
  x: number;
  y: number;
  /** multiple of a cell */
  size: number;
  alpha: number;
  color: string;
}

const HOT = [HEAT_PALETTE[5], HEAT_PALETTE[4], HEAT_PALETTE[3], HEAT_PALETTE[4]];
const SPARK_MS = 700;
const BUBBLE_MS = 420;
/** how far a spark flies sideways, in cells */
const SPARK_REACH = 3;
/** the share of a splash's flight spent rising; it falls to one cell under where it started */
const RISE_SHARE = 0.45;

/** `count` cells flung up from the lava surface at (`x`, `y`), rising `height` rows and drifting up to `spread` columns */
export function splash(
  x: number,
  y: number,
  count: number,
  height: number,
  spread: number,
  rng: () => number,
): Particle[] {
  return Array.from({ length: count }, (_, i) => ({
    kind: 'splash' as const,
    x,
    y,
    dx: Math.round((rng() * 2 - 1) * spread),
    up: Math.round(height * (0.5 + rng() * 0.5)),
    ms: 520 + rng() * 260,
    hue: i,
  }));
}

/** a bubble popping at the lava surface */
export const bubble = (x: number, y: number): Particle => ({
  kind: 'bubble',
  x,
  y,
  dx: 0,
  up: 1,
  ms: BUBBLE_MS,
  hue: 0,
});

/** a spark leaving the gap at column `x` for the side `dir`, `up` rows high at its peak */
export const spark = (x: number, y: number, dir: -1 | 1, up: number): Particle => ({
  kind: 'spark',
  x,
  y,
  dx: dir,
  up,
  ms: SPARK_MS,
  hue: 0,
});

/** the particle `age` ms after it started, or null once it is gone */
export function particleAt(p: Particle, age: number): Drawn | null {
  if (age < 0 || age >= p.ms) return null;
  const t = age / p.ms;
  if (p.kind === 'bubble') {
    const rise = Math.min(1, t / 0.7);
    const size = t < 0.7 ? 0.5 + (0.7 * t) / 0.7 : 1.2 + 0.6 * ((t - 0.7) / 0.3);
    return { x: p.x, y: p.y + rise * p.up, size, alpha: t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3, color: HEAT_PALETTE[5] };
  }
  if (p.kind === 'spark') {
    // a hop of about 3 cells over the gap, yellow-hot going out and orange coming down
    return {
      x: p.x + p.dx * Math.round(t * SPARK_REACH),
      y: p.y + Math.round(4 * p.up * t * (1 - t)),
      size: 1,
      alpha: 1,
      color: t < 0.5 ? HEAT_PALETTE[5] : HEAT_PALETTE[4],
    };
  }
  const rising = t < RISE_SHARE;
  const x = rising ? p.dx * 0.6 * (t / RISE_SHARE) : p.dx * (0.6 + 0.4 * ((t - RISE_SHARE) / (1 - RISE_SHARE)));
  const y = rising ? p.up * (t / RISE_SHARE) : p.up - (p.up + 1) * ((t - RISE_SHARE) / (1 - RISE_SHARE));
  return { x: p.x + x, y: p.y + y, size: 1, alpha: rising ? 1 : 0.9, color: HOT[p.hue % HOT.length] };
}

/** the beats (each `at` ms into an animation) that fall in the span since the last frame, from inclusive to exclusive */
export function crossed<T extends { at: number }>(beats: readonly T[], from: number, to: number): T[] {
  return beats.filter((b) => b.at >= from && b.at < to);
}
