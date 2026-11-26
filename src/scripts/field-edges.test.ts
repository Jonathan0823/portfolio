import { describe, expect, it } from 'vitest';
import { EMBER_REACH, emberAlpha, emberRate, fieldShape, spawnEmber, stepEmbers, type Ember } from './field-edges';

const box = { top: 0, height: 300 };
const never = () => false;
const seq = (...values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length];
};

describe('fieldShape', () => {
  it('drains a top field as you scroll away, but never empties it', () => {
    expect(fieldShape('hero', box, 0, 800, true).coverage).toBe(1);
    const mid = fieldShape('hero', box, 200, 800, true).coverage!;
    expect(mid).toBeLessThan(1);
    expect(fieldShape('hero', box, 5000, 800, true).coverage).toBeCloseTo(0.15);
    expect(mid).toBeGreaterThan(0.15);
  });

  it('raises the footer as it comes into view, and fades its page edge', () => {
    expect(fieldShape('foot', { top: 900, height: 300 }, 0, 800, true).coverage).toBe(0);
    expect(fieldShape('foot', { top: 650, height: 300 }, 0, 800, true).coverage).toBeCloseTo(0.5);
    expect(fieldShape('foot', { top: 400, height: 300 }, 0, 800, true).coverage).toBe(1);
    expect(fieldShape('foot', box, 0, 800, true).fadeEdge).toBeGreaterThan(0);
    expect(fieldShape('hero', box, 0, 800, true).fadeEdge).toBeUndefined();
  });

  it('holds still under reduced motion', () => {
    expect(fieldShape('hero', box, 5000, 800, false).coverage).toBe(1);
    expect(fieldShape('foot', { top: 900, height: 300 }, 0, 800, false).coverage).toBe(1);
  });
});

describe('emberRate', () => {
  it('is a rare drip at rest, more from hot columns', () => {
    expect(emberRate(1, 0, 0)).toBeLessThan(0.001);
    expect(emberRate(4, 0, 0)).toBeGreaterThan(emberRate(1, 0, 0));
  });

  it('bursts while scrolling and sparks where the cursor heated', () => {
    expect(emberRate(4, 0, 60)).toBeGreaterThan(emberRate(4, 0, 0) * 10);
    expect(emberRate(1, 0.9, 0)).toBeGreaterThan(0.05);
    expect(emberRate(1, 0.4, 0)).toBe(emberRate(1, 0, 0));
  });
});

describe('embers', () => {
  it('fall, fade with distance, and are gone by EMBER_REACH rows', () => {
    let embers: Ember[] = [spawnEmber(10, 5, 4, seq(0.5, 0.5))];
    expect(emberAlpha(embers[0])).toBe(1);
    let steps = 0;
    while (embers.length && steps < 500) ((embers = stepEmbers(embers, 1, never, 40, 60)), steps++);
    expect(embers).toHaveLength(0);
    expect(steps).toBeLessThanOrEqual(EMBER_REACH / 0.1 + 1);
  });

  it('never cool to a dark colour', () => {
    expect(spawnEmber(0, 0, 0, seq(0.5)).level).toBe(3);
  });

  it('slide around content instead of falling onto it', () => {
    // a block under columns 8..14 at row 6; the ember at column 9 is nearer the left side
    const blocked = (x: number, y: number) => Math.floor(y) === 6 && Math.round(x) >= 8 && Math.round(x) <= 14;
    let [e] = [spawnEmber(9, 5, 4, seq(0.5, 0.5))];
    let embers = stepEmbers([e], 1, blocked, 40, 60);
    e = embers[0];
    expect(e.y).toBe(5);
    expect(e.vx).toBeLessThan(0);
    for (let i = 0; i < 4; i++) embers = stepEmbers(embers, 1, blocked, 40, 60);
    expect(embers[0].x).toBeLessThan(8);
  });

  it('are dropped outside the field', () => {
    const e = spawnEmber(0, 5, 4, seq(0, 0.5));
    expect(stepEmbers([e], 1, never, 40, 60)).toHaveLength(0);
  });
});
