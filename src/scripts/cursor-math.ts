// The pure numbers behind the pixel pointer's click, hold-to-charge and page impact.
// They live apart from the drawing so the curves can be tested without a browser.

/** px per cell of the click feedback's grid: chunkier than the hero field so it reads as its own layer */
export const FEEDBACK_CELL = 4;
/** a press shorter than this is a plain tap; the charge starts building after it */
export const TAP_MS = 150;
/** how long a held press takes to reach full charge, counted from the end of the tap window */
export const CHARGE_MS = 1100;
/** charge below this only makes a bigger local shockwave; above it the whole page takes the hit */
export const IMPACT_FROM = 0.35;
/** charge above this adds a flash */
export const FLASH_FROM = 0.8;
/** the front never crosses the page slower than this (px/s) */
export const MIN_WAVE_SPEED = 1800;
/** a far corner raises the speed so the front lands there within this long */
export const WAVE_REACH_S = 0.7;
/** most elements kicked per impact, nearest first, so a long page cannot stall the release */
export const KICK_CAP = 150;
/** how much the held pointer grows at full charge: 1 + this */
export const CHARGE_GROWTH = 0.8;

/** event the release dispatches on window for anything that wants to react as the front passes (the contribution graph) */
export const SHOCKWAVE_EVENT = 'cursor-shockwave';
export interface ShockwaveDetail {
  x: number;
  y: number;
  charge: number;
  /** px/s the front travels at, so a listener can time its own reaction */
  speed: number;
}

export const clampLevel = (n: number): number => Math.max(0, Math.min(5, Math.round(n)));
export const smoothstep = (t: number): number => t * t * (3 - 2 * t);

/** Charge 0..1 after holding for `heldMs`: nothing during the tap window, then ease-out so the first half-second does most of the work. */
export function chargeAt(heldMs: number): number {
  const t = Math.max(0, Math.min(1, (heldMs - TAP_MS) / CHARGE_MS));
  return 1 - (1 - t) * (1 - t);
}

/** How far the held pointer has grown at `charge`. */
export const chargeScale = (charge: number): number => 1 + CHARGE_GROWTH * charge;

/** 0 up to IMPACT_FROM, then rising to 1 at full charge. */
export const impactRamp = (charge: number): number =>
  Math.max(0, Math.min(1, (charge - IMPACT_FROM) / (1 - IMPACT_FROM)));

export interface Impact {
  ramp: number;
  /** px the nearest content is thrown */
  kick: number;
  /** degrees of twist at the nearest content */
  rotate: number;
  /** px the page shakes by */
  shake: number;
  flash: boolean;
}

/** What a release at `charge` does to the page; `ramp` is 0 when it does nothing. */
export function impactStrength(charge: number): Impact {
  const ramp = impactRamp(charge);
  return {
    ramp,
    kick: 18 * charge * ramp,
    rotate: 1.5 * ramp,
    shake: 8 * charge * ramp,
    flash: ramp > 0 && charge > FLASH_FROM,
  };
}

/** Distance from (x, y) to the farthest corner of a viewport: how far the front has to travel. */
export function farthestCorner(x: number, y: number, width: number, height: number): number {
  return Math.max(
    Math.hypot(x, y),
    Math.hypot(width - x, y),
    Math.hypot(x, height - y),
    Math.hypot(width - x, height - y),
  );
}

/** px/s of the page-crossing front: at least MIN_WAVE_SPEED, faster when the far corner would take longer than WAVE_REACH_S. */
export const waveSpeed = (farthest: number): number => Math.max(MIN_WAVE_SPEED, farthest / WAVE_REACH_S);

/** Radius in px of the front `elapsedMs` after release; constant speed, so it reads as a wave rather than a puff. */
export const ringRadius = (elapsedMs: number, speed: number): number => (speed * Math.max(0, elapsedMs)) / 1000;

/** ms until the front reaches something `distance` px from the epicentre. */
export const arrivalMs = (distance: number, speed: number): number => (distance / speed) * 1000;

/** Share of the kick left at `distance`: full beside the epicentre, easing to a quarter so far content still moves. */
export const kickFalloff = (distance: number, farthest: number): number =>
  Math.max(0.25, 1 - distance / (farthest * 1.1));

/** A damped spring's offset at `u` (0..1 of the kick's duration): starts at 1, overshoots past zero and settles at 0. */
export const springValue = (u: number): number => Math.exp(-5 * u) * Math.cos(Math.PI * 2 * 1.25 * u);

/** How long the release pop takes */
export const POP_MS = 180;
const POP_PEAK = 1.1;
/** The pointer's scale `elapsedMs` into the release pop: eases from where the squash left it past 1.1, then back to 1. */
export function popScale(elapsedMs: number, from: number): number {
  const u = elapsedMs / POP_MS;
  if (u >= 1) return 1;
  return u < 0.5 ? from + (POP_PEAK - from) * smoothstep(u * 2) : POP_PEAK + (1 - POP_PEAK) * smoothstep((u - 0.5) * 2);
}

export interface ShockwaveShape {
  /** ring radius in feedback cells */
  maxR: number;
  /** spokes shot out of the ring */
  spokes: number;
  durationMs: number;
  /** ring thickness in cells at the start */
  thickness: number;
  /** how far the spokes' heads travel, in cells */
  spokeReach: number;
  /** length of each spoke, in cells */
  spokeLength: number;
  /** full charge adds a white core flash */
  full: boolean;
}

/** The click shockwave: full strength on a target, 60% on empty page, growing with charge. A tap is charge 0. */
export function shockwaveShape(charge: number, strong: boolean): ShockwaveShape {
  const maxR = (10 + 16 * charge) * (strong ? 1 : 0.6);
  return {
    maxR,
    spokes: charge >= 0.99 ? 16 : charge >= 0.5 || strong ? 8 : 4,
    durationMs: 420 + 230 * charge,
    thickness: 2 + charge,
    spokeReach: maxR + 3 + 6 * charge,
    spokeLength: 3.5 + 3 * charge,
    full: charge >= 0.99,
  };
}

/** Radius in hero-field cells of the heat ring a click injects `t` (0..1) of the way through its life. */
export function fieldRingRadius(strong: boolean, charge: number, impact: number, t: number): number {
  const reach = (strong ? 9 : 5.5) * (1 + 2 * charge) * (1 + 1.5 * impact);
  return reach * (1 - (1 - t) * (1 - t));
}

/** Heat a hero-field cell at `distance` cells from the click gets from a ring of radius `radius`, 0 off the ring. */
export function fieldRingHeat(distance: number, radius: number, strong: boolean, t: number): number {
  const off = Math.abs(distance - radius);
  if (off > 1.1) return 0;
  return (strong ? 1 : 0.75) * (1 - t * 0.4) * (1 - off / 1.6);
}

/** Cells a charging mote starts from the pointer */
export const MOTE_FROM = 8;
/** How far a mote is from the pointer at `progress` (0 = just spawned, 1 = arrived); it accelerates in. */
export const moteRadius = (progress: number): number => MOTE_FROM * (1 - progress * progress);
