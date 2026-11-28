import { describe, expect, it } from 'vitest';
import { isMoving, knock, newSpring, straighten, stepSpring } from './letter-spring';

const run = (s: ReturnType<typeof newSpring>, seconds: number) => {
  for (let t = 0; t < seconds; t += 1 / 60) stepSpring(s, 1 / 60);
};

describe('letter spring', () => {
  it('starts still', () => {
    expect(isMoving(newSpring())).toBe(false);
  });

  it('is knocked to a crooked rest, in the direction given and scaled by amp', () => {
    const near = newSpring();
    const far = newSpring();
    knock(near, 1, 1, () => 0.5);
    knock(far, 0.35, 1, () => 0.5);
    expect(near.tr).toBeGreaterThan(far.tr);
    expect(far.tr).toBeGreaterThan(0);
    const left = newSpring();
    knock(left, 1, -1, () => 0.5);
    expect(left.tr).toBeLessThan(0);
  });

  it('settles at its crooked rest and stays there', () => {
    const s = newSpring();
    knock(s, 1, 1, () => 0.5);
    run(s, 3);
    expect(s.rot).toBeCloseTo(s.tr, 2);
    expect(s.dy).toBeCloseTo(s.tdy, 1);
  });

  it('is straightened back to exactly upright without swinging past it for long', () => {
    const s = newSpring();
    knock(s, 1, 1, () => 0.5);
    run(s, 2);
    straighten(s);
    run(s, 2);
    expect(Math.abs(s.rot)).toBeLessThan(0.003);
    expect(Math.abs(s.dy)).toBeLessThan(0.2);
    expect(s.tr).toBe(0);
  });

  it('counts as moving while knocked or wobbling, and not once straight and still', () => {
    const s = newSpring();
    knock(s, 1, 1, () => 0.5);
    expect(isMoving(s)).toBe(true);
    straighten(s);
    run(s, 3);
    expect(isMoving(s)).toBe(false);
  });
});
