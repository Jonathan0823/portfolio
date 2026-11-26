import { describe, expect, it } from 'vitest';
import { idleRing, ringValue, stepRing, type RingShape } from './cursor-ring';

const blob = { x: 0, y: 0, radius: 10 };
const goal: RingShape = { x: 40, y: 0, outer: 20, inner: 18.8, gap: 0.32 };

describe('stepRing', () => {
  it('stays idle with no magnet', () => {
    const r = idleRing();
    stepRing(r, null, blob, 1);
    expect(r.active).toBe(false);
  });

  it('starts as the blob, so the hand-off does not jump', () => {
    const r = idleRing();
    stepRing(r, goal, blob, 0);
    expect(r).toMatchObject({ active: true, x: 0, y: 0, outer: 10, inner: 0, gap: 0 });
  });

  it('grows before it hollows, and hollows before the gaps open', () => {
    const r = idleRing();
    stepRing(r, goal, blob, 1);
    const early = { ...r };
    for (let i = 0; i < 60; i++) stepRing(r, goal, blob, 1);
    expect(early.inner / goal.inner).toBeLessThan(early.outer / goal.outer);
    expect(early.gap).toBeLessThan(0.01);
    expect(r.outer).toBeCloseTo(goal.outer, 0);
    expect(r.inner).toBeCloseTo(goal.inner, 0);
    expect(r.gap).toBeCloseTo(goal.gap, 1);
    expect(r.mix).toBeGreaterThan(0.99);
  });

  it('folds back into the blob and then hands over', () => {
    const r = idleRing();
    for (let i = 0; i < 60; i++) stepRing(r, goal, blob, 1);
    let frames = 0;
    while (r.active && frames < 200) (stepRing(r, null, blob, 1), frames++);
    expect(r.active).toBe(false);
    expect(r.mix).toBe(0);
    expect(frames).toBeLessThan(60);
  });
});

describe('ringValue', () => {
  it('is a solid disc before hollowing and empty in the middle after', () => {
    const r = idleRing();
    stepRing(r, goal, blob, 0);
    expect(ringValue(r, 0, 0, 0)).not.toBeNull();
    for (let i = 0; i < 60; i++) stepRing(r, goal, { ...blob, x: 40 }, 1);
    expect(ringValue(r, 0, 0, 0)).toBeNull();
    expect(ringValue(r, 0, goal.outer + 2, 0)).toBeNull();
  });
});
