// Hero life after the intro cover lifts: the ignite boot, then the drip that builds the headline's period.
// Everything is skipped under prefers-reduced-motion, which keeps today's static hero.
import type { FieldShape } from './pixel-math';
import type { HeroField } from './hero-field';
import { REDUCE_QUERY, prefersReducedMotion } from './motion';
import { whenCoverGone } from './page-cover';
import { markHeroPoured } from './hero-poured';
import { applyHolds } from './heat-hold';
import { IGNITE_MS, createIgnite } from './hero-ignite';
import { DRIP_PENDING_CLASS, mountHeroDrip } from './hero-drip';

/** the hero field's own seed (canvas-effects.ts): the ignite's last frame must equal the resting field */
const HERO_SEED = 1.3;
/** the drip starts this long after the ignite has handed back to the real field */
const AFTER_IGNITE_MS = 150;

const ignite = createIgnite(HERO_SEED);
let igniteStart = -1;
let igniteDone = false;
let igniteResolve: () => void = () => {};
const ignited = new Promise<void>((resolve) => (igniteResolve = resolve));
let emptied = new Float32Array(0);

/** where the ignite stands at `now`: ms since it started (-1 while the cover still dissolves), or null once over */
export function igniteElapsed(start: number, now: number): number | null {
  if (start < 0) return -1;
  return now - start >= IGNITE_MS ? null : now - start;
}

/** how far under its horizon the real field is held empty while the overlay draws the ignite */
export function emptyDepth(horizonRow: number, hostRows: number): number {
  return horizonRow + hostRows * 0.22 + 14;
}

/** takes the overlay down for good and lets whatever waits on the ignite carry on; safe to call again */
function finishIgnite(): void {
  igniteDone = true;
  ignite.end();
  markHeroPoured();
  igniteResolve();
}

/** called from the hero field's shape callback every paint: applies held heat and empties the field during the ignite */
export function heroLifeShape(hero: HeroField | undefined, motion: boolean, base: FieldShape): FieldShape {
  const field = hero?.field();
  if (!hero || !field || !motion) return {};
  if (igniteStart < 0 && !igniteDone) void whenCoverGone().then(() => (igniteStart = performance.now()));
  const now = performance.now();
  applyHolds(field, now);
  if (igniteDone) return {};
  const elapsed = igniteElapsed(igniteStart, now);
  if (elapsed === null) {
    finishIgnite();
    return {};
  }
  // the real field stays empty; the overlay draws the cells until the paint where it takes over
  if (emptied.length !== field.columns)
    emptied = new Float32Array(field.columns).fill(-emptyDepth(field.horizonRow, field.hostRows));
  ignite.draw(hero, base, elapsed);
  return { swell: emptied };
}

/**
 * Once the ignite is over, plays the drip when the hero is in view. Resolves once the period is built
 * (at once without motion, or when there is nothing to build). Reduced motion switched on
 * at any point stops all of it for good, leaving the plain period.
 */
export function mountHeroLife(hero: HeroField | null): Promise<void> {
  const root = document.documentElement;
  if (!hero || prefersReducedMotion()) {
    // a paint before this call may already have put the overlay up
    finishIgnite();
    root.classList.remove(DRIP_PENDING_CLASS);
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    const reduce = window.matchMedia(REDUCE_QUERY);
    let stopped = false;
    let wait = 0;
    let io: IntersectionObserver | null = null;
    let stopDrip: (() => void) | null = null;
    const drip = () => (stopDrip = mountHeroDrip(hero, resolve));
    // listened to here rather than seen by a field paint, which an off-screen hero does not get
    const stop = () => {
      if (!reduce.matches) return;
      reduce.removeEventListener('change', stop);
      stopped = true;
      clearTimeout(wait);
      io?.disconnect();
      stopDrip?.();
      finishIgnite();
      root.classList.remove(DRIP_PENDING_CLASS);
      resolve();
    };
    reduce.addEventListener('change', stop);
    void ignited
      .then(
        () =>
          new Promise<void>((go) => {
            if (!stopped) wait = window.setTimeout(go, AFTER_IGNITE_MS);
          }),
      )
      .then(() => {
        if (stopped) return;
        const section = document.getElementById('top');
        if (!section || !('IntersectionObserver' in window)) return void drip();
        // an off-screen drip teaches nothing: wait until the hero is in view
        io = new IntersectionObserver(([entry]) => {
          if (stopped || !entry.isIntersecting) return;
          io?.disconnect();
          drip();
        });
        io.observe(section);
      });
  });
}
