import { describe, expect, it } from 'vitest';
import { canRunTrail, prefersReducedMotion } from './motion';

const media = (on: string[]) => (q: string) => ({ matches: on.includes(q) });
const FINE = '(hover: hover) and (pointer: fine)';
const REDUCE = '(prefers-reduced-motion: reduce)';

describe('motion rules', () => {
  it('runs the trail only for a hovering fine pointer', () => {
    expect(canRunTrail(media([FINE]))).toBe(true);
    expect(canRunTrail(media([]))).toBe(false); // touch
  });

  it('turns the trail off under reduced motion even with a mouse', () => {
    expect(canRunTrail(media([FINE, REDUCE]))).toBe(false);
    expect(prefersReducedMotion(media([REDUCE]))).toBe(true);
    expect(prefersReducedMotion(media([]))).toBe(false);
  });
});
