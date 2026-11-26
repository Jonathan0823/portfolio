import { describe, expect, it } from 'vitest';
import { IGNITE_MS, coolLevel, igniteArrival, igniteLevel, igniteOrigin } from './hero-ignite';

describe('coolLevel', () => {
  it('steps from the hot level down to the resting one', () => {
    expect(coolLevel(5, 2, 0)).toBe(5);
    expect(coolLevel(5, 2, 1)).toBe(2);
    expect(coolLevel(5, 2, 2)).toBe(2);
    const steps = [0, 0.25, 0.5, 0.75, 1].map((k) => coolLevel(5, 1, k));
    expect([...steps].sort((a, b) => b - a)).toEqual(steps);
  });
});

describe('igniteOrigin', () => {
  it('lands left of centre on a desktop and centred below the header pills on a phone', () => {
    expect(igniteOrigin(144, 23, 10)).toEqual({ x: 43, y: 10 });
    const phone = igniteOrigin(49, 25, 8);
    expect(phone.x).toBe(24);
    expect(phone.y).toBe(11);
  });
});

describe('igniteArrival', () => {
  it('reaches the spark first, then floods outward to finish before the ignite ends', () => {
    expect(igniteArrival(0, 100)).toBe(380);
    expect(igniteArrival(50, 100)).toBeGreaterThan(igniteArrival(10, 100));
    expect(igniteArrival(100, 100)).toBeLessThan(IGNITE_MS);
    expect(igniteArrival(900, 100)).toBe(igniteArrival(100, 100));
    expect(igniteArrival(-5, 100)).toBe(380);
  });

  it('leaves every cell its full cooling before the hand-off', () => {
    expect(igniteArrival(100, 100) + 520).toBeLessThanOrEqual(IGNITE_MS);
  });
});

describe('igniteLevel', () => {
  it('flashes yellow or orange on arrival, then cools to the resting level', () => {
    expect(igniteLevel(0, 2, 0.9)).toBe(5);
    expect(igniteLevel(0, 2, 0.1)).toBe(4);
    expect(igniteLevel(1000, 2, 0.9)).toBe(2);
    expect(igniteLevel(1000, 0, 0.9)).toBe(0);
  });
});
