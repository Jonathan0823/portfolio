import { describe, expect, it } from 'vitest';
import {
  FRAME_MS,
  UNDER,
  UP,
  advancePresence,
  advanceTravel,
  emergeMs,
  nextDue,
  presencePose,
  sinkMs,
  staticPresence,
  startTravel,
  steer,
  stepMs,
  sunkFloor,
  travelEnd,
  travelPose,
  type Pose,
} from './mascot-motion';
import { CLAWD, PI } from './mascot-sprites';

const home = { P: 40, F: 20 };
const sunk = sunkFloor(PI, 0.5);

const rise = (sprite = PI) => steer(sprite, UNDER, true, null, home, sunkFloor(sprite, 0.5));

describe('sunkFloor', () => {
  it('puts a sprite wholly under a surface that stands `wade` rows over the base', () => {
    for (const sprite of [CLAWD, PI]) {
      const floor = sunkFloor(sprite, 0.5);
      expect(floor + sprite.height).toBeLessThanOrEqual(2 * 1.5);
    }
  });
});

describe('emerging', () => {
  it('starts hidden, beside its place, wholly under the lava', () => {
    const p = rise();
    expect(p.phase).toBe('emerging');
    expect(p.from.F).toBe(sunk);
    expect(Math.abs(p.from.P - home.P)).toBe(7);
    expect(presencePose(PI, p, home, sunk)!.F).toBe(sunk);
  });

  it('waits out a delay hidden, then bursts out', () => {
    const p = steer(PI, UNDER, true, null, home, sunk, 250);
    expect(presencePose(PI, p, home, sunk)).toBeNull();
    const later = advancePresence(PI, p, 300);
    expect(later.phase).toBe('emerging');
    expect(presencePose(PI, later, home, sunk)).not.toBeNull();
  });

  it('arcs above where it lands, then lands on its place and stands', () => {
    let p = rise();
    let peak = -Infinity;
    for (let t = 0; t < emergeMs(PI) - 1; t += FRAME_MS) {
      peak = Math.max(peak, presencePose(PI, p, home, sunk)!.F);
      p = advancePresence(PI, p, FRAME_MS);
    }
    expect(peak).toBeGreaterThan(home.F);
    p = advancePresence(PI, p, emergeMs(PI));
    expect(p.phase).toBe('up');
    expect(presencePose(PI, p, home, sunk)).toMatchObject(home);
  });

  it('ends exactly on its place even mid-flail for a walker', () => {
    const p = advancePresence(CLAWD, rise(CLAWD), emergeMs(CLAWD));
    expect(presencePose(CLAWD, p, home, sunkFloor(CLAWD, 0.5))).toMatchObject(home);
  });
});

describe('sinking', () => {
  const standing = { ...UP };

  it('flails and slumps to under the lava, then is gone', () => {
    let p = steer(PI, standing, false, { ...home, sx: 1, sy: 1, tilt: 0, leg: 0 }, home, sunk);
    expect(p.phase).toBe('sinking');
    const mid = presencePose(PI, advancePresence(PI, p, sinkMs() / 2), home, sunk)!;
    expect(mid.tilt).toBeLessThan(0);
    expect(mid.F).toBeLessThan(home.F);
    p = advancePresence(PI, p, sinkMs());
    expect(p.phase).toBe('under');
    expect(presencePose(PI, p, home, sunk)).toBeNull();
  });

  it('keeps a standing mascot standing until told to sink', () => {
    expect(steer(PI, standing, true, null, home, sunk)).toBe(standing);
    expect(steer(PI, UNDER, false, null, home, sunk)).toBe(UNDER);
  });
});

