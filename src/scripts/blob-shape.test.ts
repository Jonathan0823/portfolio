import { describe, expect, it } from 'vitest';
import { levelForValue } from './blob-shape';

describe('levelForValue', () => {
  it('maps the rim to the darkest level and the core to the hottest', () => {
    expect(levelForValue(0.02, 0)).toBe(0);
    expect(levelForValue(0.99, 0)).toBe(5);
    let last = -1;
    for (let v = 0; v <= 1; v += 0.05) {
      const level = levelForValue(v, 0);
      expect(level).toBeGreaterThanOrEqual(last);
      last = level;
    }
  });
  it('flicker never leaves 0..5', () => {
    for (const j of [-1, 1])
      for (let v = 0; v <= 1; v += 0.1) {
        const l = levelForValue(v, j);
        expect(l).toBeGreaterThanOrEqual(0);
        expect(l).toBeLessThanOrEqual(5);
      }
  });
});
