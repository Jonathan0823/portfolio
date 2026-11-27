import { describe, expect, it } from 'vitest';
import { createField, stepField } from './pixel-math';
import { drips, sag } from './field-runoff';

const desktop = () => createField(1440, 336, 200);

/** lit cells under their column's surface: only drops reach there */
const hanging = (f: ReturnType<typeof desktop>) =>
  [...f.bucket.keys()].filter((i) => f.bucket[i] >= 0 && Math.floor(i / f.columns) > f.surface[i % f.columns]);

describe('runoff', () => {
  it('puts the drip points at different stages, so they take turns', () => {
    const phases = drips(144, 3, 1.3).map((d) => d.phase);
    expect(new Set(phases.map((p) => p.toFixed(2))).size).toBe(phases.length);
  });

  it('sags the surface only near a drip point', () => {
    const list = [{ column: 40, phase: 0.5 }];
    expect(sag(list, 40)).toBeGreaterThan(1);
    expect(sag(list, 60)).toBe(0);
  });

  it('keeps every drop above the headline', () => {
    const f = desktop();
    let seen = 0;
    for (let time = 0.1; time < 6; time += 0.17) {
      stepField(f, time, 1.3, 0.94, { runoff: true });
      const under = hanging(f);
      seen += under.length;
      for (const i of under) expect(Math.floor(i / f.columns)).toBeLessThan(f.hostRows);
    }
    expect(seen).toBeGreaterThan(0);
  });

  it('holds back while time is still, as under reduced motion', () => {
    const f = desktop();
    stepField(f, 0, 1.3, 0.94, { runoff: true });
    expect(hanging(f)).toHaveLength(0);
  });
});
