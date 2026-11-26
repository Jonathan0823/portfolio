import { afterEach, describe, expect, it, vi } from 'vitest';
import { ARRIVE_KEY, COVER_SELECTOR, clearCover } from './page-cover';

afterEach(() => vi.unstubAllGlobals());

describe('clearCover', () => {
  it('removes the leftover cover canvas, the covered class and the arrive flag', () => {
    const removed: string[] = [];
    const classes = new Set(['px-covered']);
    const store = new Map([[ARRIVE_KEY, '1']]);
    vi.stubGlobal('document', {
      querySelectorAll: (sel: string) => {
        // the cover must be found by a stable attribute, not by serialized inline style
        expect(sel).toBe(COVER_SELECTOR);
        return [{ remove: () => removed.push('canvas') }];
      },
      documentElement: { classList: { remove: (c: string) => classes.delete(c) } },
    });
    vi.stubGlobal('sessionStorage', { removeItem: (k: string) => store.delete(k) });

    clearCover();

    expect(removed).toEqual(['canvas']);
    expect(classes.has('px-covered')).toBe(false);
    expect(store.has(ARRIVE_KEY)).toBe(false);
  });

  it('keys the selector on the data attribute makeCanvas sets', () => {
    expect(COVER_SELECTOR).toBe('canvas[data-px-cover]');
  });
});
