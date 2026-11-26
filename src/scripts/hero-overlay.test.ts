import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTicker, type Next } from './hero-overlay';

describe('createTicker', () => {
  let see: (isIntersecting: boolean) => void;
  let visibility: () => void;
  const doc = {
    hidden: false,
    addEventListener: (_: string, cb: () => void) => (visibility = cb),
    removeEventListener() {},
  };

  beforeEach(() => {
    vi.useFakeTimers();
    doc.hidden = false;
    class Observer {
      constructor(cb: (entries: { isIntersecting: boolean }[]) => void) {
        see = (isIntersecting) => cb([{ isIntersecting }]);
      }
      observe() {}
      disconnect() {}
    }
    vi.stubGlobal('window', { setTimeout, IntersectionObserver: Observer });
    vi.stubGlobal('IntersectionObserver', Observer);
    vi.stubGlobal('document', doc);
    vi.stubGlobal('requestAnimationFrame', (cb: () => void) => setTimeout(cb, 16));
    vi.stubGlobal('cancelAnimationFrame', clearTimeout);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const start = (next: Next) => {
    const clocks: number[] = [];
    const ticker = createTicker({} as Element, (clock) => (clocks.push(clock), next));
    return { ticker, clocks };
  };

  it('steps by frames or after the wait the step asks for', async () => {
    const { clocks } = start(500);
    await vi.advanceTimersByTimeAsync(1016);
    expect(clocks).toEqual([0, 500, 1000]);
  });

  it('schedules nothing once the step asks for nothing, until woken', async () => {
    const { ticker, clocks } = start(null);
    await vi.advanceTimersByTimeAsync(16);
    expect(vi.getTimerCount()).toBe(0);
    ticker.wake();
    await vi.advanceTimersByTimeAsync(16);
    expect(clocks).toHaveLength(2);
  });

  it.each([
    ['off-screen', () => see(false), () => see(true)],
    ['hidden', () => ((doc.hidden = true), visibility()), () => ((doc.hidden = false), visibility())],
  ])('stands still while %s', async (_, leave, back) => {
    const { clocks } = start(500);
    await vi.advanceTimersByTimeAsync(516);
    leave();
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(60_000);
    back();
    await vi.advanceTimersByTimeAsync(16);
    expect(clocks).toEqual([0, 500, 500]);
  });

  it('leaves nothing behind once stopped', () => {
    const { ticker } = start(0);
    ticker.stop();
    expect(vi.getTimerCount()).toBe(0);
  });
});
