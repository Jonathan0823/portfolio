import { describe, expect, it } from 'vitest';
import { IGNITE_MS, pourDelay, pourFront, rimLevel } from './hero-ignite';

describe('pour', () => {
  it('starts the whole width within a quarter of a second', () => {
    for (let x = 0; x < 200; x++) {
      expect(pourDelay(x)).toBeGreaterThanOrEqual(0);
      expect(pourDelay(x)).toBeLessThanOrEqual(250);
      expect(pourFront(x, 600, 20)).toBeGreaterThan(0);
    }
  });

  it('only ever moves down, and has landed everywhere before the hand-off', () => {
    for (let x = 0; x < 200; x += 7) {
      let last = 0;
      for (let t = 0; t <= IGNITE_MS; t += 50) {
        const front = pourFront(x, t, 20);
        expect(front).toBeGreaterThanOrEqual(last);
        last = front;
      }
      expect(last).toBe(20);
    }
  });

  it('keeps yellow, then orange, then red on the leading edge', () => {
    expect([1, 3, 6, 12].map(rimLevel)).toEqual([5, 4, 3, 0]);
  });
});
