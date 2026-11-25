// Capability checks shared by every canvas effect.

export const REDUCE_QUERY = '(prefers-reduced-motion: reduce)';
export const FINE_POINTER_QUERY = '(hover: hover) and (pointer: fine)';

export type MatchMedia = (query: string) => { matches: boolean };

const none: MatchMedia = () => ({ matches: false });
const browserMedia = (): MatchMedia =>
  typeof window !== 'undefined' && window.matchMedia ? window.matchMedia.bind(window) : none;

export function prefersReducedMotion(mm: MatchMedia = browserMedia()): boolean {
  return mm(REDUCE_QUERY).matches;
}

/** The cursor trail needs a real hovering pointer and no reduced-motion preference. */
export function canRunTrail(mm: MatchMedia = browserMedia()): boolean {
  return !prefersReducedMotion(mm) && mm(FINE_POINTER_QUERY).matches;
}

/** Calls cb when the pixel ratio changes (browser zoom, moving between screens). Returns a stop function. */
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
