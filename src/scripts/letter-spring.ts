// One letter of the headline as a pair of damped springs (its turn and its lift), so a knock wobbles back by itself.

export interface Spring {
  rot: number;
  vr: number;
  /** where the turn comes to rest: 0 is straight */
  tr: number;
  dy: number;
  vdy: number;
  tdy: number;
  /** being straightened: the spring is damped harder so it settles without wobbling about */
  fixing: boolean;
}

const STIFFNESS = 230;
const DAMPING = 7;
const DAMPING_FIXING = 17;

export function newSpring(): Spring {
  return { rot: 0, vr: 0, tr: 0, dy: 0, vdy: 0, tdy: 0, fixing: false };
}

/** advances the springs by dt seconds, in two half steps so a slow frame stays stable */
export function stepSpring(s: Spring, dt: number): void {
  const c = s.fixing ? DAMPING_FIXING : DAMPING;
  const h = dt / 2;
  for (let i = 0; i < 2; i++) {
    s.vr += (-STIFFNESS * (s.rot - s.tr) - c * s.vr) * h;
    s.rot += s.vr * h;
    s.vdy += (-STIFFNESS * (s.dy - s.tdy) - (c + 2) * s.vdy) * h;
    s.dy += s.vdy * h;
  }
}

/** true while it is bent, or still on its way to be */
export function isMoving(s: Spring): boolean {
  return Math.abs(s.rot) > 0.003 || Math.abs(s.vr) > 0.03 || Math.abs(s.dy) > 0.2 || s.tr !== 0 || s.tdy !== 0;
}

/** knocks it crooked: it comes to rest turned and lifted, scaled by amp (0 to 1); rand gives numbers in [0, 1) */
export function knock(s: Spring, amp: number, sign: 1 | -1, rand: () => number): void {
  s.fixing = false;
  s.tr = sign * (0.05 + 0.2 * amp) * (0.7 + 0.3 * rand());
  s.tdy = (rand() * 2 - 1) * 10 * amp;
  s.vr += sign * 4 * amp;
  s.vdy += (rand() * 2 - 1) * 220 * amp;
}

/** a nudge straight: it is told to rest at 0 and given a push the way it was leaning */
export function straighten(s: Spring): void {
  s.fixing = true;
  s.tr = 0;
  s.tdy = 0;
  s.vr += (s.rot > 0 ? -1 : 1) * 2.5;
}
