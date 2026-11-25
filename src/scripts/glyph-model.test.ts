import { describe, expect, it } from 'vitest';
import { BITMAPS, assignPixels, pickSourceColumns } from './glyph-model';

describe('pickSourceColumns', () => {
  it('picks the highest local peaks first, at least 5 columns apart, at most 5', () => {
    const low = new Array(32).fill(14);
    low[4] = 20; low[10] = 30; low[12] = 25; low[20] = 22; low[27] = 18;
    const picks = pickSourceColumns(low);
    expect(picks[0]).toBe(10);
    expect(picks).not.toContain(12);
    expect(picks).toEqual(expect.arrayContaining([4, 20, 27]));
    for (let a = 0; a < picks.length; a++) for (let b = a + 1; b < picks.length; b++) expect(Math.abs(picks[a] - picks[b])).toBeGreaterThanOrEqual(5);
    expect(picks.length).toBeLessThanOrEqual(5);
  });

  it('falls back to the centre column when there is no interior candidate', () => {
    expect(pickSourceColumns([10, 10])).toEqual([1]);
  });
});

describe('assignPixels', () => {
  it('gives every lit glyph pixel to exactly one source, the nearest column', () => {
    const lit = (n: keyof typeof BITMAPS) => BITMAPS[n].rows.join('').split('#').length - 1;
    for (const name of ['mail', 'git', 'cv'] as const) {
      const g = BITMAPS[name];
      const per = assignPixels(g, 32, 38, [3, 16, 28]);
      expect(per.flat().length).toBe(lit(name) * g.scale * g.scale);
      per.forEach((list, k) => list.forEach(p => {
        const own = Math.abs(p.column - [3, 16, 28][k]);
        for (const sx of [3, 16, 28]) expect(own).toBeLessThanOrEqual(Math.abs(p.column - sx));
      }));
    }
  });
});
