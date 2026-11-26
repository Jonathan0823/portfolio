import { describe, expect, it } from 'vitest';
import {
  FALLBACK_COLOR,
  GRID,
  artCells,
  countPieces,
  decodeBits,
  encodeBits,
  monogram,
  rasterize,
  runsPath,
  skillIcon,
} from './skill-icons';

const count = (lit: boolean[]) => lit.filter(Boolean).length;

describe('runsPath', () => {
  it('merges neighbouring cells in a row into one run', () => {
    const lit = new Array(GRID * GRID).fill(false);
    lit[0] = lit[1] = lit[2] = true;
    lit[GRID + 5] = true;
    expect(runsPath(lit)).toBe('M0 0h3v1h-3zM5 1h1v1h-1z');
  });
});

describe('bits', () => {
  it('round-trips through hex', () => {
    const lit = Array.from({ length: GRID * GRID }, (_, i) => i % 3 === 0 || i % 7 === 0);
    const hex = encodeBits(lit);
    expect(hex).toHaveLength((GRID * GRID) / 4);
    expect(decodeBits(hex)).toEqual(lit);
  });
});

describe('rasterize', () => {
  it('counts 4-connected pieces', () => {
    const lit = new Array(GRID * GRID).fill(false);
    lit[5] = lit[6] = true; // one piece
    lit[GRID + 7] = true; // diagonal only: separate
    lit[GRID - 1] = lit[GRID] = true; // row wrap is not a neighbour
    expect(countPieces(lit)).toBe(4);
  });
  it('keeps thin strokes joined up', () => {
    // three 0.3-wide vertical bars joined by a 0.3-tall bar: fragments at a crisp cut-off
    const lit = rasterize('M4 4h0.3v16h-0.3zM12 4h0.3v16h-0.3zM20 4h0.3v16h-0.3zM4 12h16.3v0.3h-16.3z');
    expect(countPieces(lit)).toBeLessThanOrEqual(2);
  });
  it('leaves a solid shape crisp', () => {
    expect(rasterize('M4 4h16v16h-16z').filter(Boolean).length).toBe(256);
  });
});

describe('monogram', () => {
  it('draws a frame plus the letters', () => {
    const lit = monogram('WS');
    expect(lit[0] && lit[GRID - 1] && lit[GRID * GRID - 1]).toBe(true);
    expect(count(lit)).toBeGreaterThan(4 * (GRID - 1) + 20);
  });
  it('fits three letters inside the frame', () => {
    const lit = monogram('SQL');
    for (let y = 1; y < GRID - 1; y++) expect(lit[y * GRID + 1] || lit[y * GRID + GRID - 2]).toBe(false);
  });
  it('rejects letters the font lacks', () => {
    expect(() => monogram('ZZ')).toThrow(/no glyph for "Z"/);
  });
});

describe('artCells', () => {
  it('scales by a whole number and centres', () => {
    const cells = artCells(['A.', '.B']);
    const a = cells.filter((c) => c === 'A').length;
    expect(a).toBe(cells.filter((c) => c === 'B').length);
    expect(Math.sqrt(a) % 1).toBe(0);
    expect(cells[0]).toBe('');
  });
});

describe('skillIcon', () => {
  it('pixelises a simple-icons logo in its brand colour', () => {
    const icon = skillIcon({ icon: 'typescript' });
    expect(icon.base).toMatch(/^M\d/);
    expect(icon.layers).toEqual([{ color: '#3178C6', d: icon.base }]);
  });
  it('falls back to the accent when the brand colour is too dark to read', () => {
    expect(skillIcon({ icon: 'github' }).layers[0].color).toBe(FALLBACK_COLOR);
  });
  it('gives pixel art one hover layer per palette colour', () => {
    const icon = skillIcon({ art: 'pi' });
    expect(icon.layers.map((l) => l.color)).toEqual(['#f09082', '#4d9abf', '#f1be58']);
    expect(icon.layers.every((l) => l.d.length > 0)).toBe(true);
  });
  it('throws on an unknown slug', () => {
    expect(() => skillIcon({ icon: 'not-a-real-brand' })).toThrow(/unknown simple-icons slug/);
  });
});
