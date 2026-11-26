import { describe, expect, it } from 'vitest';
import { shouldPlayHint } from './hero-hint';

describe('shouldPlayHint', () => {
  it('plays only on a fine pointer, with motion', () => {
    expect(shouldPlayHint({ fine: true, reduced: false })).toBe(true);
    expect(shouldPlayHint({ fine: false, reduced: false })).toBe(false);
    expect(shouldPlayHint({ fine: true, reduced: true })).toBe(false);
  });
});
