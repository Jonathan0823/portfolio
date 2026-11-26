import { describe, expect, it } from 'vitest';
import {
  advanceClock,
  coverageDrop,
  advanceSink,
  cellThreshold,
  layoutWordmark,
  popLevel,
  revealDelay,
} from './footer-wordmark';

describe('coverageDrop', () => {
  it('is zero at rest and lowers with coverage', () => {
    expect(coverageDrop(20, 1)).toBe(0);
    expect(coverageDrop(20, 0.5)).toBe(10);
    expect(coverageDrop(20, 0)).toBe(20);
    expect(coverageDrop(20, 2)).toBe(0);
  });
});

describe('layoutWordmark', () => {
  it('stands the large word 10 rows tall with 2-cell strokes, from the gutter column', () => {
    const word = layoutWordmark(9, false);
    expect(word.height).toBe(10);
    expect(word.x0).toBe(9);
    expect(Math.max(...word.ink.map(([, k]) => k))).toBe(9);
    expect(Math.min(...word.ink.map(([, k]) => k))).toBe(0);
    expect(Math.min(...word.ink.map(([x]) => x))).toBe(9);
    expect(Math.max(...word.ink.map(([x]) => x))).toBe(word.x1);
    // E is 4 wide at 2 cells each: its top bar is 8 cells wide
    const topBar = word.ink.filter(([x, k]) => k === 9 && x < 9 + 8);
    expect(topBar).toHaveLength(8);
  });

  it('draws the small word 7 rows tall with 1-cell strokes and a narrower span', () => {
    const large = layoutWordmark(4, false),
      small = layoutWordmark(4, true);
    expect(small.height).toBe(7);
    expect(Math.max(...small.ink.map(([, k]) => k))).toBe(6);
    expect(small.x1 - small.x0).toBeLessThan(large.x1 - large.x0);
  });

  it('reveals left to right, each column no earlier than the one before, within 600-800ms', () => {
    for (const small of [false, true]) {
      const word = layoutWordmark(3, small);
      const cols = [...word.colDelay.entries()].sort((a, b) => a[0] - b[0]);
      for (let i = 1; i < cols.length; i++) expect(cols[i][1]).toBeGreaterThanOrEqual(cols[i - 1][1]);
      expect(cols[0][1]).toBe(0);
      const last = Math.max(...word.ink.map(([, , d]) => d));
      expect(last).toBeGreaterThanOrEqual(600 - 300);
      expect(last + 300).toBeLessThanOrEqual(1000);
      expect(last).toBeGreaterThan(550);
    }
    expect(revealDelay(2, false)).toBe(60);
  });

  it('never repeats a cell, keeps every delay inside the dissolve and indexes the ink', () => {
    for (const small of [false, true]) {
      const word = layoutWordmark(3, small);
      expect(word.inkSet.size).toBe(word.ink.length);
      for (const [, , delay] of word.ink) {
        expect(delay).toBeGreaterThanOrEqual(0);
        expect(delay).toBeLessThan(700);
      }
    }
  });
});

describe('advanceClock', () => {
  it('dissolves in over the full time and stops there', () => {
    expect(advanceClock(0, 16, true, true)).toBe(16);
    expect(advanceClock(990, 50, true, true)).toBe(1000);
  });

  it('dissolves out twice as fast, from no later than the end of the dissolve', () => {
    expect(advanceClock(1000, 100, false, true)).toBeCloseTo(820 - 170, 5);
    expect(advanceClock(100, 100, false, true)).toBe(0);
  });

  it('jumps straight to the end state without motion', () => {
    expect(advanceClock(0, 16, true, false)).toBe(1000);
    expect(advanceClock(1000, 16, false, false)).toBe(0);
  });
});

describe('sink order', () => {
  it('sinks right to left by column, top cells first within a column', () => {
    for (const small of [false, true]) {
      const word = layoutWordmark(3, small);
      const vanish = (x: number, k: number) => {
        const d = word.ink.find(([cx, ck]) => cx === x && ck === k)!;
        return cellThreshold(d[2], k, word.height, 1);
      };
      // a sink empties cells in descending threshold order: within a column the higher cell goes first
      for (const [x] of word.colDelay) {
        const ks = word.ink
          .filter(([cx]) => cx === x)
          .map(([, k]) => k)
          .sort((a, b) => a - b);
        for (let i = 1; i < ks.length; i++) expect(vanish(x, ks[i])).toBeGreaterThan(vanish(x, ks[i - 1]));
      }
      // the last column's bottom cell outlasts the first column's bottom cell
      const xs = [...word.colDelay.keys()].sort((a, b) => a - b);
      expect(vanish(xs[xs.length - 1], 0)).toBeGreaterThan(vanish(xs[0], 0));
    }
  });

  it('leaves the reveal order untouched at a blend of 0 and stays inside the clock span', () => {
    expect(cellThreshold(90, 9, 10, 0)).toBe(90);
    const word = layoutWordmark(3, false);
    for (const [, k, d] of word.ink) expect(cellThreshold(d, k, word.height, 1)).toBeLessThan(850);
  });

  it('retargets from the current clock: a reversal continues instead of restarting', () => {
    const mid = advanceClock(1000, 100, false, true);
    expect(advanceClock(mid, 16, true, true)).toBe(mid + 16);
    expect(advanceSink(0.5, 75, true)).toBe(0);
    expect(advanceSink(0, 75, false)).toBe(0.5);
    expect(advanceSink(1, 500, false)).toBe(1);
  });
});

describe('popLevel', () => {
  it('pops in yellow, steps down to orange, then rests', () => {
    expect([0, 119, 120, 224, 225, 300].map((age) => popLevel(age, true))).toEqual([5, 5, 4, 4, 0, 0]);
  });

  it('never glows while dissolving out', () => {
    expect(popLevel(0, false)).toBe(0);
  });
});
