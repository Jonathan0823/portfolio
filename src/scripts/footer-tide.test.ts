import { describe, expect, it } from 'vitest';
import { crestRow } from './footer-tide';
import { FOOTER_BITMAPS } from './glyph-model';

describe('wave crest', () => {
  it('curves down from the middle to the sides and holds there', () => {
    expect(crestRow(20, 10, 30, 40, 3)).toBe(40);
    expect(crestRow(10, 10, 30, 40, 3)).toBe(37);
    expect(crestRow(30, 10, 30, 40, 3)).toBe(37);
    expect(crestRow(0, 10, 30, 40, 3)).toBe(37);
  });

  it('has footer logos no taller than 18 rows, each one even', () => {
    for (const rows of Object.values(FOOTER_BITMAPS)) {
      expect(rows.length).toBeLessThanOrEqual(18);
      expect(new Set(rows.map((row) => row.length)).size).toBe(1);
    }
  });
});
