import { describe, expect, it } from 'vitest';
import { decayFactor, easeFactor, frameScale, smoothVelocity } from './timing';

describe('frameScale', () => {
  it('is 1 at 60 fps, 0.5 at 120 fps', () => {
    expect(frameScale(1000 / 60)).toBeCloseTo(1);
    expect(frameScale(1000 / 120)).toBeCloseTo(0.5);
  });
  it('clamps stalls and bad input', () => {
    expect(frameScale(5000)).toBeCloseTo(6);
    expect(frameScale(-3)).toBe(0);
  });
});

describe('easing', () => {
  it('two half frames equal one frame', () => {
    const half = easeFactor(0.35, 0.5);
    expect(1 - (1 - half) ** 2).toBeCloseTo(0.35);
    expect(decayFactor(0.94, 0.5) ** 2).toBeCloseTo(0.94);
  });
});

describe('smoothVelocity', () => {
  it('eases for same-direction movement', () => {
    const v = smoothVelocity({ x: 10, y: 0 }, { x: 20, y: 0 }, 0.18, 1);
    expect(v.x).toBeCloseTo(11.8);
  });
  it('snaps on reversal instead of passing through zero', () => {
    expect(smoothVelocity({ x: 10, y: 0 }, { x: -10, y: 0 }, 0.18, 1)).toEqual({ x: -10, y: 0 });
  });
  it('does not snap for tiny opposing jitter', () => {
    const v = smoothVelocity({ x: 10, y: 0 }, { x: -0.5, y: 0 }, 0.18, 1);
    expect(v.x).toBeGreaterThan(5);
  });
});
