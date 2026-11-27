// Which invitation to try the contact links the hero shows: the Mould in the version for the pointer type, none under
// reduced motion. Follows the pointer type as it changes; reduced motion switched on stops it for good, like the
// hero's life.
import { FINE_POINTER_QUERY, REDUCE_QUERY, prefersReducedMotion } from './motion';
import { whenCoverGone } from './page-cover';
import type { GlyphSpill } from './glyph-spill';
import type { HeroField } from './hero-field';
import { mountHeroMould } from './hero-mould';
import { mountHeroMouldTouch } from './hero-mould-touch';
import { APPEAR_AFTER_MS } from './pour-mould';

/** `spill` is read late (it mounts on idle and remounts with the pointer type); `life` resolves once the period is built */
export function mountHeroInvite(hero: HeroField | null, spill: () => GlyphSpill | null, life: Promise<void>): void {
  if (!hero || prefersReducedMotion()) return;
  const fine = window.matchMedia(FINE_POINTER_QUERY);
  const reduce = window.matchMedia(REDUCE_QUERY);
  const due = whenCoverGone().then(() => new Promise<void>((go) => setTimeout(go, APPEAR_AFTER_MS)));
  /** once a link has been hovered or focused, the fine pointer's mould stays away for the rest of the page load */
  let found = false;
  let stop: (() => void) | null = null;
  const mount = () => {
    stop?.();
    stop = null;
    if (!fine.matches) stop = mountHeroMouldTouch(hero, due, life);
    else if (!found) stop = mountHeroMould(hero, spill, { due, life, onFound: () => (found = true) });
  };
  const onReduce = () => {
    if (!reduce.matches) return;
    stop?.();
    fine.removeEventListener('change', mount);
    reduce.removeEventListener('change', onReduce);
  };
  fine.addEventListener('change', mount);
  reduce.addEventListener('change', onReduce);
  mount();
}
