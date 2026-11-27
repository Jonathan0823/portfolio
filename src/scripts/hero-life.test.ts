import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeHeroDom } from './hero-dom.fake';
import { emptyDepth, igniteElapsed } from './hero-life';
import { IGNITE_MS } from './hero-ignite';

describe('igniteElapsed', () => {
  it('waits (-1) until the cover has dissolved and the ignite has started', () => {
    expect(igniteElapsed(-1, 5000)).toBe(-1);
  });

  it('counts ms since the start, and ends exactly when the ignite is over', () => {
    expect(igniteElapsed(1000, 1000)).toBe(0);
    expect(igniteElapsed(1000, 1500)).toBe(500);
    expect(igniteElapsed(1000, 1000 + IGNITE_MS - 1)).toBe(IGNITE_MS - 1);
    expect(igniteElapsed(1000, 1000 + IGNITE_MS)).toBeNull();
  });
});

describe('emptyDepth', () => {
  it('reaches below the horizon and past the tallest skyline, so the field is fully empty', () => {
    expect(emptyDepth(23, 34)).toBeCloseTo(23 + 34 * 0.22 + 14, 10);
    expect(emptyDepth(23, 34)).toBeGreaterThan(23);
  });
});

describe('reduced motion switched on mid-session', () => {
  let dom: ReturnType<typeof fakeHeroDom>;
  let life: typeof import('./hero-life');
  let resolved: boolean;

  beforeEach(async () => {
    // the ignite's state is the module's own, so each case needs a fresh one
    vi.resetModules();
    life = await import('./hero-life');
    dom = fakeHeroDom();
    resolved = false;
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const paint = () => life.heroLifeShape(dom.hero, true, {});
  const mount = () => void life.mountHeroLife(dom.hero).then(() => (resolved = true));
  /** the first paint puts the overlay up; the paint after IGNITE_MS hands back to the field */
  const startIgnite = async () => {
    paint();
    await vi.advanceTimersByTimeAsync(0);
  };
  const endIgnite = async () => {
    await vi.advanceTimersByTimeAsync(IGNITE_MS);
    paint();
  };
  const expectStatic = async () => {
    await vi.advanceTimersByTimeAsync(10_000);
    expect(resolved).toBe(true);
    expect(dom.canvases.size).toBe(0);
    expect(dom.root.classList.contains('drip-pending')).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  };

  it('ends the ignite, and does not replay it when motion comes back', async () => {
    mount();
    await startIgnite();
    expect(dom.canvases.size).toBe(1);
    dom.setReduced(true);
    await expectStatic();
    dom.setReduced(false);
    expect(paint()).toEqual({});
    await expectStatic();
  });

  it('takes down an overlay painted before it was mounted', async () => {
    await startIgnite();
    dom.setReduced(true);
    mount();
    await expectStatic();
  });

  it('cancels the drip waiting to start', async () => {
    mount();
    await startIgnite();
    await endIgnite();
    await vi.advanceTimersByTimeAsync(0);
    dom.setReduced(true);
    await expectStatic();
  });

  it('never starts the drip waiting for the hero to come into view', async () => {
    dom.setInView(false);
    mount();
    await startIgnite();
    await endIgnite();
    await vi.advanceTimersByTimeAsync(1000);
    dom.setReduced(true);
    dom.setInView(true);
    await expectStatic();
  });

  it('stops a drip that is still falling', async () => {
    mount();
    await startIgnite();
    await endIgnite();
    await vi.advanceTimersByTimeAsync(400);
    expect(dom.canvases.size).toBe(1);
    dom.setReduced(true);
    await expectStatic();
  });

  it('leaves the built period as it is', async () => {
    mount();
    await startIgnite();
    await endIgnite();
    await vi.advanceTimersByTimeAsync(5000);
    dom.setReduced(true);
    await expectStatic();
  });
});
