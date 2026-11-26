
export const REDUCE_QUERY = '(prefers-reduced-motion: reduce)';
export const FINE_POINTER_QUERY = '(hover: hover) and (pointer: fine)';

export function whenIdle(cb: () => void): void {
  const run = () => {
    if ('requestIdleCallback' in window) window.requestIdleCallback(() => cb(), { timeout: 1500 });
    else setTimeout(cb, 200);
  };
  if (document.readyState === 'complete') run();
  else window.addEventListener('load', run, { once: true });
}

export type MatchMedia = (query: string) => { matches: boolean };

const none: MatchMedia = () => ({ matches: false });
const browserMedia = (): MatchMedia =>
  typeof window !== 'undefined' && window.matchMedia ? window.matchMedia.bind(window) : none;

export function prefersReducedMotion(mm: MatchMedia = browserMedia()): boolean {
  return mm(REDUCE_QUERY).matches;
}

export function canRunTrail(mm: MatchMedia = browserMedia()): boolean {
  return !prefersReducedMotion(mm) && mm(FINE_POINTER_QUERY).matches;
}

export function watchPixelRatio(cb: () => void): () => void {
  let mql: MediaQueryList | null = null;
  let stopped = false;
  const arm = () => {
    mql = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    mql.addEventListener('change', onChange, { once: true });
  };
  const onChange = () => {
    if (stopped) return;
    cb();
    arm();
  };
  arm();
  return () => {
    stopped = true;
    mql?.removeEventListener('change', onChange);
  };
}