describe('reversal', () => {
  it('turns a sink into a rise from where it is drawn, with no jump', () => {
    const current = { ...home, sx: 1, sy: 1, tilt: 0, leg: 0 as const };
    let p = steer(PI, UP, false, current, home, sunk);
    p = advancePresence(PI, p, sinkMs() * 0.6);
    const drawn = presencePose(PI, p, home, sunk)!;
    const back = steer(PI, p, true, drawn, home, sunk);
    expect(back.phase).toBe('emerging');
    expect(back.from).toEqual({ P: drawn.P, F: drawn.F });
    expect(presencePose(PI, back, home, sunk)).toMatchObject({ P: drawn.P, F: drawn.F });
  });

  it('turns a rise into a sink from where it is drawn', () => {
    let p = advancePresence(PI, rise(), emergeMs(PI) * 0.5);
    const drawn = presencePose(PI, p, home, sunk)!;
    p = steer(PI, p, false, drawn, home, sunk);
    expect(p.phase).toBe('sinking');
    expect(presencePose(PI, p, home, sunk)).toMatchObject({ P: drawn.P, F: drawn.F });
  });

  it('rises from beside its place again once a sink has fully finished', () => {
    const under = { ...UNDER, from: { P: 1, F: 1 } };
    const p = steer(PI, under, true, null, home, sunk);
    expect(p.from).toEqual({ P: home.P + PI.gait.kick * 7, F: sunk });
  });

  it('starts fresh if the mascot is drawn wholly under the lava', () => {
    const drawn: Pose = { P: 3, F: sunk, sx: 1, sy: 1, tilt: 0, leg: 0 };
    const p = steer(PI, { ...UNDER, phase: 'sinking' }, true, drawn, home, sunk);
    expect(p.from.P).toBe(home.P + PI.gait.kick * 7);
  });
});

describe('reduced motion', () => {
  it('is on its place while the word is up and gone while it is down, with no animation between', () => {
    expect(staticPresence(true)).toBe(UP);
    expect(staticPresence(false)).toBe(UNDER);
    expect(presencePose(PI, staticPresence(true), home, sunk)).toMatchObject(home);
    expect(presencePose(PI, staticPresence(false), home, sunk)).toBeNull();
  });
});

describe('travel', () => {
  const clearance = () => 0;

  it('walks a step at a time, alternating legs, and ends on the last step', () => {
    const steps = [
      { P: 41, F: 20, kind: 'walk' as const },
      { P: 42, F: 20, kind: 'walk' as const },
    ];
    let tr = startTravel({ P: 40, F: 20 }, steps);
    const legs = [travelPose(CLAWD, tr, clearance).leg];
    tr = advanceTravel(CLAWD, tr, stepMs(CLAWD, { P: 40, F: 20 }, steps[0]))!;
    legs.push(travelPose(CLAWD, tr, clearance).leg);
    expect(legs).toEqual([1, 0]);
    expect(travelPose(CLAWD, tr, clearance)).toMatchObject({ P: 42, F: 20 });
    expect(advanceTravel(CLAWD, tr, 1000)).toBeNull();
    expect(travelEnd(tr)).toEqual({ P: 42, F: 20 });
  });

  it('hops: crouches, arcs over the clearance, lands squashed, and rests', () => {
    const from = { P: 20, F: 20 };
    const step = { P: 50, F: 12, kind: 'hop' as const };
    let tr = startTravel(from, [step]);
    expect(travelPose(PI, tr, clearance)).toMatchObject({ P: 20, F: 20, sx: PI.gait.crouch[0] });
    let peak = 0;
    const total = stepMs(PI, from, step);
    for (let t = 0; t < total - 1; t += 10) {
      const next = advanceTravel(PI, tr, 10);
      if (!next) break;
      tr = next;
      peak = Math.max(peak, travelPose(PI, tr, clearance).F);
    }
    expect(peak).toBeGreaterThan(20);
    expect(travelPose(PI, tr, clearance)).toMatchObject({ P: 50, F: 12 });
  });

  it('never dips below the clearance in flight', () => {
    const from = { P: 20, F: 12 };
    const step = { P: 50, F: 12, kind: 'hop' as const };
    let tr: ReturnType<typeof startTravel> | null = startTravel(from, [step]);
    while (tr) {
      const pose = travelPose(PI, tr, (P) => (P > 30 && P < 40 ? 24 : 0));
      if (pose.P > 30 && pose.P < 40 && pose.P !== 50) expect(pose.F).toBeGreaterThanOrEqual(24);
      tr = advanceTravel(PI, tr, 10);
    }
  });
});

describe('nextDue', () => {
  it('draws the first due time without firing, then fires once it passes', () => {
    const first = nextDue(1000, 0, 100, 200, () => 0.5);
    expect(first).toEqual({ fire: false, due: 1150 });
    expect(nextDue(1100, first.due, 100, 200, () => 0)).toEqual({ fire: false, due: 1150 });
    expect(nextDue(1200, first.due, 100, 200, () => 0)).toEqual({ fire: true, due: 1300 });
  });
});
