import { describe, expect, it } from 'vitest';
import { createCells, flightProgress, NONE, retarget } from './pixel-wave';

describe('pixel wave', () => {
  it('lands every cell exactly on the layer it was sent to', () => {
    const cells = createCells(2);
    retarget(cells, 0, [0, 62], 1000, 38);
    expect([flightProgress(cells, 0, 1100), flightProgress(cells, 1, 1100)]).toEqual([1, 1]);
    expect([...cells.to]).toEqual([0, 0]);
  });

  it('redirects a cell in the air without restarting its flight', () => {
    const cells = createCells(1);
    retarget(cells, 0, [0], 0, 100);
    retarget(cells, 1, [0], 50, 100);
    expect(flightProgress(cells, 0, 50)).toBe(0.5);
    expect(cells.to[0]).toBe(1);
  });

  it('keeps the old picture until the new wave reaches the cell, and never pushes it back', () => {
    const cells = createCells(1);
    retarget(cells, 0, [0], 0, 10);
    retarget(cells, 1, [100], 20, 10);
    expect([cells.from[0], flightProgress(cells, 0, 60)]).toEqual([0, 0]);
    retarget(cells, 2, [100], 60, 10);
    expect(cells.start[0]).toBe(120);
  });

  it('cancels a flight that has not left when sent back to where it is', () => {
    const cells = createCells(1);
    retarget(cells, 0, [50], 0, 10);
    retarget(cells, NONE, [50], 20, 10);
    expect(flightProgress(cells, 0, 20)).toBe(1);
    expect(cells.to[0]).toBe(NONE);
  });
});
