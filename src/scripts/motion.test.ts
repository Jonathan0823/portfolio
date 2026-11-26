import { describe, expect, it } from 'vitest';
import { canRunCursor, prefersReducedMotion } from './motion';

const media = (on: string[]) => (q: string) => ({ matches: on.includes(q) });
const FINE = '(hover: hover) and (pointer: fine)';
const REDUCE = '(prefers-reduced-motion: reduce)';

describe('motion rules', () => {
  it('draws the cursor only for a hovering fine pointer', () => {
    expect(canRunCursor(media([FINE]))).toBe(true);
    expect(canRunCursor(media([]))).toBe(false);
  });

  it('keeps the system cursor under reduced motion even with a mouse', () => {
    expect(canRunCursor(media([FINE, REDUCE]))).toBe(false);
    expect(prefersReducedMotion(media([REDUCE]))).toBe(true);
    expect(prefersReducedMotion(media([]))).toBe(false);
  });
});
