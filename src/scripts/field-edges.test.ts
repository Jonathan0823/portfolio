import { describe, expect, it } from 'vitest';
import { NAV_BAND, fieldShape } from './field-edges';

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

  it('stretches the dark band down by however far the field has scrolled under the nav', () => {
    expect(fieldShape('hero', box, 0, 800, true).darkTop).toBe(NAV_BAND);
    expect(fieldShape('hero', { top: -120, height: 300 }, 120, 800, true).darkTop).toBe(NAV_BAND + 120);
    expect(fieldShape('strip', { top: -40, height: 300 }, 40, 800, false).darkTop).toBe(NAV_BAND + 40);
    expect(fieldShape('hero', { top: 30, height: 300 }, 0, 800, true).darkTop).toBe(NAV_BAND);
  });

  it('holds still under reduced motion', () => {
    expect(fieldShape('hero', box, 5000, 800, false).coverage).toBe(1);
    expect(fieldShape('foot', { top: 900, height: 300 }, 0, 800, false).coverage).toBe(1);
  });
});
