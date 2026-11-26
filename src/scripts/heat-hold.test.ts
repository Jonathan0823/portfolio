import { describe, expect, it } from 'vitest';
import { applyHolds, heldLevel, holdHeat } from './heat-hold';
import { createField } from './pixel-math';

describe('heldLevel', () => {
  const hold = { level: 0.8, from: 100, until: 1000, fade: 200 };

  it('is silent before the hold starts and after it ends', () => {
    expect(heldLevel(hold, 99)).toBe(0);
    expect(heldLevel(hold, 1000)).toBe(0);
  });

  it('holds its level, then fades over the last stretch', () => {
    expect(heldLevel(hold, 500)).toBe(0.8);
    expect(heldLevel(hold, 900)).toBeCloseTo(0.4, 10);
  });
});

describe('applyHolds', () => {
  it('raises the heat of a box of cells, never lowers it, and forgets expired holds', () => {
    const field = createField(200, 100);
    field.heat[0] = 0.95;
    holdHeat({ x0: 0, x1: 1, y0: 0, y1: 0, level: 0.66, from: 0, until: 500 });
    applyHolds(field, 100);
    expect(field.heat[0]).toBeCloseTo(0.95, 5);
    expect(field.heat[1]).toBeCloseTo(0.66, 5);
    expect(field.heat[2]).toBe(0);
    field.heat.fill(0);
    applyHolds(field, 600);
    applyHolds(field, 700);
    expect(field.heat[1]).toBe(0);
  });
});
