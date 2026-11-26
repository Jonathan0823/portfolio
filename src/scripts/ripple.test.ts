import { describe, expect, it } from 'vitest';
import { gridCell, gridPoint, lift, LIFT_RADIUS, liveWaves, SPOT, spotlight, waveStrength, type Wave } from './ripple';

const wave = (over: Partial<Wave> = {}): Wave => ({ col: 10, row: 3, at: 0, speed: 10, life: 2, amp: 1, ...over });

describe('ripple', () => {
  it('lifts the origin at the start and the ring a front-distance away later', () => {
    expect(waveStrength([wave()], 10, 3, 0)).toBeGreaterThan(0.9);
    // after 0.5s the front is 5 cells out: that ring is lit, the origin is not
    expect(waveStrength([wave()], 15, 3, 500)).toBeGreaterThan(0.5);
    expect(waveStrength([wave()], 10, 3, 500)).toBeLessThan(0.01);
  });

  it('is zero before it starts and after it has died out', () => {
    expect(waveStrength([wave({ at: 1000 })], 10, 3, 0)).toBe(0);
    expect(waveStrength([wave()], 10, 3, 2000)).toBe(0);
  });

  it('never exceeds 1 however many waves overlap', () => {
    expect(waveStrength([wave(), wave(), wave({ amp: 2 })], 10, 3, 0)).toBe(1);
  });

  it('keeps only the waves still alive', () => {
    const alive = wave({ at: 900 });
    expect(liveWaves([wave(), alive], 2100)).toEqual([alive]);
  });

  it('maps a point to a grid cell and clamps to the grid', () => {
    expect(gridCell(26 + 12 * 4 + 1, 16 + 12 * 2 + 1, 53)).toEqual({ col: 4, row: 2 });
    expect(gridCell(-50, 500, 53)).toEqual({ col: 0, row: 6 });
    expect(gridCell(5000, -5, 53)).toEqual({ col: 52, row: 0 });
  });

  it('keeps cells inside the spotlight at full opacity and dims the far ones to the floor', () => {
    expect(spotlight(SPOT.radius, 1)).toBe(1);
    expect(spotlight(SPOT.radius + SPOT.fall + 5, 1)).toBeCloseTo(SPOT.floor);
    const mid = spotlight(SPOT.radius + SPOT.fall / 2, 1);
    expect(mid).toBeGreaterThan(SPOT.floor);
    expect(mid).toBeLessThan(1);
  });

  it('does not dim anything while the spotlight is off', () => {
    expect(spotlight(100, 0)).toBe(1);
  });

  it('turns a point into fractional cell units', () => {
    expect(gridPoint(26 + 24, 16 + 6)).toEqual({ col: 2, row: 0.5 });
  });

  it('raises the cells under the cursor most and leaves the ones past the hill flat', () => {
    expect(lift(0, 1)).toBe(1);
    expect(lift(LIFT_RADIUS, 1)).toBe(0);
    expect(lift(1.5, 1)).toBeGreaterThan(lift(2.5, 1));
    expect(lift(0, 0)).toBe(0);
  });
});
