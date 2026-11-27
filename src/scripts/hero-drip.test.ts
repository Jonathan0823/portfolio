import { afterEach, describe, expect, it, vi } from 'vitest';
import { fakeHeroDom } from './hero-dom.fake';
import { mountHeroDrip, settleDelay, periodGrid, planDrops, settleLevel } from './hero-drip';

describe('periodGrid', () => {
  it('counts field cells across the period and clamps its bands to 2..4', () => {
    expect(periodGrid(40, 40, 10)).toEqual({ columns: 4, bands: 4 });
    expect(periodGrid(14, 12, 10)).toEqual({ columns: 1, bands: 2 });
    expect(periodGrid(2, 200, 10)).toEqual({ columns: 1, bands: 4 });
  });
});

describe('planDrops', () => {
  it('lets one drop go per band, lowest first, after the hot spot has gathered', () => {
    const plan = planDrops({ columns: 5, bands: 4 }, 1000);
    expect(plan.map((d) => d.band)).toEqual([0, 1, 2, 3]);
    expect(plan[0].start).toBeGreaterThan(1000);
    const starts = plan.map((d) => d.start);
    expect([...starts].sort((a, b) => a - b)).toEqual(starts);
    expect(new Set(starts).size).toBe(4);
  });

  it('alternates between the outer columns', () => {
    expect(planDrops({ columns: 5, bands: 4 }, 0).map((d) => d.column)).toEqual([0, 4, 0, 4]);
    expect(planDrops({ columns: 1, bands: 2 }, 0).map((d) => d.column)).toEqual([0, 0]);
  });
});

describe('settleLevel', () => {
  it('cools a landed band from yellow through orange to red', () => {
    expect([0, 0.34, 0.67, 1].map(settleLevel)).toEqual([5, 4, 3, 3]);
    expect(settleLevel(-1)).toBe(5);
    expect(settleLevel(9)).toBe(3);
  });
});

describe('settleDelay', () => {
  it('waits for the last band to cool, then a beat, never negative', () => {
    expect(settleDelay(1000, 1000)).toBe(480);
    expect(settleDelay(1300, 1000)).toBe(180);
    expect(settleDelay(5000, 1000)).toBe(0);
  });
});

describe('mountHeroDrip', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('hands over to the real period once built, leaving nothing drawn or scheduled', async () => {
    const dom = fakeHeroDom();
    const onBuilt = vi.fn();
    const stop = mountHeroDrip(dom.hero, onBuilt);
    expect(dom.root.classList.contains('drip-pending')).toBe(true);
    await vi.advanceTimersByTimeAsync(5000);
    expect(onBuilt).toHaveBeenCalledTimes(1);
    expect(dom.root.classList.contains('drip-pending')).toBe(false);
    expect(dom.canvases.size).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
    stop();
  });
});
