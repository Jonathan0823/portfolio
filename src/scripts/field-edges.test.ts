import { describe, expect, it } from 'vitest';
import { fieldShape } from './field-edges';

const box = { top: 0, height: 300 };
describe('fieldShape', () => {
  it('drains a top field as you scroll away, but never empties it', () => {
    expect(fieldShape('hero', box, 0, 800, true).coverage).toBe(1);
    const mid = fieldShape('hero', box, 200, 800, true).coverage!;
    expect(mid).toBeLessThan(1);
    expect(fieldShape('hero', box, 5000, 800, true).coverage).toBeCloseTo(0.15);
    expect(mid).toBeGreaterThan(0.15);
  });

  it('raises the footer as it comes into view, and fades its page edge', () => {
    expect(fieldShape('foot', box, 0, 800, true).low).toBe(true);
    expect(fieldShape('foot', box, 0, 800, true).boil).toBe(true);
    expect(fieldShape('foot', { top: 900, height: 300 }, 0, 800, true).coverage).toBe(0);
    expect(fieldShape('foot', { top: 650, height: 300 }, 0, 800, true).coverage).toBeCloseTo(0.5);
    expect(fieldShape('foot', { top: 400, height: 300 }, 0, 800, true).coverage).toBe(1);
    expect(fieldShape('foot', box, 0, 800, true).fadeRows).toBeGreaterThan(0);
    expect(fieldShape('hero', box, 0, 800, true).fadeRows).toBeUndefined();
    expect(fieldShape('hero', box, 0, 800, true).runoff).toBe(true);
    expect(fieldShape('foot', box, 0, 800, true).runoff).toBeUndefined();
  });

  it('holds still under reduced motion', () => {
    expect(fieldShape('hero', box, 5000, 800, false).coverage).toBe(1);
    expect(fieldShape('foot', { top: 900, height: 300 }, 0, 800, false).coverage).toBe(1);
  });
});
