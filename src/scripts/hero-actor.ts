// A mascot on the hero show's stage: what it is doing, and how it behaves while idling on the name.
import type { MascotSprite } from './mascot-sprites';
import type { Letter } from './hero-headline';

export type Mode =
  'wait' | 'ooze' | 'fall' | 'land' | 'panic' | 'hop' | 'dwell' | 'caught' | 'fly' | 'stunned' | 'idle';
/** what a hop leads to when it lands */
export type Then = 'fix' | 'home' | 'idle';
export interface Hop {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  dur: number;
  h: number;
}

export interface Actor {
  name: 'clawd' | 'pi';
  sprite: MascotSprite;
  /** its line of the headline, and the letters it knocks and then fixes */
  letters: Letter[];
  queue: Letter[];
  next: number;
  /** the letter it lands on, the letter it ends on, and the letter it is on now */
  landing: Letter;
  home: Letter;
  at: Letter;
  /** feet: x of the left edge, y of the soles */
  x: number;
  y: number;
  vy: number;
  vx: number;
  /** the lava's surface above where it comes out */
  lavaY: number;
  mode: Mode;
  then: Then;
  /** seconds in the current mode */
  t: number;
  /** squash and stretch, easing toward what the mode asks for */
  sx: number;
  sy: number;
  leg: 0 | 1;
  hop: Hop;
  panicFrom: number;
  /** idle: seconds to the next thing it does, the hops left in the current one, progress in a hop */
  evIn: number;
  bobs: number;
  bobT: number;
  bobH: number;
  blinkIn: number;
  blinkT: number;
  startledIn: number;
  /** idle: seconds until it bobs because the other one was poked */
  reactIn: number;
  /** how far above its feet it is lifted this frame, so what stands on it can follow */
  lift: number;
  /** idle: it has stepped off its place and is due to go back */
  shuffled: boolean;
  /** thrown by a blast: spin in degrees a second, and the angle it has turned */
  spin: number;
  ang: number;
}

export function makeActor(
  name: Actor['name'],
  sprite: MascotSprite,
  letters: Letter[],
  landing: Letter,
  home: Letter,
  lavaY: number,
  unit: number,
): Actor {
  return {
    name,
    sprite,
    letters,
    queue: [],
    next: 0,
    landing,
    home,
    at: landing,
    x: landing.x + landing.w / 2 - (sprite.width * unit) / 2,
    y: 0,
    vy: 0,
    vx: 0,
    lavaY,
    mode: 'wait',
    then: 'fix',
    t: 0,
    sx: 1,
    sy: 1,
    leg: 0,
    hop: { x0: 0, y0: 0, x1: 0, y1: 0, dur: 1, h: 0 },
    panicFrom: 0,
    evIn: 2,
    bobs: 0,
    bobT: 0,
    bobH: 5,
    blinkIn: 2,
    blinkT: -1,
    startledIn: 0,
    reactIn: 0,
    lift: 0,
    shuffled: false,
    spin: 0,
    ang: 0,
  };
}

/** a bounce in place: n small hops, h px high */
export function bob(a: Actor, n: number, h: number): void {
  a.bobs = n;
  a.bobT = 0;
  a.bobH = h;
}

/** what a mode asks of the body this frame: lifted and turned, and the squash it is easing toward */
export interface Look {
  lift: number;
  tilt: number;
  tsx: number;
  tsy: number;
  blink: boolean;
}

export interface IdleCtx {
  dt: number;
  now: number;
  /** pixels per half cell */
  unit: number;
  ptr: { x: number; y: number };
  /** 0 to 1 while a blast is charging, else 0 */
  charge: number;
  /** nothing else on stage needs it to stay put */
  canWander: boolean;
  /** steps it off its place (or, when back, home); false when there is nowhere to step */
  wander(a: Actor, back: boolean): boolean;
  rand(): number;
}

/** breathing, blinking, hopping in place now and then, a step along the name and back, and a lean toward the pointer */
export function stepIdle(a: Actor, c: IdleCtx): Look {
  const w = a.sprite.width * c.unit;
  const h = a.sprite.height * c.unit;
  const phase = a.name === 'pi' ? 1.7 : 0;
  const look: Look = {
    lift: 0,
    tilt: 0,
    tsy: 1 + 0.03 * Math.sin(c.now / 650 + phase),
    tsx: 1 - 0.015 * Math.sin(c.now / 650 + phase),
    blink: false,
  };
  const dist = Math.hypot(c.ptr.x - (a.x + w / 2), c.ptr.y - (a.y - h / 2));
  const lean = Math.max(-1, Math.min(1, (c.ptr.x - (a.x + w / 2)) / 280));
  look.tilt = Math.abs(c.ptr.x) < 1e3 ? lean * (a.name === 'pi' ? 7 : 4) : 0;
  if (a.name === 'pi') look.tilt += 3 * Math.sin(c.now / 1100);
  if (c.charge > 0) {
    look.tilt += Math.sin(c.now / 22) * 2.5 * c.charge;
    look.tsy *= 1 - 0.12 * c.charge;
    look.tsx *= 1 + 0.08 * c.charge;
  }
  if (a.reactIn > 0) {
    a.reactIn -= c.dt;
    if (a.reactIn <= 0) bob(a, 1, 11);
  }
  a.startledIn -= c.dt;
  if (dist < 90 && a.startledIn <= 0 && a.bobs === 0) {
    a.startledIn = 3.5;
    bob(a, 2, 11);
  }
  a.evIn -= c.dt;
  if (a.evIn <= 0 && a.bobs === 0 && c.canWander) {
    const r = c.rand();
    if (a.shuffled) {
      c.wander(a, true);
      a.shuffled = false;
    } else if (r < 0.4) bob(a, 1, 6);
    else if (r < 0.65) bob(a, 2, 8);
    else if (c.wander(a, false)) a.shuffled = true;
    else bob(a, 1, 6);
    a.evIn = a.shuffled ? 1.1 + c.rand() * 0.7 : 2.2 + c.rand() * 2;
  }
  if (a.bobs > 0) {
    a.bobT += c.dt / 0.34;
    look.lift = Math.sin(Math.min(1, a.bobT) * Math.PI) * a.bobH;
    if (a.bobT < 0.2) [look.tsx, look.tsy] = [1.05, 0.92];
    else if (a.bobT < 0.85) [look.tsx, look.tsy] = [0.95, 1.07];
    if (a.bobT >= 1) {
      a.sx = 1.12;
      a.sy = 0.88;
      a.bobs--;
      a.bobT = 0;
    }
  }
  a.blinkIn -= c.dt;
  if (a.blinkIn <= 0) {
    a.blinkT = 0.13;
    a.blinkIn = c.rand() < 0.3 ? 0.25 : 2.5 + c.rand() * 2.5;
  }
  if (a.blinkT > 0) {
    look.blink = true;
    a.blinkT -= c.dt;
  }
  return look;
}
