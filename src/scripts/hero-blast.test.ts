import { describe, expect, it } from 'vitest';
import { BLAST_MIN_MS, chargeOf, floorUnder, throwOf } from './hero-blast';

describe('chargeOf', () => {
  it('builds from nothing after a short hold to full a second later', () => {
    expect(chargeOf(0)).toBe(0);
    expect(chargeOf(200)).toBe(0);
    expect(chargeOf(700)).toBeCloseTo(0.5, 10);
    expect(chargeOf(1200)).toBe(1);
    expect(chargeOf(9000)).toBe(1);
  });

  it('has begun by the time a press stops being a click', () => {
    expect(chargeOf(BLAST_MIN_MS)).toBeGreaterThan(0);
  });
});

describe('throwOf', () => {
  const blast = { x: 100, y: 100 };
  const never = () => 0.9;

  it('throws away from the blast, and up', () => {
    const right = throwOf(blast, { x: 400, y: 120 }, 1, never);
    const left = throwOf(blast, { x: -200, y: 120 }, 1, never);
    expect(right.vx).toBeGreaterThan(0);
    expect(right.spin).toBeGreaterThan(0);
    expect(left.vx).toBeLessThan(0);
    expect(left.spin).toBeLessThan(0);
    expect(right.vy).toBeLessThan(0);
  });

  it('throws harder for a fuller charge and softer from far away', () => {
    const at = { x: 400, y: 120 };
    expect(throwOf(blast, at, 1, never).vx).toBeGreaterThan(throwOf(blast, at, 0, never).vx);
    expect(throwOf(blast, { x: 300, y: 120 }, 1, never).vx).toBeGreaterThan(
      throwOf(blast, { x: 1500, y: 120 }, 1, never).vx,
    );
  });

  it('still reaches what is far away', () => {
    expect(throwOf(blast, { x: 5000, y: 100 }, 0, never).vx).toBeGreaterThan(100);
    expect(throwOf(blast, { x: 5000, y: 100 }, 0, never).vy).toBeLessThan(-200);
  });

  it('picks a side from what rand says when straight above or below', () => {
    expect(throwOf(blast, { x: 100, y: 300 }, 1, () => 0.1).vx).toBeLessThan(0);
    expect(throwOf(blast, { x: 100, y: 300 }, 1, () => 0.9).vx).toBeGreaterThan(0);
  });
});

describe('floorUnder', () => {
  const tops = [
    { x: 0, w: 50, top: 100 },
    { x: 0, w: 50, top: 300 },
    { x: 60, w: 50, top: 310 },
  ];

  it('lands on the first top below it', () => {
    expect(floorUnder(tops, 20, 50, 999)).toBe(100);
    expect(floorUnder(tops, 20, 150, 999)).toBe(300);
  });

  it('never snaps up to a top it is already below', () => {
    expect(floorUnder(tops, 20, 305, 999)).toBe(999);
  });

  it('keeps falling past a gap between letters, until the fallback', () => {
    expect(floorUnder(tops, 55, 50, 999)).toBe(999);
  });
});
