import { describe, expect, it } from 'vitest';
import { crestRow } from './footer-tide';

describe('wave crest', () => {
  it('curves down from the middle to the sides and holds there', () => {
    expect(crestRow(20, 10, 30, 40, 3)).toBe(40);
    expect(crestRow(10, 10, 30, 40, 3)).toBe(37);
    expect(crestRow(30, 10, 30, 40, 3)).toBe(37);
    expect(crestRow(0, 10, 30, 40, 3)).toBe(37);
  });
});
