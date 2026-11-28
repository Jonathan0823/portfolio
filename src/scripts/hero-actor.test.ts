import { describe, expect, it, vi } from 'vitest';
import { bob, makeActor, stepIdle, type IdleCtx } from './hero-actor';
import { CLAWD } from './mascot-sprites';
import type { Letter } from './hero-headline';

const letter = { x: 100, w: 50, top: 300 } as Letter;
const actor = () => {
  const a = makeActor('clawd', CLAWD, [letter], letter, letter, 0, 5);
  a.mode = 'idle';
  a.y = 300;
  return a;
};
const ctx = (over: Partial<IdleCtx> = {}): IdleCtx => ({
  dt: 0.016,
  now: 0,
  unit: 5,
  ptr: { x: -1e4, y: -1e4 },
  charge: 0,
  canWander: true,
  wander: () => false,
  rand: () => 0.5,
  ...over,
});

describe('stepIdle', () => {
  it('breathes: the squash follows the clock', () => {
    const a = actor();
    const rest = stepIdle(a, ctx({ now: 0 }));
    const full = stepIdle(a, ctx({ now: 650 * (Math.PI / 2) }));
    expect(rest.tsy).toBeCloseTo(1, 5);
    expect(full.tsy).toBeCloseTo(1.03, 3);
  });

  it('leans toward the pointer, and stands upright when there is none', () => {
    const a = actor();
    expect(stepIdle(a, ctx()).tilt).toBe(0);
    expect(stepIdle(a, ctx({ ptr: { x: a.x + 500, y: 300 } })).tilt).toBeGreaterThan(0);
    expect(stepIdle(a, ctx({ ptr: { x: a.x - 500, y: 300 } })).tilt).toBeLessThan(0);
  });

  it('jumps and lifts on a bob, and lands after it', () => {
    const a = actor();
    bob(a, 1, 10);
    const mid = stepIdle(a, ctx({ dt: 0.17 }));
    expect(mid.lift).toBeCloseTo(10 * Math.sin(Math.PI * 0.5), 1);
    stepIdle(a, ctx({ dt: 0.2 }));
    expect(a.bobs).toBe(0);
  });

  it('is startled once by a pointer that comes close, then not again for a while', () => {
    const a = actor();
    const near = { x: a.x + 10, y: a.y - 20 };
    stepIdle(a, ctx({ ptr: near }));
    expect(a.bobs).toBe(2);
    a.bobs = 0;
    stepIdle(a, ctx({ ptr: near }));
    expect(a.bobs).toBe(0);
  });

  it('bobs when the other one was poked, a beat after', () => {
    const a = actor();
    a.reactIn = 0.1;
    stepIdle(a, ctx({ dt: 0.05 }));
    expect(a.bobs).toBe(0);
    stepIdle(a, ctx({ dt: 0.06 }));
    expect(a.bobs).toBe(1);
  });

  it('blinks for a moment now and then', () => {
    const a = actor();
    a.blinkIn = 0.01;
    expect(stepIdle(a, ctx({ dt: 0.02 })).blink).toBe(true);
    stepIdle(a, ctx({ dt: 0.2 }));
    expect(stepIdle(a, ctx({ dt: 0.2 })).blink).toBe(false);
  });

  it('steps off its place when it can, and goes back next time', () => {
    const a = actor();
    const wander = vi.fn(() => true);
    a.evIn = 0;
    stepIdle(a, ctx({ wander, rand: () => 0.9 }));
    expect(wander).toHaveBeenLastCalledWith(a, false);
    expect(a.shuffled).toBe(true);
    a.evIn = 0;
    stepIdle(a, ctx({ wander }));
    expect(wander).toHaveBeenLastCalledWith(a, true);
    expect(a.shuffled).toBe(false);
  });

  it('only bobs when there is nowhere to step, and stays put while something else needs it to', () => {
    const a = actor();
    a.evIn = 0;
    stepIdle(a, ctx({ rand: () => 0.9 }));
    expect(a.shuffled).toBe(false);
    expect(a.bobs).toBe(1);
    const b = actor();
    b.evIn = 0;
    stepIdle(b, ctx({ canWander: false }));
    expect(b.bobs).toBe(0);
  });

  it("squints for a click's jump but not an idle hop, and while a blast charges", () => {
    const a = actor();
    bob(a, 1, 5);
    expect(stepIdle(a, ctx({ dt: 0.05 })).blink).toBe(false);
    bob(a, 1, 24);
    expect(stepIdle(a, ctx({ dt: 0.05 })).blink).toBe(true);
    const b = actor();
    expect(stepIdle(b, ctx({ charge: 0.2 })).blink).toBe(false);
    expect(stepIdle(b, ctx({ charge: 0.6 })).blink).toBe(true);
  });

  it('quivers while a blast charges', () => {
    const a = actor();
    const calm = stepIdle(a, ctx({ now: 11 }));
    const held = stepIdle(a, ctx({ now: 11, charge: 1 }));
    expect(held.tsy).toBeLessThan(calm.tsy);
    expect(held.tilt).not.toBe(calm.tilt);
  });
});
