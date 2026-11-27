import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FINE_POINTER_QUERY, REDUCE_QUERY } from './motion';
import { mountHeroInvite } from './hero-invite';
import { mountHeroMould, type MouldOptions } from './hero-mould';
import { mountHeroMouldTouch } from './hero-mould-touch';
import type { HeroField } from './hero-field';

vi.mock('./page-cover', () => ({ whenCoverGone: () => Promise.resolve() }));
vi.mock('./hero-mould', () => ({ mountHeroMould: vi.fn() }));
vi.mock('./hero-mould-touch', () => ({ mountHeroMouldTouch: vi.fn() }));

const media = (matches: boolean) => {
  const listeners = new Set<() => void>();
  return {
    matches,
    listeners,
    addEventListener: (_: string, cb: () => void) => void listeners.add(cb),
    removeEventListener: (_: string, cb: () => void) => void listeners.delete(cb),
    set(value: boolean) {
      this.matches = value;
      for (const cb of [...listeners]) cb();
    },
  };
};

describe('mountHeroInvite', () => {
  let fine: ReturnType<typeof media>, reduce: ReturnType<typeof media>;
  const stopMould = vi.fn();
  const mould = vi.mocked(mountHeroMould);
  const stopSmall = vi.fn();
  const small = vi.mocked(mountHeroMouldTouch);

  beforeEach(() => {
    fine = media(true);
    reduce = media(false);
    const queries: Record<string, unknown> = { [FINE_POINTER_QUERY]: fine, [REDUCE_QUERY]: reduce };
    vi.stubGlobal('window', { matchMedia: (q: string) => queries[q] });
    mould.mockReset().mockReturnValue(stopMould);
    stopMould.mockReset();
    small.mockReset().mockReturnValue(stopSmall);
    stopSmall.mockReset();
  });
  afterEach(() => void vi.unstubAllGlobals());

  const mount = () => mountHeroInvite({} as HeroField, () => null, Promise.resolve());
  const options = () => mould.mock.lastCall![2] as MouldOptions;

  it('shows nothing under reduced motion, and listens for nothing', () => {
    reduce.matches = true;
    mount();
    expect(mould).not.toHaveBeenCalled();
    expect(small).not.toHaveBeenCalled();
    expect(fine.listeners.size).toBe(0);
  });

  it('swaps the moulds as the pointer type changes, one at a time', () => {
    mount();
    expect(small).not.toHaveBeenCalled();
    fine.set(false);
    expect(stopMould).toHaveBeenCalledTimes(1);
    expect(small).toHaveBeenCalledTimes(1);
    fine.set(true);
    expect(stopSmall).toHaveBeenCalledTimes(1);
    expect(mould).toHaveBeenCalledTimes(2);
  });

  it('keeps the mould away once a link was found', () => {
    mount();
    options().onFound();
    fine.set(false);
    fine.set(true);
    expect(mould).toHaveBeenCalledTimes(1);
  });

  it('stops for good when reduced motion turns on', () => {
    mount();
    reduce.set(true);
    expect(stopMould).toHaveBeenCalledTimes(1);
    reduce.set(false);
    fine.set(false);
    fine.set(true);
    expect(mould).toHaveBeenCalledTimes(1);
  });
});
