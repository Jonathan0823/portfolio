import { describe, expect, it } from 'vitest';
import {
  bandFraction,
  isWaiting,
  burstCell,
  insetClip,
  pointerFraction,
  revealFraction,
  sweepSchedule,
} from './skill-colour';

describe('revealFraction', () => {
  it('is full at the centre and gone at the radius', () => {
    expect(revealFraction(0, 180, 6)).toBe(1);
    expect(revealFraction(180, 180, 6)).toBe(0);
    expect(revealFraction(500, 180, 6)).toBe(0);
  });

  it('only takes the given number of steps and never grows with distance', () => {
    let last = 1;
    const seen = new Set<number>();
    for (let d = 0; d < 180; d += 3) {
      const f = revealFraction(d, 180, 6);
      expect(f).toBeLessThanOrEqual(last);
      expect(f).toBeGreaterThan(0);
      expect(Math.round(f * 6)).toBeCloseTo(f * 6);
      last = f;
      seen.add(f);
    }
    expect(seen.size).toBe(6);
  });
});

describe('insetClip', () => {
  it('shows the left share of the layer', () => {
    expect(insetClip(1)).toBe('inset(0 0% 0 0)');
    expect(insetClip(0.5)).toBe('inset(0 50% 0 0)');
    expect(insetClip(1 / 6)).toBe('inset(0 83.3% 0 0)');
  });

  it('hands back to the stylesheet when nothing shows', () => {
    expect(insetClip(0)).toBe('');
    expect(insetClip(-1)).toBe('');
  });
});

describe('pointerFraction', () => {
  const box = { left: 100, top: 100, width: 80, height: 80 };
  it('is full under the pointer, even off-centre', () => {
    expect(pointerFraction(101, 179, box)).toBe(1);
  });
  it('fades with the distance to the centre and ends at the radius', () => {
    const near = pointerFraction(140, 300, box);
    const far = pointerFraction(140, 400, box);
    expect(near).toBeGreaterThan(far);
    expect(pointerFraction(140, 140 + 180, box)).toBe(0);
  });
});

describe('bandFraction', () => {
  it('peaks on the viewport centre and ends 30% of the height away', () => {
    expect(bandFraction(400, 800)).toBe(1);
    expect(bandFraction(400 + 240, 800)).toBe(0);
    expect(bandFraction(400 - 100, 800)).toBe(bandFraction(400 + 100, 800));
    expect(bandFraction(400 + 100, 800)).toBeGreaterThan(bandFraction(400 + 200, 800));
  });
});

describe('sweepSchedule', () => {
  it('fills left to right and drains right to left', () => {
    const plan = sweepSchedule(4, 60, 600, 320);
    expect(plan.fill).toEqual([0, 60, 120, 180]);
    expect(plan.drain).toEqual([180, 120, 60, 0]);
  });

  it('holds before draining and ends once the last tile is clear', () => {
    const plan = sweepSchedule(4, 60, 600, 320);
    expect(plan.drainAt).toBe(180 + 320 + 600);
    expect(plan.endAt).toBe(plan.drainAt + 180 + 320);
  });

  it('copes with a single tile', () => {
    expect(sweepSchedule(1).fill).toEqual([0]);
  });
});

describe('burstCell', () => {
  const dist = (i: number, step: number) => {
    const { dx, dy } = burstCell(i, 12, step);
    return Math.hypot(dx, dy);
  };
  it('moves every cell outward each step', () => {
    for (let i = 0; i < 12; i++) for (let s = 0; s < 4; s++) expect(dist(i, s + 1)).toBeGreaterThan(dist(i, s));
  });
  it('is deterministic and spreads cells around the tile', () => {
    expect(burstCell(3, 12, 2)).toEqual(burstCell(3, 12, 2));
    const spots = new Set(Array.from({ length: 12 }, (_, i) => JSON.stringify(burstCell(i, 12, 2))));
    expect(spots.size).toBeGreaterThan(8);
  });
});

describe('isWaiting', () => {
  it('holds back tiles in a row that has not played its entrance', () => {
    expect(isWaiting({ closest: (s) => (s === '.skill-wait' ? {} : null) })).toBe(true);
    expect(isWaiting({ closest: () => null })).toBe(false);
  });
});
