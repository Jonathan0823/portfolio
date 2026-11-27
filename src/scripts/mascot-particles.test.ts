import { describe, expect, it } from 'vitest';
import { bubble, crossed, particleAt, spark, splash } from './mascot-particles';

describe('particles', () => {
  it('flings splash cells up and over, and they are gone when their time is up', () => {
    const cells = splash(10, 5, 4, 8, 3, () => 1);
    expect(cells).toHaveLength(4);
    const p = cells[0];
    const peak = particleAt(p, p.ms * 0.45)!;
    expect(peak.y).toBe(5 + p.up);
    expect(particleAt(p, 0)).toMatchObject({ x: 10, y: 5 });
    expect(particleAt(p, p.ms)).toBeNull();
    expect(particleAt(p, -1)).toBeNull();
  });

  it('swells a bubble as it rises and fades it out', () => {
    const b = bubble(3, 4);
    expect(particleAt(b, 0)!.size).toBeLessThan(particleAt(b, b.ms * 0.7)!.size);
    expect(particleAt(b, b.ms * 0.99)!.alpha).toBeLessThan(0.1);
  });

  it('flies a spark sideways over the gap, yellow then orange', () => {
    const s = spark(7, 2, 1, 6);
    expect(particleAt(s, 0)).toMatchObject({ x: 7, y: 3 - 1 });
    const late = particleAt(s, s.ms * 0.9)!;
    expect(late.x).toBeGreaterThan(7);
    expect(late.color).not.toBe(particleAt(s, 0)!.color);
  });
});

describe('crossed', () => {
  const beats = [{ at: 0 }, { at: 92 }];
  it('picks the beats in a span, start inclusive and end exclusive', () => {
    expect(crossed(beats, 0, 16)).toEqual([{ at: 0 }]);
    expect(crossed(beats, 16, 92)).toEqual([]);
    expect(crossed(beats, 80, 100)).toEqual([{ at: 92 }]);
  });
});
