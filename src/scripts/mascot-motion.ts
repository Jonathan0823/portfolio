// How a footer mascot moves, as pure functions of time: breaking out of the lava onto the letters and sinking back
// with them (the presence), and walking or hopping along the letter tops (the travel). Nothing here touches the DOM or
// reads a clock: callers hand in elapsed ms and draw the pose that comes back. Units are half field cells (see mascot-spots).
import type { MascotSprite } from './mascot-sprites';
import type { Step } from './mascot-spots';

export interface Spot {
  P: number;
  F: number;
}

/** what a mascot looks like at one instant: where its feet are, squashed, tilted, and which leg frame */
export interface Pose extends Spot {
  sx: number;
  sy: number;
  /** degrees, about the bottom middle */
  tilt: number;
  leg: 0 | 1;
}

/** ms one step of an animation lasts (about 22 frames a second): the pacing the motion was tuned at */
export const FRAME_MS = 46;
const SINK_FRAMES = 14;
/** half cells a mascot bursts from the side of its place, and how far a flailing walker shuffles */
const KICK_DISTANCE = 7;
const FLAIL = 1;
/** a hop is at least this many and at most this many frames in the air, one per ~1.2 half cells travelled */
const HOP_MIN_FRAMES = 8;
const HOP_MAX_FRAMES = 16;
const CROUCH_MS = 90;
const LAND_MS = 110;
const WALK_MS = 120;
/** the sink turns Pi this far and lets it settle by this share of its height as it goes under */
const SINK_TILT = -38;
const SINK_SLUMP = 0.1;

const smooth = (t: number) => t * t * (3 - 2 * t);
const level: Pose = { P: 0, F: 0, sx: 1, sy: 1, tilt: 0, leg: 0 };

export type Phase = 'under' | 'emerging' | 'up' | 'sinking';

/** under the lava, bursting out, standing on its place, or going back under; `t` is ms into the phase (negative: waiting) */
export interface Presence {
  phase: Phase;
  t: number;
  /** where the current emerge or sink began, so a reversal carries on from where it was */
  from: Spot;
}

export const UNDER: Presence = { phase: 'under', t: 0, from: { P: 0, F: 0 } };
export const UP: Presence = { phase: 'up', t: 0, from: { P: 0, F: 0 } };

/** the floor (half cells) at which a sprite is wholly under the lava, whose surface stands `wade` rows over the base */
export function sunkFloor(sprite: MascotSprite, wade: number): number {
  return Math.floor(2 * (wade + 1) - sprite.height) - 1;
}

/** lava thrown up as a mascot bursts out (as it leaves the surface, and again just after), and bubbles as it goes under */
export const EMERGE_SPLASHES = [
  { at: 0, count: 5, height: 7, spread: 4 },
  { at: 2 * FRAME_MS, count: 4, height: 9, spread: 5 },
];
export const SINK_BUBBLES = [
  { at: 9 * FRAME_MS, offset: -2 },
  { at: 12 * FRAME_MS, offset: 3 },
];

export const emergeMs = (sprite: MascotSprite) => sprite.gait.emergeFrames * FRAME_MS;
export const sinkMs = () => SINK_FRAMES * FRAME_MS;

/** the pose while bursting out (`u` 0..1): arcing up from `from` to `home`, flailing, and landing squashed */
function emergePose(sprite: MascotSprite, from: Spot, home: Spot, u: number): Pose {
  const { emergeFrames: n, emergeLift } = sprite.gait;
  const walker = sprite.gait.walks;
  const frame = Math.floor(u * n);
  const rise = home.F - from.F;
  const lift = Math.round(rise * 0.35) + emergeLift;
  const pose: Pose = {
    ...level,
    P: Math.round(from.P + (home.P - from.P) * u) + (walker && u < (n - 2) / n ? (frame % 2 ? 1 : -1) : 0),
    F: Math.round(from.F + rise * u + 4 * lift * u * (1 - u)),
    leg: walker ? ((frame % 2) as 0 | 1) : 0,
  };
  if (u >= 1) return { ...pose, P: home.P, F: home.F, sx: sprite.gait.landing[0], sy: sprite.gait.landing[1], leg: 0 };
  if (!walker) {
    pose.sx = u < 0.5 ? 0.86 : u < 0.9 ? 1.04 : 1.2;
    pose.sy = u < 0.5 ? 1.22 : u < 0.9 ? 0.96 : 0.8;
  }
  return pose;
}

/** the pose while sinking (`u` 0..1): flailing and slumping down to `sunk`, the letters' own pace */
function sinkPose(sprite: MascotSprite, from: Spot, sunk: number, u: number): Pose {
  const frame = Math.floor(u * SINK_FRAMES);
  const walker = sprite.gait.walks;
  return {
    ...level,
    P: from.P + (walker ? (frame % 2 ? FLAIL : -FLAIL) : 0),
    F: Math.round(from.F + (sunk - from.F) * smooth(u) - (walker ? 0 : SINK_SLUMP * sprite.height * u)),
    leg: walker ? ((frame % 2) as 0 | 1) : 0,
    tilt: walker ? 0 : Math.round(SINK_TILT * u),
  };
}

/** where a mascot is drawn for this presence, or null while it is wholly under the lava (or not yet out) */
export function presencePose(sprite: MascotSprite, p: Presence, home: Spot, sunk: number): Pose | null {
  if (p.phase === 'under' || p.t < 0) return null;
  if (p.phase === 'up') return { ...level, ...home };
  if (p.phase === 'emerging') return emergePose(sprite, p.from, home, Math.min(1, p.t / emergeMs(sprite)));
  return sinkPose(sprite, p.from, sunk, Math.min(1, p.t / sinkMs()));
}

