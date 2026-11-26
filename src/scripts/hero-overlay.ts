// What the hero's own animations share: a canvas over the whole section, and a clock that only runs while the hero
// can be seen.

/** the longest stretch one step may advance the clock past what it asked for, so a stall does not skip the sequence */
const MAX_LAG_MS = 50;

/** what a step asks for next: 0 the next frame, ms later, or null nothing until woken */
export type Next = number | null;

export interface Ticker {
  /** runs a step on the next frame, whatever was scheduled */
  wake(): void;
  stop(): void;
}

/**
 * Calls `step` with its own clock, which stands still while `watched` is off-screen or the tab is hidden, so nothing
 * is left scheduled then.
 */
export function createTicker(watched: Element, step: (clock: number, dt: number) => Next): Ticker {
  let raf = 0,
    timer = 0,
    clock = 0,
    last = 0,
    asked = 0,
    onScreen = true,
    stopped = false;
  const cancel = () => {
    cancelAnimationFrame(raf);
    clearTimeout(timer);
    raf = timer = 0;
  };
  const canRun = () => !stopped && onScreen && !document.hidden;
  const run = () => {
    raf = timer = 0;
    if (!canRun()) return;
    const now = performance.now();
    const dt = last ? Math.min(asked + MAX_LAG_MS, now - last) : 0;
    last = now;
    clock += dt;
    const next = step(clock, dt);
    if (stopped) return;
    cancel();
    asked = next ?? 0;
    if (next === 0) raf = requestAnimationFrame(run);
    else if (next !== null) timer = window.setTimeout(run, next);
  };
  const wake = () => {
    cancel();
    if (canRun()) raf = requestAnimationFrame(run);
  };
  const settle = () => {
    if (canRun()) return wake();
    cancel();
    last = 0;
  };
  const io =
    'IntersectionObserver' in window
      ? new IntersectionObserver((entries) => {
          onScreen = entries[entries.length - 1].isIntersecting;
          settle();
        })
      : null;
  io?.observe(watched);
  document.addEventListener('visibilitychange', settle);
  wake();
  return {
    wake,
    stop() {
      stopped = true;
      cancel();
      io?.disconnect();
      document.removeEventListener('visibilitychange', settle);
    },
  };
}

/** a canvas covering `section` for pointer-less drawing; `clear` fits it to the section and wipes it for a frame */
export function createSectionCanvas(section: HTMLElement, marker: string) {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.setAttribute(marker, '');
  canvas.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:5';
  const ctx = canvas.getContext('2d')!;
  const clear = () => {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const width = Math.round(section.clientWidth * dpr),
      height = Math.round(section.clientHeight * dpr);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, section.clientWidth, section.clientHeight);
  };
  return { canvas, ctx, clear };
}
