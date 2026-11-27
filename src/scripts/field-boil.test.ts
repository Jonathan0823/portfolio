import { describe, expect, it } from 'vitest';
import { createField, stepField } from './pixel-math';
import { bubbles, dome } from './field-boil';

const footer = () => createField(1440, 200, 320);
const shape = { low: true, boil: true };

/** lit cells under their column's surface: only thrown droplets reach there */
const thrown = (f: ReturnType<typeof footer>) =>
  [...f.bucket.keys()].filter((i) => f.bucket[i] >= 0 && Math.floor(i / f.columns) > f.surface[i % f.columns]);

describe('boil', () => {
  it('swells a bubble and collapses it after the pop', () => {
    const at = (phase: number) => dome([{ column: 20, phase, half: 4, tall: 5 }], 20);
    expect(at(0.3)).toBeGreaterThan(at(0.1));
    expect(at(0.61)).toBeGreaterThan(4);
    expect(at(0.8)).toBe(0);
    expect(dome([{ column: 20, phase: 0.5, half: 4, tall: 5 }], 30)).toBe(0);
  });

  it('puts the bubbles at different stages', () => {
    const phases = bubbles(144, 3, 8.1).map((b) => b.phase);
    expect(new Set(phases.map((p) => p.toFixed(2))).size).toBe(phases.length);
  });

  it('throws droplets above the surface, but never into a letter', () => {
    const f = footer();
    let seen = 0;
    for (let time = 0.1; time < 4; time += 0.13) {
      stepField(f, time, 8.1, 0.94, shape);
      seen += thrown(f).length;
      const mold = new Int8Array(f.columns * f.rows).fill(1);
      stepField(f, time, 8.1, 0.94, { ...shape, mold });
      // every cell above the surface keeps the letter's colour
      expect(thrown(f).every((i) => f.bucket[i] === 0)).toBe(true);
    }
    expect(seen).toBeGreaterThan(0);
  });

  it('holds back while time is still, as under reduced motion', () => {
    const f = footer();
    stepField(f, 0, 8.1, 0.94, shape);
    expect(thrown(f)).toHaveLength(0);
  });
});