/**
 * Steers the presence toward the word being up (`want`): rising a mascot that is under or sinking, sinking one that is
 * up or rising. A reversal carries on from `current` (where it is drawn now), so nothing jumps; one fully under starts
 * from beside its place. `delay` holds a rising mascot back, so a pair do not burst out in step.
 */
export function steer(
  sprite: MascotSprite,
  p: Presence,
  want: boolean,
  current: Pose | null,
  home: Spot,
  sunk: number,
  delay = 0,
): Presence {
  if (want) {
    if (p.phase === 'emerging' || p.phase === 'up') return p;
    const fresh = !current || current.F <= sunk + 1;
    const from = fresh ? { P: home.P + sprite.gait.kick * KICK_DISTANCE, F: sunk } : { P: current.P, F: current.F };
    return { phase: 'emerging', t: fresh ? -delay : 0, from };
  }
  if (p.phase === 'under' || p.phase === 'sinking') return p;
  if (!current) return UNDER;
  return { phase: 'sinking', t: 0, from: { P: current.P, F: current.F } };
}

/** the presence `dt` ms later: a finished emerge stands up, a finished sink goes under */
export function advancePresence(sprite: MascotSprite, p: Presence, dt: number): Presence {
  if (p.phase === 'under' || p.phase === 'up') return p;
  const t = p.t + dt;
  if (p.phase === 'emerging') return t >= emergeMs(sprite) ? { ...UP, from: p.from } : { ...p, t };
  return t >= sinkMs() ? { ...UNDER, from: p.from } : { ...p, t };
}

/** reduced motion: no burst and no sink, the mascot is on its place while the word is up and gone while it is down */
export const staticPresence = (want: boolean): Presence => (want ? UP : UNDER);

/** a walk or a string of hops under way, step `index` of `steps` having run `t` ms */
export interface Travel {
  steps: Step[];
  origin: Spot;
  index: number;
  t: number;
}

export const startTravel = (origin: Spot, steps: Step[]): Travel => ({ steps, origin, index: 0, t: 0 });

const hopFrames = (from: number, to: number) =>
  Math.max(HOP_MIN_FRAMES, Math.min(HOP_MAX_FRAMES, Math.round(Math.abs(to - from) / 1.2)));

const stepOrigin = (tr: Travel): Spot => (tr.index ? tr.steps[tr.index - 1] : tr.origin);

/** ms one step takes: a walk is a beat, a hop crouches, flies, lands and the mascot rests a moment */
export function stepMs(sprite: MascotSprite, from: Spot, step: Step): number {
  if (step.kind === 'walk') return WALK_MS;
  return CROUCH_MS + hopFrames(from.P, step.P) * FRAME_MS + LAND_MS + sprite.gait.rest;
}

/** the travel `dt` ms later, or null once its last step is done */
export function advanceTravel(sprite: MascotSprite, tr: Travel, dt: number): Travel | null {
  let { index, t } = tr;
  t += dt;
  while (index < tr.steps.length) {
    const from = index ? tr.steps[index - 1] : tr.origin;
    const length = stepMs(sprite, from, tr.steps[index]);
    if (t < length) break;
    t -= length;
    index++;
  }
  return index >= tr.steps.length ? null : { ...tr, index, t };
}

/**
 * The pose on this travel. `clearance(P)` is the lowest floor that keeps the sprite above the letters at `P`, so a hop
 * arcs over them rather than through them.
 */
export function travelPose(sprite: MascotSprite, tr: Travel, clearance: (P: number) => number): Pose {
  const step = tr.steps[tr.index];
  const from = stepOrigin(tr);
  const walker = sprite.gait.walks;
  if (step.kind === 'walk')
    return { ...level, P: step.P, F: step.F, leg: walker ? ((tr.index + 1) % 2 === 1 ? 1 : 0) : 0 };
  const frames = hopFrames(from.P, step.P);
  const { crouch, landing, lift } = sprite.gait;
  if (tr.t < CROUCH_MS) return { ...level, ...from, sx: crouch[0], sy: crouch[1] };
  const air = (tr.t - CROUCH_MS) / FRAME_MS;
  if (air >= frames) {
    const landed = tr.t < CROUCH_MS + frames * FRAME_MS + LAND_MS;
    return { ...level, P: step.P, F: step.F, sx: landed ? landing[0] : 1, sy: landed ? landing[1] : 1 };
  }
  const i = Math.max(1, Math.ceil(air + 1e-9));
  const u = i / frames;
  const P = Math.round(from.P + (step.P - from.P) * u);
  let F = Math.round(from.F + (step.F - from.F) * u + 4 * lift * u * (1 - u));
  if (i < frames) F = Math.max(F, clearance(P));
  return { ...level, P, F };
}

/** where a finished travel leaves the mascot */
export const travelEnd = (tr: Travel): Spot => {
  const last = tr.steps[tr.steps.length - 1];
  return { P: last.P, F: last.F };
};

/** the idle clock: true once `now` passes `due`, with the next one drawn `lo`..`hi` ms on (call with due 0 to start it) */
export function nextDue(
  now: number,
  due: number,
  lo: number,
  hi: number,
  rng: () => number,
): { fire: boolean; due: number } {
  if (!due) return { fire: false, due: now + lo + rng() * (hi - lo) };
  if (now < due) return { fire: false, due };
  return { fire: true, due: now + lo + rng() * (hi - lo) };
}
