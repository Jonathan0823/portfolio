// Hero life after the intro cover lifts: the ignite boot, then the drip that builds the headline's period, then the
// blinking caret. Everything is skipped under prefers-reduced-motion, which keeps today's static hero.
import type { FieldShape } from './pixel-math';
import type { HeroField } from './hero-field';
import { prefersReducedMotion } from './motion';
import { whenCoverGone } from './page-cover';
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
    igniteDone = true;
    ignite.end();
    igniteResolve();
    return {};
  }
  // the real field stays empty; the overlay draws the cells until the paint where it takes over
  if (emptied.length !== field.columns)
    emptied = new Float32Array(field.columns).fill(-emptyDepth(field.horizonRow, field.hostRows));
  ignite.draw(hero, base, Math.max(0, elapsed));
  return { swell: emptied };
}

/**
 * Once the ignite is over, plays the drip when the hero is in view. Resolves once the caret has started blinking
 * (at once without motion, or when there is nothing to build): the hero hint waits on it.
 */
export function mountHeroLife(hero: HeroField | null): Promise<void> {
  const root = document.documentElement;
  if (!hero || prefersReducedMotion()) {
    root.classList.remove(DRIP_PENDING_CLASS);
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    void ignited
      .then(() => new Promise<void>((go) => window.setTimeout(go, AFTER_IGNITE_MS)))
      .then(() => {
        const section = document.getElementById('top');
        if (!section || !('IntersectionObserver' in window)) return void mountHeroDrip(hero, resolve);
        // an off-screen drip teaches nothing: wait until the hero is in view
        const io = new IntersectionObserver(([entry]) => {
          if (!entry.isIntersecting) return;
          io.disconnect();
          mountHeroDrip(hero, resolve);
        });
        io.observe(section);
      });
  });
}
