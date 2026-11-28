import { describe, expect, it } from 'vitest';
import { clockBitmap, clockTime } from './glyph-clock';
import { GLYPH_COLUMNS } from './glyph-model';

/** 05:09 UTC is 12:09 in Jakarta */
const noon = new Date('2026-03-01T05:09:30Z');

describe('clockTime', () => {
  it('formats the Jakarta time, whatever the machine is set to', () => {
    expect(clockTime(noon)).toBe('12:09');
  });

  it('counts midnight as 00', () => {
    expect(clockTime(new Date('2026-03-01T17:00:00Z'))).toBe('00:00');
  });
});

describe('clockBitmap', () => {
  const clock = clockBitmap(noon);
  const column = (x: number) => clock.rows.map((row) => row[x]).join('');

  it('is one rectangular row of digits that fits the glyph grid', () => {
    expect(clock.time).toBe('12:09');
    expect(clock.rows).toHaveLength(10);
    for (const row of clock.rows) {
      expect(row).toMatch(/^[#.]+$/);
      expect(row).toHaveLength(26);
    }
    expect(26).toBeLessThanOrEqual(GLYPH_COLUMNS);
  });

  it('keeps the same size at every time of day', () => {
    for (let minute = 0; minute < 24 * 60; minute += 7) {
      const { rows } = clockBitmap(new Date(minute * 60_000));
      expect(rows.every((row) => row.length === 26)).toBe(true);
    }
  });

  it('marks the columns of the colon: two 2 x 2 dots with a blank column on each side', () => {
    const [first, last] = clock.colon;
    expect([first, last]).toEqual([12, 13]);
    for (const x of [first, last]) expect(column(x)).toBe('..##..##..');
    for (const x of [first - 1, last + 1]) expect(column(x)).toBe('..........');
  });
});
