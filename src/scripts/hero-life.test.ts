import { describe, expect, it } from 'vitest';
import { emptyDepth, igniteElapsed } from './hero-life';
import { IGNITE_MS } from './hero-ignite';

describe('igniteElapsed', () => {
  it('waits (-1) until the cover has dissolved and the ignite has started', () => {
    expect(igniteElapsed(-1, 5000)).toBe(-1);
  });

  it('counts ms since the start, and ends exactly when the ignite is over', () => {
    expect(igniteElapsed(1000, 1000)).toBe(0);
    expect(igniteElapsed(1000, 1500)).toBe(500);
    expect(igniteElapsed(1000, 1000 + IGNITE_MS - 1)).toBe(IGNITE_MS - 1);
    expect(igniteElapsed(1000, 1000 + IGNITE_MS)).toBeNull();
  });
});

describe('emptyDepth', () => {
  it('reaches below the horizon and past the tallest skyline, so the field is fully empty', () => {
    expect(emptyDepth(23, 34)).toBeCloseTo(23 + 34 * 0.22 + 14, 10);
    expect(emptyDepth(23, 34)).toBeGreaterThan(23);
  });
});
