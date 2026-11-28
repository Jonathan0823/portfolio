// Just enough DOM, media query and clock for the hero's life to run under vitest's node environment.
import { vi } from 'vitest';
import { createField } from './pixel-math';
import type { HeroField } from './hero-field';

/** call after the test file's last use of real timers; undo with vi.useRealTimers and vi.unstubAllGlobals */
export function fakeHeroDom() {
  vi.useFakeTimers();
  const classes = () => {
    const set = new Set<string>();
    return {
      add: (c: string) => void set.add(c),
      remove: (c: string) => void set.delete(c),
      contains: (c: string) => set.has(c),
    };
  };
  /** the canvases in the page */
  const canvases = new Set<object>();
  const createCanvas = () => {
    const canvas = {
      style: {},
      width: 0,
      height: 0,
      setAttribute() {},
      getContext: () => null,
      remove: () => void canvases.delete(canvas),
    };
    return canvas;
  };
  const attach = (canvas: object) => void canvases.add(canvas);
  const section = {
    appendChild: attach,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 320, height: 640 }),
  };
  const root = { classList: classes() };

  let listeners: (() => void)[] = [];
  const reduce = {
    matches: false,
    addEventListener: (_: string, cb: () => void) => void listeners.push(cb),
    removeEventListener: (_: string, cb: () => void) => void (listeners = listeners.filter((l) => l !== cb)),
  };
  vi.stubGlobal('window', {
    setTimeout,
    setInterval,
    devicePixelRatio: 1,
    matchMedia: () => reduce,
  });
  vi.stubGlobal('requestAnimationFrame', (cb: (now: number) => void) => setTimeout(() => cb(performance.now()), 16));
  vi.stubGlobal('cancelAnimationFrame', clearTimeout);
  vi.stubGlobal('document', {
    documentElement: root,
    getElementById: () => section,
    querySelector: () => null,
    createElement: createCanvas,
  });

  const field = createField(320, 300);
  const hero = {
    canvas: { style: { cssText: '' }, width: 320, height: 300, after: attach },
    field: () => field,
    time: () => 0,
  } as unknown as HeroField;

  return {
    hero,
    root,
    canvases,
    setReduced(matches: boolean) {
      reduce.matches = matches;
      for (const cb of [...listeners]) cb();
    },
  };
}
