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
  /** rectangles on the drip's canvas since it was last cleared */
  const painted: number[][] = [];
  const context = {
    setTransform() {},
    clearRect: () => void (painted.length = 0),
    fillRect: (...rect: number[]) => void painted.push(rect),
    measureText: () => ({
      fontBoundingBoxAscent: 30,
      actualBoundingBoxLeft: 0,
      actualBoundingBoxRight: 20,
      actualBoundingBoxAscent: 20,
      actualBoundingBoxDescent: 0,
    }),
  };
  const createCanvas = () => {
    const attributes = new Set<string>();
    const canvas = {
      style: {},
      width: 0,
      height: 0,
      setAttribute: (name: string) => void attributes.add(name),
      getContext: () => (attributes.has('data-drip') ? context : null),
      remove: () => void canvases.delete(canvas),
    };
    return canvas;
  };
  const attach = (canvas: object) => void canvases.add(canvas);
  const period = { classList: classes() };
  const section = {
    appendChild: attach,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 320, height: 640 }),
    querySelector: () => ({ querySelector: () => period }),
  };
  const root = { classList: classes() };
  root.classList.add('drip-pending');

  let listeners: (() => void)[] = [];
  const reduce = {
    matches: false,
    addEventListener: (_: string, cb: () => void) => void listeners.push(cb),
    removeEventListener: (_: string, cb: () => void) => void (listeners = listeners.filter((l) => l !== cb)),
  };
  let inView = true;
  const observers = new Set<() => void>();
  class FakeIntersectionObserver {
    private notify: () => void;
    constructor(cb: (entries: { isIntersecting: boolean }[]) => void) {
      this.notify = () => cb([{ isIntersecting: inView }]);
    }
    observe() {
      observers.add(this.notify);
      this.notify();
    }
    disconnect() {
      observers.delete(this.notify);
    }
  }

  vi.stubGlobal('window', {
    setTimeout,
    setInterval,
    devicePixelRatio: 1,
    matchMedia: () => reduce,
    IntersectionObserver: FakeIntersectionObserver,
  });
  vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
  vi.stubGlobal('requestAnimationFrame', (cb: (now: number) => void) => setTimeout(() => cb(performance.now()), 16));
  vi.stubGlobal('cancelAnimationFrame', clearTimeout);
  vi.stubGlobal('document', {
    documentElement: root,
    getElementById: () => section,
    querySelector: () => null,
    createElement: createCanvas,
    createRange: () => ({ selectNodeContents() {}, getClientRects: () => [{ left: 100, top: 200 }] }),
  });
  vi.stubGlobal('getComputedStyle', () => ({ getPropertyValue: () => '#f00' }));

  const field = createField(320, 300);
  const hero = {
    canvas: { style: { cssText: '' }, width: 320, height: 300, after: attach },
    field: () => field,
    time: () => 0,
  } as unknown as HeroField;

  return {
    hero,
    root,
    period,
    canvases,
    painted,
    setReduced(matches: boolean) {
      reduce.matches = matches;
      for (const cb of [...listeners]) cb();
    },
    setInView(value: boolean) {
      inView = value;
      for (const notify of [...observers]) notify();
    },
  };
}
