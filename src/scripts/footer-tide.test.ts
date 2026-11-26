import { describe, expect, it } from 'vitest';
import { cycleDelay, inCycle, nextCycleIndex } from './footer-tide';

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
