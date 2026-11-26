import { afterEach, describe, expect, it, vi } from 'vitest';
import { hintSeen, markHintSeen, shouldPlayHint } from './hero-hint';

afterEach(() => vi.unstubAllGlobals());

describe('shouldPlayHint', () => {
  it('plays only on a fine pointer, with motion, the first time in a session', () => {
    expect(shouldPlayHint({ fine: true, reduced: false, seen: false })).toBe(true);
    expect(shouldPlayHint({ fine: false, reduced: false, seen: false })).toBe(false);
    expect(shouldPlayHint({ fine: true, reduced: true, seen: false })).toBe(false);
    expect(shouldPlayHint({ fine: true, reduced: false, seen: true })).toBe(false);
  });
});

describe('hint storage', () => {
  it('remembers that the hint is done', () => {
    const store = new Map<string, string>();
    vi.stubGlobal('sessionStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
    });
    expect(hintSeen()).toBe(false);
    markHintSeen();
    expect(hintSeen()).toBe(true);
  });

  it('never throws when storage does, and then skips the hint', () => {
    const deny = () => {
      throw new Error('denied');
    };
    vi.stubGlobal('sessionStorage', { getItem: deny, setItem: deny });
    expect(markHintSeen).not.toThrow();
    expect(hintSeen()).toBe(true);
  });
});
