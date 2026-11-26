import { describe, expect, it } from 'vitest';
import { shouldPlayHint } from './hero-hint';

describe('shouldPlayHint', () => {
  it('plays only on a fine pointer, with motion, the first time in a session', () => {
    expect(shouldPlayHint({ fine: true, reduced: false, seen: false })).toBe(true);
    expect(shouldPlayHint({ fine: false, reduced: false, seen: false })).toBe(false);
    expect(shouldPlayHint({ fine: true, reduced: true, seen: false })).toBe(false);
    expect(shouldPlayHint({ fine: true, reduced: false, seen: true })).toBe(false);
  });
});
