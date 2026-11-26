import { describe, expect, it } from 'vitest';
import { EXIT_MS, POUR_EXIT_MS, cellExitStart } from './hero-mould';

const cells = Array.from({ length: 25 }, (_, i): [number, number] => [i % 5, Math.floor(i / 5)]);

describe('cellExitStart', () => {
  it('starts every cell early enough to finish within the exit', () => {
    for (const cell of cells) {
      expect(cellExitStart(cell, 5, false)).toBeLessThan(EXIT_MS);
      expect(cellExitStart(cell, 5, true)).toBeLessThan(POUR_EXIT_MS);
    }
  });

  it('holds the GitHub outline until the pour arrives, then lets it go from the bottom up', () => {
    for (const cell of cells) expect(cellExitStart(cell, 5, true)).toBeGreaterThanOrEqual(POUR_EXIT_MS / 2);
    expect(cellExitStart([0, 4], 5, true)).toBeLessThan(cellExitStart([0, 0], 5, true));
  });
});
