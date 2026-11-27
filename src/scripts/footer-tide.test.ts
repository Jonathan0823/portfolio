import { describe, expect, it } from 'vitest';
import { crestRow, cycleDelay, inCycle, nextCycleIndex } from './footer-tide';
import { FOOTER_BITMAPS } from './glyph-model';

describe('wave crest', () => {
  it('curves down from the middle to the sides and holds there', () => {
    expect(crestRow(20, 10, 30, 40, 3)).toBe(40);
    expect(crestRow(10, 10, 30, 40, 3)).toBe(37);
    expect(crestRow(30, 10, 30, 40, 3)).toBe(37);
    expect(crestRow(0, 10, 30, 40, 3)).toBe(37);
  });

  it('has footer logos no taller than 18 rows, each one even', () => {
    for (const rows of Object.values(FOOTER_BITMAPS)) {
      expect(rows.length).toBeLessThanOrEqual(18);
      expect(new Set(rows.map((row) => row.length)).size).toBe(1);
    }
  });
});

describe('touch cycle', () => {
  it('runs EGUIN, then each logo, then back to EGUIN', () => {
    const steps: number[] = [];
    let index = -1;
    for (let i = 0; i < 5; i++) steps.push((index = nextCycleIndex(index, 3)));
    expect(steps).toEqual([0, 1, 2, -1, 0]);
  });

  it('leaves the résumé out of the cycle', () => {
    expect((['mail', 'git', 'linkedin', 'resume'] as const).filter(inCycle)).toEqual(['mail', 'git', 'linkedin']);
  });

  it('rests on the wordmark for less time than a logo stands', () => {
    expect(cycleDelay(-1)).toBeLessThan(cycleDelay(0));
    expect(cycleDelay(1)).toBe(cycleDelay(0));
  });
});
